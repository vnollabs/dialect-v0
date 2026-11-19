/**
 * Generates artifacts from data/:
 *   skills/southern-mekong-vietnamese-dialect/references/tu-dien-mien-tay.yaml  (senses that have a topic)
 *   skills/southern-mekong-vietnamese-dialect/references/nguon-tu-dien.md       (copy of data/nguon-tu-dien.md)
 *   dist/lexicon.json                                                            (every entry, with status; not committed)
 *
 * Usage:
 *   node scripts/build.ts           write the files
 *   node scripts/build.ts --check   exit 1 if the committed skill files are out of date (for CI)
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, ROOT, loadEntries, loadSources, loadTopics, status } from "./lib/data.ts";
import { renderSkillDictionary, skillLines } from "./lib/skill.ts";

const check = process.argv.includes("--check");
const SKILL = path.join(ROOT, "skills/southern-mekong-vietnamese-dialect/references");

const entries = loadEntries();
const topics = loadTopics();
const sources = loadSources();

const { lines, problems } = skillLines(entries, topics);
if (problems.length) {
  for (const p of problems) console.error(p);
  console.error("Fix these first (npm run validate).");
  process.exit(1);
}

const generated: Record<string, string> = {
  [path.join(SKILL, "tu-dien-mien-tay.yaml")]: renderSkillDictionary(lines, topics),
  [path.join(SKILL, "nguon-tu-dien.md")]: fs.readFileSync(path.join(DATA, "nguon-tu-dien.md"), "utf8"),
};

if (check) {
  const stale = Object.entries(generated).filter(
    ([file, text]) => !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text,
  );
  for (const [file] of stale) console.error(`out of date: ${path.relative(ROOT, file)}`);
  if (stale.length) {
    console.error("Run `npm run build` and commit the result.");
    process.exit(1);
  }
  console.log("Skill files are up to date.");
  process.exit(0);
}

for (const [file, text] of Object.entries(generated)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`wrote ${path.relative(ROOT, file)}`);
}

const lexicon = entries.map(({ entry }) => ({
  ...entry,
  etymologies: entry.etymologies.map((e) => ({
    ...e,
    pos: e.pos.map((p) => ({ ...p, senses: p.senses.map((s) => ({ ...s, status: status(s, sources) })) })),
  })),
}));
fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "dist/lexicon.json"), JSON.stringify(lexicon));
console.log(`wrote dist/lexicon.json (${entries.length} entries, ${lines.length} lines in the skill dictionary)`);
