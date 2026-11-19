/**
 * Seeds data/entries from English Wiktionary, using the wiktextract dump published by kaikki.org.
 * Imports senses that Wiktionary puts in the Southern, South Central or Mekong Delta Vietnamese
 * categories. Wiktionary text is CC BY-SA 4.0: every imported sense cites `wiktionary` with the page URL.
 *
 * Usage:
 *   node scripts/import-wiktionary.ts [--file <kaikki .jsonl or .jsonl.gz>] [--report <file.md>] [--dry-run]
 * Without --file, downloads the Vietnamese dump to .cache/ (about 13 MB).
 *
 * Pronunciation is not imported: Wiktionary generates its IPA from the spelling, so it isn't a checked transcription.
 *
 * Merging: when a spelling already has a file, an imported sense is merged into an existing sense
 * if Wiktionary's "form of X" or a Northern synonym matches that sense's `standard`. Other senses are
 * added next to the existing ones and listed at the end for review. Spellings whose file already
 * cites Wiktionary are skipped, so re-running does not duplicate senses (it is a seed, not a sync).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { PassThrough } from "node:stream";
import zlib from "node:zlib";
import {
  ROOT, entryFile, readYaml, senses, sourceId, writeEntry,
  type Entry, type Etymology, type PosBlock, type Sense,
} from "./lib/data.ts";
import { slug } from "./lib/telex.ts";

const DUMP_URL = "https://kaikki.org/dictionary/Vietnamese/kaikki.org-dictionary-Vietnamese.jsonl.gz";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : undefined;
const reportArg = args.includes("--report") ? args[args.indexOf("--report") + 1] : undefined;

// ---------- kaikki (wiktextract) shapes, only the fields used here ----------
type KWord = { word: string; tags?: string[]; extra?: string };
type KSense = {
  glosses?: string[];
  tags?: string[];
  raw_tags?: string[];
  qualifier?: string;
  categories?: ({ name: string } | string)[];
  alt_of?: KWord[];
  synonyms?: KWord[];
  derived?: KWord[];
  examples?: { text?: string; translation?: string; english?: string; ref?: string }[];
};
type KEntry = {
  word: string;
  lang_code: string;
  pos: string;
  etymology_number?: number | string;
  etymology_text?: string;
  etymology_templates?: { name: string; args: Record<string, string> }[];
  etymology_links?: [string, string][];
  head_templates?: { name: string; args: Record<string, string> }[];
  forms?: { form: string; tags?: string[] }[];
  derived?: KWord[];
  senses: KSense[];
};

const REGION_BY_CATEGORY: Record<string, string> = {
  "Southern Vietnamese": "south",
  "South Central Vietnamese": "south-central",
  "Mekong Delta Vietnamese": "mekong-delta",
  "Central Vietnamese": "central",
  "Northern Vietnamese": "north",
};
const IMPORT_REGIONS = new Set(["south", "south-central", "mekong-delta"]);
const REGION_PARENT: Record<string, string> = { "mekong-delta": "south", "south-central": "central" };

const LABELS: Record<string, string> = {
  colloquial: "colloquial", informal: "informal", formal: "formal", slang: "slang", vulgar: "vulgar",
  derogatory: "derogatory", humorous: "humorous", endearing: "endearing", familiar: "familiar",
  polite: "polite", impolite: "impolite", emphatic: "emphatic", literary: "literary", dated: "dated",
  archaic: "archaic", obsolete: "obsolete", historical: "historical", rare: "rare", uncommon: "uncommon",
  figuratively: "figurative", idiomatic: "idiomatic", Internet: "internet", abbreviation: "abbreviation",
  "pronunciation-spelling": "pronunciation-spelling", "eye-dialect": "eye-dialect", dialectal: "dialectal",
  childish: "childish", euphemistic: "euphemistic", nonstandard: "nonstandard", proscribed: "proscribed",
};
const POS = new Set([
  "noun", "verb", "adj", "adv", "pron", "particle", "intj", "phrase", "proverb", "name", "num",
  "classifier", "conj", "prep", "det", "prefix", "suffix", "romanization",
]);

const isVietnameseLatin = (w: string) => /^[\p{Script=Latin}\p{M}\p{N} \-'’.…]+$/u.test(w);
const hasCjk = (s: string) => /[\u2E80-\u9FFF\u{20000}-\u{3FFFF}]/u.test(s);
// Private-use code points (unencoded Nôm) and ideographic description sequences are not portable.
const portableChar = (s: string) => !/[-⿰-⿿]|[\u{F0000}-\u{10FFFD}]/u.test(s);
const catNames = (s: KSense) => (s.categories ?? []).map((c) => (typeof c === "string" ? c : c.name));
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const pageUrl = (word: string) =>
  `https://en.wiktionary.org/wiki/${encodeURIComponent(word.replaceAll(" ", "_"))}#Vietnamese`;

function regionsOf(s: KSense): string[] {
  let r = uniq(catNames(s).map((c) => REGION_BY_CATEGORY[c]).filter(Boolean));
  r = r.filter((x) => !r.some((child) => REGION_PARENT[child] === x)); // keep the narrowest
  return r;
}

const unmappedTags = new Map<string, number>();

function convertSense(k: KEntry, s: KSense): Sense {
  const tags = s.tags ?? [];
  const alt = s.alt_of?.[0];
  const isNorthern = (w: KWord) => (w.tags ?? []).some((t) => /North/.test(t));
  const labels = uniq(tags.map((t) => LABELS[t]).filter(Boolean));
  for (const t of tags)
    if (!LABELS[t] && !/^(Vietnam|Southern|Central|South|North|Northern|alt-of|alternative)$/.test(t))
      unmappedTags.set(t, (unmappedTags.get(t) ?? 0) + 1);
  const qualifier = [s.qualifier, ...(s.raw_tags ?? []).filter((t) => t !== "han" && !/Vietnam/.test(t))]
    .filter(Boolean)
    .join("; ");
  const syn = (s.synonyms ?? []).filter((w) => isVietnameseLatin(w.word));
  const examples = (s.examples ?? [])
    .filter((x) => x.text && !hasCjk(x.text)) // classical quotations in chữ Nôm are left on Wiktionary
    .map((x) => ({
      text: x.text!.trim(),
      ...((x.translation ?? x.english) && { en: (x.translation ?? x.english)!.trim() }),
      ...(x.ref && { ref: x.ref.trim() }),
    }));
  return {
    gloss: { en: (alt?.extra ?? s.glosses?.at(-1) ?? "").trim() },
    ...(qualifier && { qualifier }),
    region: regionsOf(s),
    ...(labels.length && { labels }),
    ...(syn.some(isNorthern) && { standard: uniq(syn.filter(isNorthern).map((w) => w.word)) }),
    ...(alt && { variant_of: alt.word }),
    ...(syn.some((w) => !isNorthern(w)) && { synonyms: uniq(syn.filter((w) => !isNorthern(w)).map((w) => w.word)) }),
    ...(examples.length && { examples }),
    sources: [{ id: "wiktionary", url: pageUrl(k.word) }],
  };
}

function convertEtymology(k: KEntry): Omit<Etymology, "pos"> {
  const text = k.etymology_text?.trim();
  const tpl = k.etymology_templates ?? [];
  const ety: Omit<Etymology, "pos"> = {};
  const sino = tpl.find((t) => t.name === "vi-etym-sino");
  const loan = tpl.find((t) => /^(bor|bor\+|lbor|slbor|ubor|der|der\+)$/.test(t.name));
  const inherited = tpl.find((t) => /^inh\+?$/.test(t.name));
  if (text && /^(Variant|Alternative form) of\b/i.test(text)) {
    ety.type = "variant";
    const of = k.etymology_links?.find(([, target]) => target.endsWith("#Vietnamese"))?.[0];
    if (of) ety.of = of;
  } else if (sino) {
    ety.type = "sino";
    if (sino.args["1"]) ety.han = sino.args["1"];
  } else if (loan && !/-pro$/.test(loan.args["2"] ?? "")) {
    ety.type = "loan";
    if (/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(loan.args["2"] ?? "")) ety.lang = loan.args["2"];
    if (loan.args["3"] && loan.args["3"] !== "-") ety.source_form = loan.args["3"];
  } else if (inherited || (loan && /-pro$/.test(loan.args["2"] ?? ""))) {
    ety.type = "native";
  } else if (tpl.some((t) => /^(com\+?|compound|af|affix)$/.test(t.name))) {
    ety.type = "compound";
  }
  const compare = text?.match(/Compare ((?:[^.]|\.(?= \p{Ll}))+)\./u)?.[1];
  if (compare) {
    const pairs = compare
      .split(/,\s*/)
      .map((p) => p.match(/^(.+?) vs\. (.+)$/))
      .filter((m): m is RegExpMatchArray => !!m && isVietnameseLatin(m[1]) && isVietnameseLatin(m[2]))
      .map((m) => [m[1].trim(), m[2].trim()] as [string, string]);
    if (pairs.length) ety.sound_change = { compare: pairs };
  }
  if (text) ety.note = { en: text };
  return ety;
}

function convertBlock(k: KEntry, imported: KSense[], spelling: string): PosBlock {
  const hanNom = (k.forms ?? [])
    .filter((f) => f.tags?.includes("CJK") && portableChar(f.form))
    .map((f) => f.form);
  const classifiers = (k.head_templates ?? [])
    .filter((h) => h.name === "vi-noun" && h.args.cls)
    .flatMap((h) => h.args.cls.split(/,\s*/))
    .filter(isVietnameseLatin);
  return {
    ...(POS.has(k.pos) && { pos: k.pos }),
    ...(k.word !== spelling && { head: k.word }),
    ...(hanNom.length && { han_nom: uniq(hanNom) }),
    ...(classifiers.length && { classifiers: uniq(classifiers) }),
    senses: imported.map((s) => convertSense(k, s)),
  };
}


// ---------- read the dump ----------

async function dumpPath(): Promise<string> {
  if (fileArg) return fileArg;
  const cached = path.join(ROOT, ".cache/kaikki-vi.jsonl.gz");
  if (!fs.existsSync(cached)) {
    console.log(`downloading ${DUMP_URL}`);
    const res = await fetch(DUMP_URL, { headers: { "user-agent": "vn-dialect-import/0.1" } });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  return cached;
}

const file = await dumpPath();
const input = fs.createReadStream(file).pipe(file.endsWith(".gz") ? zlib.createGunzip() : new PassThrough());
const bySlug = new Map<string, { k: KEntry; senses: KSense[] }[]>();
let skippedScript = 0;
for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  const k = JSON.parse(line) as KEntry;
  if (k.lang_code !== "vi" || k.pos === "character") continue;
  const regional = k.senses.filter((s) => s.glosses?.length && regionsOf(s).some((r) => IMPORT_REGIONS.has(r)));
  if (!regional.length) continue;
  if (!isVietnameseLatin(k.word)) {
    skippedScript++;
    continue;
  }
  const key = slug(k.word);
  bySlug.set(key, [...(bySlug.get(key) ?? []), { k, senses: regional }]);
}

// ---------- convert and merge ----------

const report = { created: 0, touched: 0, merged: [] as string[], review: [] as string[], skipped: [] as string[] };

for (const group of bySlug.values()) {
  const words = uniq(group.map((g) => g.k.word));
  const existingPath = entryFile(words[0]);
  const existing = fs.existsSync(existingPath) ? readYaml<Entry>(existingPath) : undefined;
  if (existing && [...senses(existing)].some(({ sense }) => sense.sources?.some((r) => sourceId(r) === "wiktionary"))) {
    report.skipped.push(existing.spelling);
    continue;
  }
  const spelling = existing?.spelling ?? words.find((w) => w === w.toLowerCase()) ?? words[0];

  // Etymologies in Wiktionary order; objects with the same etymology share one.
  const etymologies: Etymology[] = [];
  const etyKey = new Map<string, Etymology>();
  for (const { k, senses: regional } of group) {
    const id = `${k.word}\u0000${k.etymology_number ?? k.etymology_text ?? ""}`;
    let ety = etyKey.get(id);
    if (!ety) {
      ety = { ...convertEtymology(k), pos: [] };
      etyKey.set(id, ety);
      etymologies.push(ety);
    }
    ety.pos.push(convertBlock(k, regional, spelling));
    // Derived terms of the whole section only when every sense in it is regional (see biểu: biểu đồ is not Southern).
    const derived = [
      ...(regional.length === k.senses.length ? (k.derived ?? []) : []),
      ...regional.flatMap((s) => s.derived ?? []),
    ]
      .map((w) => w.word)
      .filter(isVietnameseLatin);
    if (derived.length) ety.derived = uniq([...(ety.derived ?? []), ...derived]);
  }

  // Wiktionary's IPA is generated from the spelling ({{vi-IPA}}), not checked by ear, so it isn't imported.
  let entry: Entry = { spelling, etymologies };

  if (existing) {
    // Merge an imported sense into an existing (skill) sense when they name the same standard word.
    const mergedNote: string[] = [];
    for (const ety of etymologies)
      for (const block of ety.pos)
        block.senses = block.senses.map((imp) => {
          for (const oldEty of existing.etymologies)
            for (const oldBlock of oldEty.pos) {
              if (oldBlock.head) continue; // keep "… coi"-style display forms where they are
              const i = oldBlock.senses.findIndex((old) => {
                const std = old.standard ?? [];
                return (
                  (imp.variant_of && std.includes(imp.variant_of)) ||
                  (imp.standard ?? []).some((w) => std.includes(w)) ||
                  (imp.synonyms ?? []).some((w) => std.includes(w))
                );
              });
              if (i < 0) continue;
              const [old] = oldBlock.senses.splice(i, 1);
              mergedNote.push(`${old.gloss.vi} = ${imp.gloss.en}`);
              for (const k of ["type", "lang", "of", "han", "source_form", "note"] as const)
                if (oldEty[k] && !ety[k]) (ety as Record<string, unknown>)[k] = oldEty[k];
              return {
                ...old,
                gloss: { ...old.gloss, en: imp.gloss.en },
                // Wiktionary qualifiers ("in other contexts") refer to its other senses; they don't carry over.
                region: uniq([...old.region, ...imp.region]),
                labels: uniq([...(old.labels ?? []), ...(imp.labels ?? [])]),
                variant_of: old.variant_of ?? imp.variant_of,
                synonyms: uniq([...(old.synonyms ?? []), ...(imp.synonyms ?? [])]),
                examples: [...(old.examples ?? []), ...(imp.examples ?? [])],
                sources: [...(old.sources ?? []), ...(imp.sources ?? [])],
              } as Sense;
            }
          return imp;
        });
    const remaining = existing.etymologies
      .map((e) => ({ ...e, pos: e.pos.filter((b) => b.senses.length) }))
      .filter((e) => e.pos.length);
    entry = { ...entry, ...(existing.pronunciation && { pronunciation: existing.pronunciation }), etymologies: [...remaining, ...etymologies] };
    if (mergedNote.length) report.merged.push(`${spelling}: ${mergedNote.join("; ")}`);
    report.touched++;
    const left = remaining.flatMap((e) => e.pos.flatMap((b) => b.senses.map((s) => s.gloss.vi ?? s.gloss.en)));
    const unmerged = etymologies.flatMap((e) => e.pos.flatMap((b) => b.senses.filter((s) => !s.gloss.vi).map((s) => s.gloss.en)));
    if (left.length && unmerged.length)
      report.review.push(`${spelling}: kept [${left.join(" | ")}] next to Wiktionary [${unmerged.join(" | ")}]`);
  } else report.created++;

  if (!dryRun) writeEntry(entry);
}

console.log(
  `${[...bySlug.values()].reduce((n, g) => n + g.length, 0)} Wiktionary sections with Southern/South Central/Mekong senses, ` +
    `${bySlug.size} spellings (${skippedScript} non-Latin headwords skipped)`,
);
console.log(`created ${report.created} files, added to ${report.touched} existing files${dryRun ? " (dry run)" : ""}`);
if (report.skipped.length) console.log(`already imported, skipped: ${report.skipped.length}`);
console.log(`\nMerged into an existing sense (${report.merged.length}):`);
for (const m of report.merged) console.log(`  ${m}`);
console.log(`\nTo review: existing senses kept next to imported ones (${report.review.length}):`);
for (const r of report.review) console.log(`  ${r}`);
if (unmappedTags.size)
  console.log(`\nWiktionary tags not mapped to labels: ${[...unmappedTags].map(([t, n]) => `${t}×${n}`).join(", ")}`);

if (reportArg && !dryRun) {
  const md = [
    "# Wiktionary import: senses to review",
    "",
    `Import of ${new Date().toISOString().slice(0, 10)} from the kaikki.org dump (${path.basename(file)}).`,
    "Each file below has a sense from the old skill dictionary next to senses imported from Wiktionary.",
    "Some are the same meaning glossed twice (Vietnamese and English): merge them into one sense,",
    "keeping both glosses and all sources. Others are different meanings: leave them. Tick each one when done,",
    "and delete this file when the list is empty.",
    "",
    `## Merged automatically (${report.merged.length})`,
    "",
    "Matched because Wiktionary's \"form of\" word or Northern synonym equals the old sense's `standard`. Spot-check.",
    "",
    ...report.merged.map((m) => `- ${m}`),
    "",
    `## To review (${report.review.length})`,
    "",
    ...report.review.map((r) => `- [ ] ${r}`),
    "",
  ].join("\n");
  fs.writeFileSync(reportArg, md);
  console.log(`\nwrote ${path.relative(ROOT, path.resolve(reportArg))}`);
}
