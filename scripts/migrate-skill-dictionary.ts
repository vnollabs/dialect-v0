/**
 * ONE-OFF: converts the flat dictionary of the southern-mekong-vietnamese-dialect skill
 * (references/tu-dien-mien-tay.yaml, `<từ>: <nghĩa>` per line, before it moved to this repo)
 * into data/entries/. Kept for provenance; new words go through `npm run dict -- add`.
 *
 * Usage: node scripts/migrate-skill-dictionary.ts <old tu-dien-mien-tay.yaml> [--force]
 *
 * How a line is converted:
 *   - "A / B: X / Y" with as many meanings as words -> two words, A = X and B = Y.
 *   - "A / B: X" -> two files with the same meaning, linked through `synonyms`.
 *   - "(VD. ...)" at the end of a meaning -> an example on the form it mentions.
 *   - "(...)" at the end of the word -> `qualifier`.
 *   - The group becomes the topic; groups under "Đối chiếu Bắc → Nam" also give `standard`.
 *   - Every sense cites `skill-dictionary-v1` (provenance only: the old file kept no per-word sources).
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, entryFile, loadTopics, writeEntry, type Entry, type Sense } from "./lib/data.ts";

const [input] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const force = process.argv.includes("--force");
if (!input) {
  console.error("Usage: node scripts/migrate-skill-dictionary.ts <tu-dien-mien-tay.yaml> [--force]");
  process.exit(2);
}

const topics = loadTopics();
const topicByName = new Map(Object.entries(topics).map(([id, t]) => [t.name, id]));
const STANDARD_TOPICS = new Set([
  ...Object.keys(topics).filter((id) => topics[id].parent === "north-south"),
  "sino-vietnamese",
]);
const MIEN_TAY_TOPICS = new Set(["mekong-words", "mekong-food"]);
const POS_BY_TOPIC: Record<string, string> = { particles: "particle" };
const PROVENANCE = "skill-dictionary-v1";

const lowerFirst = (s: string) => (s ? s[0].toLocaleLowerCase("vi") + s.slice(1) : s);
const upperFirst = (s: string) => (s ? s[0].toLocaleUpperCase("vi") + s.slice(1) : s);
const unquote = (s: string) => (s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? JSON.parse(s) : s);

type Row = { topic: string; key: string; value: string; line: number };
const rows: Row[] = [];
{
  const stack: { indent: number; name: string }[] = [];
  fs.readFileSync(input, "utf8")
    .split("\n")
    .forEach((raw, i) => {
      const body = raw.trim();
      if (!body || body.startsWith("#")) return;
      const indent = raw.length - raw.trimStart().length;
      while (stack.length && stack.at(-1)!.indent >= indent) stack.pop();
      if (body.endsWith(":") && !body.includes(": ") && !body.startsWith('"')) {
        stack.push({ indent, name: body.slice(0, -1).trim() });
        return;
      }
      const sep = body.indexOf(": ");
      const group = stack.at(-1)!.name;
      const topic = topicByName.get(group);
      if (!topic) throw new Error(`line ${i + 1}: no topic in data/topics.yaml named "${group}"`);
      rows.push({ topic, key: unquote(body.slice(0, sep).trim()), value: unquote(body.slice(sep + 2).trim()), line: i + 1 });
    });
}

const entries = new Map<string, Entry>();
const report = { paired: [] as string[], synonyms: [] as string[] };

function addSense(spelling: string, head: string | undefined, pos: string | undefined, sense: Sense) {
  const entry = entries.get(spelling) ?? { spelling, etymologies: [{ pos: [] }] };
  entries.set(spelling, entry);
  const blocks = entry.etymologies[0].pos;
  const block = blocks.find((b) => b.pos === pos && b.head === head);
  if (block) block.senses.push(sense);
  else blocks.push({ ...(pos && { pos }), ...(head && { head }), senses: [sense] });
}

for (const row of rows) {
  let meaning = row.value;
  let example: string | undefined;
  const vd = meaning.lastIndexOf("(VD. ");
  if (vd >= 0 && meaning.endsWith(")")) {
    example = meaning.slice(vd + 5, -1).trim();
    meaning = meaning.slice(0, vd).trim();
  }
  let key = row.key;
  let qualifier: string | undefined;
  const q = key.match(/^(.*?)\s*\(([^)]*)\)$/);
  if (q) [, key, qualifier] = q;

  const forms = key.split(" / ").map((f) => f.trim());
  const parts = meaning.split(" / ").map((p) => p.trim());
  const paired = forms.length > 1 && forms.length === parts.length;
  if (paired) report.paired.push(`${row.key}: ${row.value}`);
  else if (forms.length > 1) report.synonyms.push(row.key);

  const spellings = forms.map((f) => lowerFirst(f.replace(/^…\s*/, "")));
  // "chích" is not mentioned by "đi chích ngừa" when "chích ngừa" is also a form on this line.
  const mentions = (s: string) => {
    if (!example) return false;
    let text = example.toLowerCase();
    for (const longer of spellings) if (longer !== s && longer.includes(s)) text = text.replaceAll(longer.toLowerCase(), "");
    return text.includes(s.toLowerCase());
  };
  const withExample = spellings.some(mentions) ? spellings.filter(mentions) : spellings.slice(0, 1);

  forms.forEach((form, i) => {
    const spelling = spellings[i];
    const gloss = upperFirst(paired ? parts[i] : meaning);
    const glossParts = gloss.split(" / ");
    const standard =
      STANDARD_TOPICS.has(row.topic) && glossParts.every((p) => p.split(" ").length <= 3 && !/[(;,]/.test(p))
        ? glossParts.map(lowerFirst)
        : undefined;
    const sense: Sense = {
      gloss: { vi: gloss },
      ...(qualifier && { qualifier }),
      region: [MIEN_TAY_TOPICS.has(row.topic) ? "mekong-delta" : "south"],
      ...(/nay ít dùng/.test(gloss) && { labels: ["dated"] }),
      ...(standard && { standard }),
      ...(!paired && forms.length > 1 && { synonyms: spellings.filter((_, j) => j !== i) }),
      ...(example && withExample.includes(spelling) && { examples: [{ text: example }] }),
      topics: [row.topic],
      sources: [PROVENANCE],
    };
    addSense(spelling, form.startsWith("…") ? lowerFirst(form) : undefined, POS_BY_TOPIC[row.topic], sense);
  });
}

// Fixes a line-by-line conversion cannot get right. Each is taken from the old file's own text or notes.
const fix = (spelling: string, f: (e: Entry) => void) => {
  const e = entries.get(spelling);
  if (!e) throw new Error(`fix: no entry "${spelling}"`);
  f(e);
};
const firstSense = (e: Entry) => e.etymologies[0].pos[0].senses[0];
for (const s of ["hia", "chế"])
  fix(s, (e) => {
    Object.assign(e.etymologies[0], { type: "loan", lang: "nan-tws", note: { vi: "Gốc tiếng Hoa Triều Châu." } });
    firstSense(e).gloss.vi = s === "hia" ? "Anh" : "Chị";
  });
fix("nước ròng", (e) => (firstSense(e).gloss.vi = "Thủy triều xuống"));
fix("chục", (e) => {
  delete firstSense(e).qualifier;
  firstSense(e).region = ["mekong-delta"];
});
fix("gác-măng-rê", (e) => Object.assign(e.etymologies[0], { type: "loan", lang: "fr", source_form: "garde-manger" }));
for (const s of ["trái bom", "trái bôm"])
  fix(s, (e) => Object.assign(e.etymologies[0], { type: "loan", lang: "fr", source_form: "pomme" }));
// From the old nguon-tu-dien.md, "Đã thêm theo duyệt của người dùng, còn chờ kiểm chứng".
for (const s of ["thấy mồ", "chớ bộ"]) fix(s, (e) => firstSense(e).sources!.push("vjol-thay-mo-cho-bo"));
fix("coi bộ", (e) =>
  firstSense(e).sources!.push({ id: "vjol-thay-mo-cho-bo", note: "Ví dụ hội thoại Nam Bộ trong bài" }),
);
fix("ta nói", (e) =>
  firstSense(e).sources!.push({ id: "contributor", note: "Người dùng đưa ra khi duyệt, 2026-11-19" }),
);

let written = 0;
const skipped: string[] = [];
for (const entry of entries.values()) {
  if (fs.existsSync(entryFile(entry.spelling)) && !force) {
    skipped.push(entry.spelling);
    continue;
  }
  writeEntry(entry);
  written++;
}

console.log(`${rows.length} lines -> ${entries.size} entries; wrote ${written}`);
if (skipped.length) console.log(`skipped (file exists, use --force): ${skipped.join(", ")}`);
console.log(`\nSplit into one word per meaning (${report.paired.length}):`);
for (const p of report.paired) console.log(`  ${p}`);
console.log(`\nSeparate files linked as synonyms (${report.synonyms.length}):`);
for (const s of report.synonyms) console.log(`  ${s}`);
console.log(`\nOutput in ${path.relative(ROOT, path.join(ROOT, "data/entries"))}/`);
