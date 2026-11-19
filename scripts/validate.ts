/**
 * Checks every file in data/entries:
 *   - matches schema/entry.schema.json
 *   - file name is the Telex form of `spelling`, all text is NFC
 *   - region, topic and source ids exist in data/*.yaml
 *   - the skill dictionary can be generated (no duplicate words, Vietnamese glosses present)
 * Prints a summary of verification status. Exit code 1 on any problem.
 *
 * Usage: node scripts/validate.ts [--quiet]
 */
import fs from "node:fs";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  ENTRIES, ROOT, entryFile, loadEntries, loadRegions, loadSources, loadTopics, senses, sourceId, status,
  type Status,
} from "./lib/data.ts";
import { skillLines } from "./lib/skill.ts";

const quiet = process.argv.includes("--quiet");
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema/entry.schema.json"), "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

const problems: string[] = [];
const rel = (f: string) => path.relative(ROOT, f);

const regions = loadRegions();
const topics = loadTopics();
const sources = loadSources();

for (const [id, r] of Object.entries(regions))
  if (r.parent && !regions[r.parent]) problems.push(`data/regions.yaml: ${id}: unknown parent "${r.parent}"`);
for (const [id, t] of Object.entries(topics))
  if (t.parent && !topics[t.parent]) problems.push(`data/topics.yaml: ${id}: unknown parent "${t.parent}"`);
for (const [id, s] of Object.entries(sources))
  if (s.same_as && !sources[s.same_as]) problems.push(`data/sources.yaml: ${id}: unknown same_as "${s.same_as}"`);
const parentTopics = new Set(Object.values(topics).map((t) => t.parent).filter(Boolean));

function checkNfc(value: unknown, where: string) {
  if (typeof value === "string") {
    if (value !== value.normalize("NFC")) problems.push(`${where}: text is not NFC: "${value}"`);
  } else if (Array.isArray(value)) value.forEach((v) => checkNfc(v, where));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => checkNfc(v, where));
}

const entries = loadEntries();
const counts: Record<Status, number> = { verified: 0, pending: 0, unsourced: 0 };
let senseCount = 0;
let drafts = 0;
let withoutExample = 0;
let unclassified = 0;

for (const { file, entry } of entries) {
  const where = rel(file);
  if (!validateSchema(entry)) {
    for (const e of validateSchema.errors ?? []) problems.push(`${where}: ${e.instancePath || "/"} ${e.message}`);
    continue;
  }
  checkNfc(entry, where);
  let expected: string;
  try {
    expected = entryFile(entry.spelling);
  } catch (e) {
    problems.push(`${where}: ${(e as Error).message}`);
    continue;
  }
  if (path.resolve(expected) !== path.resolve(file))
    problems.push(`${where}: spelling "${entry.spelling}" belongs in ${rel(expected)}`);

  for (const ety of entry.etymologies)
    for (const block of ety.pos) if (!block.pos) unclassified += block.senses.length;

  for (const pron of entry.pronunciation ?? []) {
    for (const r of pron.region) if (!regions[r]) problems.push(`${where}: pronunciation: unknown region "${r}"`);
    for (const ref of pron.sources)
      if (!sources[sourceId(ref)]) problems.push(`${where}: pronunciation: unknown source "${sourceId(ref)}"`);
  }

  for (const { sense } of senses(entry)) {
    senseCount++;
    drafts += (sense.examples ?? []).filter((x) => x.ai_draft).length;
    if (!sense.examples?.length) withoutExample++;
    counts[status(sense, sources)]++;
    for (const r of sense.region) if (!regions[r]) problems.push(`${where}: unknown region "${r}"`);
    for (const t of sense.topics ?? []) {
      if (!topics[t]) problems.push(`${where}: unknown topic "${t}"`);
      else if (parentTopics.has(t)) problems.push(`${where}: topic "${t}" has subtopics; use one of them`);
    }
    for (const ref of sense.sources ?? [])
      if (!sources[sourceId(ref)]) problems.push(`${where}: unknown source "${sourceId(ref)}"`);
  }
}

const stray = fs.existsSync(ENTRIES)
  ? fs.readdirSync(ENTRIES, { recursive: true, encoding: "utf8" }).filter(
      (f) => !f.endsWith(".yaml") && fs.statSync(path.join(ENTRIES, f)).isFile(),
    )
  : [];
for (const f of stray) problems.push(`data/entries/${f}: only .yaml files belong here`);

problems.push(...skillLines(entries, topics).problems);

for (const p of problems) console.error(p);
if (!quiet || problems.length) {
  console.log(
    `${entries.length} entries, ${senseCount} senses: ` +
      `${counts.verified} verified, ${counts.pending} pending (1 source), ${counts.unsourced} unsourced; ` +
      `${unclassified} without part of speech, ${withoutExample} without examples; ${drafts} AI-drafted example(s) awaiting review`,
  );
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}
