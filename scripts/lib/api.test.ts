import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { buildApi, type ApiEntry, type IndexRecord } from "./api.ts";
import { fold, search } from "./search.ts";
import { ROOT, loadEntries, loadRegions, loadSources, loadTopics } from "./data.ts";

const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const files = buildApi({
  entries: loadEntries(),
  regions: loadRegions(),
  topics: loadTopics(),
  sources: loadSources(),
  dataVersion: "2026-01-01+test",
  built: "2026-01-01T00:00:00.000Z",
  entrySchema: readJson("schema/entry.schema.json"),
  apiSchemas: Object.fromEntries(["meta", "index", "bundle"].map((n) => [n, readJson(`schema/api/v1/${n}.schema.json`)])),
});
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
  assert.ok(words("đắt").includes("mắc"), "standard word -> Southern word");
  assert.ok(words("bát").includes("chén"));
  assert.ok(words("pineapple").includes("thơm"), "English gloss");
  assert.deepEqual(search(index, "  "), []);
});
