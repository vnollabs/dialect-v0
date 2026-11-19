import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { buildApi, type ApiEntry, type IndexRecord } from "./api.ts";
import { fold, search, type SearchRecord } from "./search.ts";
import { ROOT, loadEntries, loadRegions, loadSources, loadTopics, type Entry, type Loaded } from "./data.ts";

const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const build = (entries: Loaded[]) =>
  buildApi({
    entries,
    regions: loadRegions(),
    topics: loadTopics(),
    sources: loadSources(),
    dataVersion: "2026-01-01+test",
    built: "2026-01-01T00:00:00.000Z",
    entrySchema: readJson("schema/entry.schema.json"),
    apiSchemas: Object.fromEntries(["meta", "index", "bundle"].map((n) => [n, readJson(`schema/api/v1/${n}.schema.json`)])),
  });
const files = build(loadEntries());
const json = (p: string) => JSON.parse(files.get(p) ?? assert.fail(`missing ${p}`));

// Validate with the schemas exactly as published.
const ajv = new Ajv2020({ allErrors: true, strict: true, formats: { "date-time": true } });
for (const [p, text] of files) if (p.startsWith("schema/")) ajv.addSchema(JSON.parse(text));
const check = (schema: string, p: string) => {
  const validate = ajv.getSchema(`https://dialect.vnol.net/api/v1/schema/${schema}.schema.json`)!;
  assert.ok(validate(json(p)), `${p}: ${ajv.errorsText(validate.errors)}`);
};

test("every file matches its published schema", () => {
  check("meta", "meta.json");
  check("index", "index.json");
  check("bundle", "lexicon.json");
  for (const p of files.keys()) {
    if (p.startsWith("regions/")) check("bundle", p);
    if (p.startsWith("entries/")) check("entry", p);
  }
});

test("each index record points at an entry file", () => {
  const index = json("index.json").entries as IndexRecord[];
  assert.equal(index.length, json("meta.json").counts.entries);
  for (const r of index) assert.ok(files.has(`entries/${r.id}.json`), r.id);
});

test("index supports tone-free, Telex and reverse lookups", () => {
  const index = json("index.json").entries as IndexRecord[];
  const mac = index.find((r) => r.word === "mắc")!;
  assert.equal(mac.id, "mawcs");
  assert.ok(mac.keys.includes("mac"));
  assert.ok(mac.standard.includes("đắt"));
  assert.equal(mac.gloss, "Đắt / Đắt đỏ", "the Vietnamese gloss is preferred for previews");
  assert.equal(mac.gloss_en, "expensive; dear", "the English preview translates the same sense");
});

test("both preview glosses come from the same sense", () => {
  const index = json("index.json").entries as IndexRecord[];
  const entries = new Map((json("lexicon.json").entries as ApiEntry[]).map((e) => [e.id, e]));
  for (const r of index) {
    if (!r.gloss || !r.gloss_en) continue;
    const glosses = entries.get(r.id)!.etymologies.flatMap((et) => et.pos.flatMap((b) => b.senses.map((s) => s.gloss)));
    assert.ok(glosses.some((g) => g.vi === r.gloss && g.en === r.gloss_en), `${r.word}: ${r.gloss} / ${r.gloss_en}`);
  }
});

test("a region facet on the index finds the same entries as the region bundle", () => {
  const index = json("index.json").entries as IndexRecord[];
  const regionFiles = json("meta.json").files.regions as Record<string, string>;
  for (const [region, p] of Object.entries(regionFiles)) {
    const bundle = (json(p).entries as ApiEntry[]).map((e) => e.id);
    const facet = index.filter((r) => r.regions.includes(region)).map((r) => r.id);
    assert.deepEqual(facet, bundle, region);
  }
});

test("a region bundle keeps only senses in that region or below it", () => {
  const mekong = json("regions/mekong-delta.json").entries as ApiEntry[];
  const south = json("regions/south.json").entries as ApiEntry[];
  const regionsOf = (es: ApiEntry[]) =>
    new Set(es.flatMap((e) => e.etymologies.flatMap((et) => et.pos.flatMap((b) => b.senses.flatMap((s) => s.region)))));
  assert.ok(mekong.every((e) => e.etymologies.every((et) => et.pos.every((b) => b.senses.every((s) => s.region.includes("mekong-delta"))))));
  assert.ok(regionsOf(south).has("mekong-delta"), "south includes its sub-regions");
  assert.ok(south.length > mekong.length);
});

test("a region bundle keeps only pronunciations in that region", () => {
  const entry: Entry = {
    spelling: "thử",
    pronunciation: [{ ipa: "tʰɨ˧˩", region: ["central"], sources: [] }],
    etymologies: [{ pos: [{ pos: "verb", senses: [
      { gloss: { vi: "Thử" }, region: ["south"] },
      { gloss: { vi: "Thử" }, region: ["south-central"] },
    ] }] }],
  };
  const built = build([{ file: "t/thuwr.yaml", entry }]);
  const only = (p: string) => (JSON.parse(built.get(p)!).entries as ApiEntry[])[0];
  assert.equal(only("regions/south.json").pronunciation, undefined, "no Central IPA in the Southern bundle");
  assert.deepEqual(only("regions/central.json").pronunciation, entry.pronunciation);
});

test("fold strips marks and punctuation", () => {
  assert.equal(fold("Mắc"), "mac");
  assert.equal(fold("Đâu có"), "dau co");
  assert.equal(fold("có… đâu"), "co dau");
  assert.equal(fold("nước mắm nhỉ".normalize("NFD")), "nuoc mam nhi");
});

test("search ranks exact, tone-free, Telex, reverse and gloss matches", () => {
  const index = json("index.json").entries as IndexRecord[];
  const words = (q: string) => search(index, q).map((r) => r.word);
  assert.equal(words("mắc")[0], "mắc");
  assert.ok(words("mac").includes("mắc"), "tone-free");
  assert.equal(words("mawcs")[0], "mắc", "Telex");
  assert.equal(words("mawsc")[0], "mắc", "Telex, tone key before the final consonant");
  assert.equal(words("mawcs coong")[0], "mắc công", "Telex, several syllables");
  assert.ok(words("đắt").includes("mắc"), "standard word -> Southern word");
  assert.ok(words("bát").includes("chén"));
  assert.equal(words("bố")[0], "ba", "an exact standard word beats tone-free and prefix matches");
  assert.equal(words("mẹ")[0], "má");
  assert.equal(words("đỗ")[0], "đậu");
  assert.ok(words("pineapple").includes("thơm"), "English gloss");
  assert.ok(words("expensive").includes("mắc"), "gloss of a later sense");
  assert.deepEqual(search(index, "  "), []);
});

test("search: exact forms, and gloss words keep the marks the query has", () => {
  const record = (word: string, forms: string[], glossWords: string[] = []): SearchRecord => ({
    id: word, word, forms, keys: [...new Set(forms.map(fold))], standard: [], gloss_words: glossWords,
  });
  const index = [
    record("quiu", ["quiu"]),
    record("quýu", ["quýu", "quíu"]),
    record("mắc", ["mắc"], ["đắt"]),
    record("cù lao", ["cù lao"], ["đất", "giữa", "sông"]),
  ];
  const words = (q: string) => search(index, q).map((r) => r.word);
  assert.equal(words("quíu")[0], "quýu", "an alternative form is an exact match");
  assert.deepEqual(words("đắt"), ["mắc"], "đắt doesn't find đất");
  assert.deepEqual(words("dat"), ["cù lao", "mắc"], "a query without marks matches either");
  assert.deepEqual(words("đất sông"), ["cù lao"], "every query word must be in the glosses");
});
