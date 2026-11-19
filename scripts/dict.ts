/**
 * Everyday dictionary work on data/entries.
 *
 *   node scripts/dict.ts find TEXT
 *       Entries whose spelling, forms, gloss, standard word or synonyms contain TEXT.
 *   node scripts/dict.ts add WORD MEANING --topic ID [--example TEXT] [--region ID]
 *                        [--source ID] [--source-url URL] [--source-note TEXT] [--new-sense] [--dry-run]
 *       Creates WORD's file with one sense (Vietnamese gloss). If the file exists, refuses unless
 *       --new-sense says this is a different meaning; to improve an existing sense, edit the file.
 *       A new meaning has no part of speech or etymology yet: editors classify it later.
 *       --region defaults to south. Run `npm run build` afterwards to refresh the skill.
 *   node scripts/dict.ts pending [--status pending|unsourced] [--topic ID]
 *       Senses still waiting for sources (two independent sources make a sense verified).
 *   node scripts/dict.ts topics
 *       Topics with their number of senses (the skill dictionary's groups).
 *   node scripts/dict.ts drafts [--topic ID]
 *       AI-drafted examples awaiting review. After checking one, fix or delete it and remove `ai_draft: true`.
 */
import fs from "node:fs";
import path from "node:path";
import {
  ROOT, appendInEntryFile, canonical, entryFile, loadEntries, loadRegions, loadSources, loadTopics, readYaml, senses,
  status, writeEntry, type Entry, type Etymology, type Sense, type SourceRef,
} from "./lib/data.ts";
import { skillLines } from "./lib/skill.ts";
import { slug } from "./lib/telex.ts";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined);
const BOOLEAN_FLAGS = new Set(["--dry-run", "--new-sense"]);
const positional = rest.filter((a, i) => !a.startsWith("--") && !(rest[i - 1]?.startsWith("--") && !BOOLEAN_FLAGS.has(rest[i - 1])));
const rel = (f: string) => path.relative(ROOT, f);
const ORIGIN_FIELDS = ["type", "lang", "of", "han", "source_form", "sound_change", "note", "derived"] as const;
const nfc = (s: string) => s.normalize("NFC").trim();

function usage(): never {
  const doc = fs.readFileSync(new URL(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)![1];
  console.error(doc.replace(/^ \* ?/gm, "").trim());
  process.exit(2);
}

function describe(e: Entry): string {
  const parts = [...senses(e)].map(({ block, sense }) => {
    const g = sense.gloss.vi ?? sense.gloss.en;
    return `${block.pos ? `(${block.pos}) ` : ""}${g} [${sense.region.join(", ")}]`;
  });
  return `${e.spelling}: ${parts.join(" | ")}`;
}

if (cmd === "find") {
  const q = nfc(positional[0] ?? usage()).toLowerCase();
  const hits = loadEntries().filter(({ entry }) => {
    const words = [entry.spelling];
    for (const { block, sense } of senses(entry))
      words.push(
        block.head ?? "", ...(block.alt_forms ?? []), sense.gloss.vi ?? "", sense.gloss.en ?? "",
        ...(sense.standard ?? []), ...(sense.synonyms ?? []), sense.variant_of ?? "",
      );
    return words.some((w) => w.toLowerCase().includes(q));
  });
  for (const { file, entry } of hits) console.log(`${rel(file)}  ${describe(entry)}`);
  process.exit(hits.length ? 0 : 1);
}

if (cmd === "add") {
  const [word, meaning] = positional.map(nfc);
  const topic = flag("--topic");
  if (!word || !meaning || !topic) usage();
  const topics = loadTopics();
  const region = flag("--region") ?? "south";
  const sourceIdArg = flag("--source");
  const problems: string[] = [];
  if (!topics[topic]) problems.push(`unknown topic "${topic}" (see data/topics.yaml)`);
  else if (Object.values(topics).some((t) => t.parent === topic)) problems.push(`topic "${topic}" has subtopics; use one`);
  if (!loadRegions()[region]) problems.push(`unknown region "${region}" (see data/regions.yaml)`);
  if (sourceIdArg && !loadSources()[sourceIdArg]) problems.push(`unknown source "${sourceIdArg}" (see data/sources.yaml)`);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  const file = entryFile(word);
  const existed = fs.existsSync(file);
  const entry: Entry = existed ? readYaml<Entry>(file) : { spelling: word, etymologies: [{ pos: [{ senses: [] }] }] };
  if (slug(entry.spelling) !== slug(word)) {
    console.error(`${rel(file)} holds "${entry.spelling}", a different word. Run \`npm run validate\`.`);
    process.exit(1);
  }
  const same = [...senses(entry)].find(({ sense }) => sense.gloss.vi?.toLowerCase() === meaning.toLowerCase());
  if (same) {
    console.error(`${rel(file)} already has this meaning: ${describe(entry)}`);
    process.exit(1);
  }
  if (existed && !rest.includes("--new-sense")) {
    console.error(`${rel(file)} already exists: ${describe(entry)}`);
    console.error("If this is a different meaning, add --new-sense. Otherwise edit that sense in the file.");
    process.exit(1);
  }
  let source: SourceRef | undefined;
  if (sourceIdArg) {
    const url = flag("--source-url");
    const note = flag("--source-note");
    source = url || note ? { id: sourceIdArg, ...(url && { url }), ...(note && { note: nfc(note) }) } : sourceIdArg;
  }
  const example = flag("--example");
  const sense: Sense = {
    gloss: { vi: meaning },
    region: [region],
    ...(example && { examples: [{ text: nfc(example) }] }),
    topics: [topic],
    ...(source && { sources: [source] }),
  };
  const before: Entry = structuredClone(entry);
  // A new meaning is unclassified, so it must not inherit another meaning's origin or part of speech: it goes
  // in an etymology with no origin data whose blocks have no part of speech, made if the file has none.
  // Its block is for the word as typed: a form that differs from the file's spelling by case or
  // punctuation ("Nhựt", "… coi") is the block's `head`.
  const unsorted = (e: Etymology) => ORIGIN_FIELDS.every((k) => e[k] === undefined) && e.pos.every((b) => !b.pos);
  const head = word !== entry.spelling ? word : undefined;
  let e = entry.etymologies.findIndex(unsorted);
  const newEtymology = e < 0;
  if (newEtymology) e = entry.etymologies.push({ pos: [] }) - 1;
  const blocks = entry.etymologies[e].pos;
  let b = blocks.findIndex((x) => x.head === head);
  const newBlock = b < 0;
  if (newBlock) b = blocks.push({ ...(head && { head }), senses: [] }) - 1;
  blocks[b].senses.push(sense);

  // The skill dictionary lists a word once. Say so now rather than leave validate and build failing.
  const others = loadEntries().filter((l) => path.resolve(l.file) !== path.resolve(file));
  const known = new Set(skillLines(existed ? [...others, { file, entry: before }] : others, topics).problems);
  const added = skillLines([...others, { file, entry }], topics).problems.filter((p) => !known.has(p));
  if (added.length) {
    console.error(added.join("\n"));
    console.error(
      `Not ${existed ? "updated" : "created"}. To keep this meaning out of the skill dictionary, add it to ` +
        `${rel(file)} by hand without \`topics\`.`,
    );
    process.exit(1);
  }

  if (rest.includes("--dry-run")) {
    console.log(`[dry-run] ${rel(file)}: ${describe(entry)}`);
    process.exit(0);
  }
  if (existed) {
    // Only the new etymology, block or sense is written, so comments and formatting in the file stay.
    const ety = canonical(entry).etymologies[e];
    if (newEtymology) appendInEntryFile(file, ["etymologies"], ety);
    else if (newBlock) appendInEntryFile(file, ["etymologies", e, "pos"], ety.pos[b]);
    else appendInEntryFile(file, ["etymologies", e, "pos", b, "senses"], ety.pos[b].senses.at(-1));
  } else writeEntry(entry);
  console.log(`${existed ? "updated" : "created"} ${rel(file)}: ${describe(entry)}`);
  console.log("Run `npm run build` to refresh the skill dictionary.");
  process.exit(0);
}

if (cmd === "pending") {
  const want = flag("--status");
  const topic = flag("--topic");
  const registry = loadSources();
  let n = 0;
  for (const { file, entry } of loadEntries())
    for (const { sense } of senses(entry)) {
      const st = status(sense, registry);
      if (st === "verified" || (want && st !== want) || (topic && !sense.topics?.includes(topic))) continue;
      n++;
      console.log(`${st.padEnd(9)}  ${rel(file)}  ${entry.spelling}: ${sense.gloss.vi ?? sense.gloss.en}`);
    }
  console.error(`${n} sense(s)`);
  process.exit(0);
}

if (cmd === "drafts") {
  const topic = flag("--topic");
  let n = 0;
  for (const { file, entry } of loadEntries())
    for (const { sense } of senses(entry)) {
      if (topic && !sense.topics?.includes(topic)) continue;
      for (const x of sense.examples ?? [])
        if (x.ai_draft) {
          n++;
          console.log(`${rel(file)}  ${entry.spelling} (${sense.gloss.vi ?? sense.gloss.en}): ${x.text}`);
        }
    }
  console.error(`${n} draft example(s) to review`);
  process.exit(0);
}

if (cmd === "topics") {
  const topics = loadTopics();
  const count: Record<string, number> = {};
  for (const { entry } of loadEntries())
    for (const { sense } of senses(entry)) if (sense.topics?.[0]) count[sense.topics[0]] = (count[sense.topics[0]] ?? 0) + 1;
  for (const [id, t] of Object.entries(topics)) {
    const label = t.parent ? `${topics[t.parent].name}/${t.name}` : t.name;
    if (!Object.values(topics).some((x) => x.parent === id)) console.log(`${String(count[id] ?? 0).padStart(4)}  ${id.padEnd(20)} ${label}`);
  }
  process.exit(0);
}

usage();
