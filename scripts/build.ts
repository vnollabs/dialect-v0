/**
 * Generates artifacts from data/:
 *   skills/southern-mekong-vietnamese-dialect/references/tu-dien-mien-tay.yaml  (senses that have a topic)
 *   skills/southern-mekong-vietnamese-dialect/references/nguon-tu-dien.md       (copy of data/nguon-tu-dien.md)
 *   dist/public/api/v1/…  the static JSON API served at https://dialect.vnol.net/api/v1/ (see docs/api.md; not committed)
 *   dist/public/_headers  CORS and caching for the API (Cloudflare Workers static assets)
 *
 * Usage:
 *   node scripts/build.ts           write the files
 *   node scripts/build.ts --check   exit 1 if the committed skill files are out of date (for CI)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { HEADERS_FILE, buildApi } from "./lib/api.ts";
import { DATA, ROOT, loadEntries, loadRegions, loadSources, loadTopics } from "./lib/data.ts";
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

// The JSON API. dist/public is the Worker's asset directory (wrangler.jsonc), rebuilt from scratch each time.
const built = new Date().toISOString();
let commit = "dev";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
} catch {
  // Not a git checkout: keep "dev".
}
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const api = buildApi({
  entries,
  regions: loadRegions(),
  topics,
  sources,
  dataVersion: `${built.slice(0, 10)}+${commit}`,
  built,
  entrySchema: readJson("schema/entry.schema.json"),
  apiSchemas: Object.fromEntries(
    ["meta", "index", "bundle"].map((n) => [n, readJson(`schema/api/v1/${n}.schema.json`)]),
  ),
});
const PUBLIC = path.join(ROOT, "dist/public");
fs.rmSync(PUBLIC, { recursive: true, force: true });
for (const [rel, text] of api) {
  const file = path.join(PUBLIC, "api/v1", rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
fs.writeFileSync(path.join(PUBLIC, "_headers"), HEADERS_FILE);
console.log(
  `wrote dist/public/api/v1 (${api.size} files, ${entries.length} entries; ${lines.length} lines in the skill dictionary)`,
);
