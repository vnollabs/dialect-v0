/**
 * Renders the agent skill's flat dictionary (one line per word: `<từ>: <nghĩa>`) from data/entries.
 * The format must stay readable by skills/southern-mekong-vietnamese-dialect/scripts/dictionary.py,
 * so quoting and duplicate rules mirror that script.
 */
import path from "node:path";
import { ROOT, collator, type Loaded, senses, type Topic } from "./data.ts";

const YAML_INDICATORS = "-?:,[]{}#&*!|>'\"%@`";

function needsQuotes(text: string): boolean {
  return (
    text.includes(": ") || text.includes(" #") || text.endsWith(":") || YAML_INDICATORS.includes(text[0])
  );
}

function scalar(text: string): string {
  return needsQuotes(text) ? JSON.stringify(text) : text;
}

const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase("vi") + s.slice(1) : s);

// Everything Python's str.splitlines() splits on: one of these inside a word or gloss breaks the line.
const LINE_BREAK = /[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/;

/** Same forms dictionary.py compares: lowercase, no "(…)", no leading "cái"/"con". */
export function aliases(word: string): string[] {
  return word
    .split(" / ")
    .map((p) =>
      p
        .replace(/\([^)]*\)/g, "")
        .trim()
        .toLowerCase()
        .replace(/^(cái|con)\s+/, ""),
    )
    .filter(Boolean);
}

type Line = { topic: string; key: string; value: string; file: string };
type Item = {
  topic: string;
  word: string; // spelling or head
  forms: string[]; // word + alt_forms
  qualifier?: string;
  gloss: string;
  examples: string[];
  synonyms: string[];
  file: string;
};

/**
 * Synonyms with the same meaning in the same topic share one line, as in the hand-written file:
 * "Dữ hôn / Dữ thần: …". The order is the one their `synonyms` lists agree on.
 */
function synonymGroups(items: Item[]): Item[][] {
  const groups: Item[][] = [];
  const used = new Set<Item>();
  const sameMeaning = (a: Item, b: Item) =>
    a.topic === b.topic && a.gloss === b.gloss && a.qualifier === b.qualifier;
  for (const item of items) {
    if (used.has(item)) continue;
    const group = [item];
    for (const other of items) {
      if (other === item || used.has(other) || !sameMeaning(item, other)) continue;
      if (item.synonyms.includes(other.word) && other.synonyms.includes(item.word)) group.push(other);
    }
    group.forEach((g) => used.add(g));
    const words = group.map((g) => g.word);
    const orders = group
      .map((first) => [first.word, ...first.synonyms.filter((s) => words.includes(s))])
      .filter((o) =>
        group.every((g) => g.synonyms.filter((s) => words.includes(s)).join() === o.filter((w) => w !== g.word).join()),
      );
    // A pair lists each other symmetrically, so any order fits; fall back to alphabetical.
    if (orders.length === 1) group.sort((a, b) => orders[0].indexOf(a.word) - orders[0].indexOf(b.word));
    else group.sort((a, b) => collator.compare(a.word, b.word));
    groups.push(group);
  }
  return groups;
}

export function skillLines(entries: Loaded[], topics: Record<string, Topic>): { lines: Line[]; problems: string[] } {
  const problems: string[] = [];
  const items: Item[] = [];
  for (const loaded of entries) {
    const { entry } = loaded;
    const file = path.relative(ROOT, loaded.file);
    for (const { block, sense } of senses(entry)) {
      if (!sense.topics?.length) continue;
      if (!sense.gloss.vi) {
        problems.push(`${file}: a sense with topics needs gloss.vi (the skill dictionary is in Vietnamese)`);
        continue;
      }
      const word = block.head ?? entry.spelling;
      const forms = [word, ...(block.alt_forms ?? [])];
      const broken = [
        ...forms.map((f) => ["word", f]),
        ["gloss.vi", sense.gloss.vi],
        ["qualifier", sense.qualifier ?? ""],
      ].find(([, text]) => LINE_BREAK.test(text));
      if (broken) {
        // JSON.stringify leaves U+0085, U+2028 and U+2029 as they are; spell them out so they show.
        const shown = JSON.stringify(broken[1]).replace(/[\x85\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
        problems.push(`${file}: ${broken[0]} ${shown} has a line break; the skill dictionary needs it on one line`);
        continue;
      }
      items.push({
        topic: sense.topics[0],
        word,
        forms,
        qualifier: sense.qualifier,
        gloss: sense.gloss.vi,
        // One short, human-reviewed example per line, as in the hand-written file; the rest (including
        // AI drafts awaiting review) stay in data/entries.
        examples: (sense.examples ?? [])
          .filter((x) => !x.ai_draft)
          .map((x) => x.text)
          .filter((t) => !LINE_BREAK.test(t) && t.length <= 150)
          .slice(0, 1),
        synonyms: sense.synonyms ?? [],
        file,
      });
    }
  }

  const byKey = new Map<string, Line>();
  for (const group of synonymGroups(items)) {
    const { topic, qualifier, gloss, file } = group[0];
    const key = group.flatMap((g) => g.forms).map(capitalize).join(" / ") + (qualifier ? ` (${qualifier})` : "");
    const examples = [...new Set(group.flatMap((g) => g.examples))];
    const value = gloss + (examples.length ? ` (VD. ${examples.join("; ")})` : "");
    const id = `${topic}\u0000${key.toLowerCase()}`;
    const same = byKey.get(id);
    if (same) same.value += `; ${value}`;
    else byKey.set(id, { topic, key, value, file });
  }
  const lines = [...byKey.values()];

  const seen = new Map<string, Line>();
  for (const line of lines) {
    // A set, as in dictionary.py: "Cái mền / Mền" is one word, not a duplicate of itself.
    for (const form of new Set(aliases(line.key))) {
      const prev = seen.get(form);
      if (prev) problems.push(`"${form}" would appear twice in the skill dictionary: ${prev.file} and ${line.file}`);
      else seen.set(form, line);
    }
  }
  return { lines, problems };
}

export function renderSkillDictionary(lines: Line[], topics: Record<string, Topic>): string {
  const out = [
    "# Từ điển phương ngữ Nam Bộ & Miền Tây",
    "#",
    "# FILE NÀY ĐƯỢC TẠO TỰ ĐỘNG từ data/entries/ của repo VN Dialect",
    "# (https://github.com/vnollabs/dialect-v0) bằng `npm run build`. Đừng sửa tay trong repo đó;",
    "# sửa file mục từ trong data/entries/ rồi build lại.",
    "#",
    "# Định dạng: <từ>: <nghĩa>",
    "#   - <từ>   là từ Nam Bộ / Miền Tây. Nhiều cách nói cùng nghĩa thì nối bằng \" / \".",
    "#   - <nghĩa> là lời giải nghĩa, hoặc từ phổ thông / Bắc tương đương.",
    "#     Ví dụ đặt cuối, trong ngoặc: (VD. ...).",
    "#   - Không viết \": \" hay \" #\" bên trong <từ> / <nghĩa>. Cần thì bọc cả chuỗi trong \"...\".",
    "#   - Mỗi <từ> chỉ xuất hiện một lần trong cả file.",
    "#   - Dùng skill ngoài repo VN Dialect: thêm / tìm / kiểm tra bằng scripts/dictionary.py (add, find, check).",
    "#",
    "# Một số ví dụ lấy từ Wiktionary tiếng Anh (https://en.wiktionary.org/), giấy phép CC BY-SA 4.0;",
    "# trang nguồn của từng nghĩa ghi trong trường `sources` của mục từ trong data/entries/.",
  ];
  const children = (parent?: string) => Object.keys(topics).filter((id) => topics[id].parent === parent);
  // dictionary.py rejects an empty group, so a topic is written only if it or a subtopic has lines.
  const hasLines = (id: string): boolean => lines.some((l) => l.topic === id) || children(id).some(hasLines);
  const emit = (id: string, depth: number) => {
    if (!hasLines(id)) return;
    const pad = "  ".repeat(depth);
    const subs = children(id);
    const own = lines
      .filter((l) => l.topic === id)
      .sort((a, b) => collator.compare(a.key, b.key));
    if (depth === 0) out.push("");
    else if (out.at(-1) !== "" && !out.at(-1)!.endsWith(":")) out.push("");
    out.push(`${pad}${topics[id].name}:`);
    for (const l of own) out.push(`${pad}  ${scalar(l.key)}: ${scalar(l.value)}`);
    for (const sub of subs) emit(sub, depth + 1);
  };
  for (const id of children(undefined)) emit(id, 0);
  return out.join("\n") + "\n";
}
