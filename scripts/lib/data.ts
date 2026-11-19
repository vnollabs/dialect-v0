import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { entryRelPath } from "./telex.ts";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DATA = path.join(ROOT, "data");
export const ENTRIES = path.join(DATA, "entries");

// ---------- Types (mirror schema/entry.schema.json) ----------

export type Text = { vi?: string; en?: string };
export type SourceRef = string | { id: string; url?: string; note?: string };
/** `ai_draft`: written by AI, not yet reviewed by a person. */
export type Example = { text: string; standard?: string; en?: string; ref?: string; ai_draft?: true };
export type Sense = {
  gloss: Text;
  qualifier?: string;
  region: string[];
  labels?: string[];
  standard?: string[];
  variant_of?: string;
  synonyms?: string[];
  examples?: Example[];
  topics?: string[];
  ai?: { tone?: string[]; register?: string; relationship?: string; usage_notes?: string };
  sources?: SourceRef[];
  note?: string;
};
export type PosBlock = {
  pos?: string;
  head?: string;
  han_nom?: string[];
  classifiers?: string[];
  alt_forms?: string[];
  senses: Sense[];
};
export type Etymology = {
  type?: string;
  lang?: string;
  of?: string;
  han?: string;
  source_form?: string;
  sound_change?: { pattern?: string; compare?: [string, string][] };
  note?: Text;
  derived?: string[];
  pos: PosBlock[];
};
export type Pronunciation = { ipa: string; region: string[]; sources: SourceRef[]; note?: string };
export type Entry = {
  spelling: string;
  /** Only pronunciations checked by ear that differ from what the spelling predicts in a region. */
  pronunciation?: Pronunciation[];
  etymologies: Etymology[];
};
export type Loaded = { file: string; entry: Entry };

export type Region = { name: string; en?: string; parent?: string };
export type Topic = { name: string; en?: string; parent?: string };
export type Source = {
  name: string;
  kind: string;
  url?: string;
  license?: string;
  same_as?: string;
  counts?: boolean;
  note?: string;
};

// ---------- YAML ----------

/** YAML 1.2 core schema: "no", "yes", "on" stay strings (they are Vietnamese words). */
export function parseYaml(text: string, file: string): unknown {
  const doc = YAML.parseDocument(text, { version: "1.2", schema: "core", uniqueKeys: true });
  if (doc.errors.length) throw new Error(`${file}: ${doc.errors[0].message}`);
  return doc.toJS();
}

export function readYaml<T>(file: string): T {
  return parseYaml(fs.readFileSync(file, "utf8"), file) as T;
}

// Strings a YAML 1.1 reader (PyYAML and others) would turn into booleans or null.
const YAML11_SPECIAL = /^(y|n|yes|no|true|false|on|off|null|~)$/i;

export function toYaml(value: unknown): string {
  const doc = new YAML.Document(value, { version: "1.2" });
  YAML.visit(doc, {
    Seq(_, node) {
      // Short lists of plain words read better inline: region: [south, mekong-delta]
      if (node.items.every((i) => YAML.isScalar(i) && String(i.value).length < 40)) node.flow = true;
    },
    Scalar(_, node) {
      if (typeof node.value === "string" && YAML11_SPECIAL.test(node.value)) node.type = "QUOTE_DOUBLE";
    },
  });
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

// ---------- Entries ----------

export function entryFile(spelling: string): string {
  return path.join(ENTRIES, entryRelPath(spelling));
}

export function loadEntries(): Loaded[] {
  if (!fs.existsSync(ENTRIES)) return [];
  const files = fs
    .readdirSync(ENTRIES, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".yaml"))
    .sort();
  return files.map((rel) => {
    const file = path.join(ENTRIES, rel);
    return { file, entry: readYaml<Entry>(file) };
  });
}

const KEY_ORDER: Record<string, string[]> = {
  entry: ["spelling", "pronunciation", "etymologies"],
  pronunciation: ["ipa", "region", "sources", "note"],
  etymology: ["type", "lang", "of", "han", "source_form", "sound_change", "note", "derived", "pos"],
  pos: ["pos", "head", "han_nom", "classifiers", "alt_forms", "senses"],
  sense: [
    "gloss", "qualifier", "region", "labels", "standard", "variant_of", "synonyms",
    "examples", "topics", "ai", "sources", "note",
  ],
  example: ["text", "standard", "en", "ref", "ai_draft"],
  text: ["vi", "en"],
};

function ordered<T extends object>(obj: T, kind: string): T {
  const keys = KEY_ORDER[kind];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (v !== undefined && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  }
  for (const k of Object.keys(obj)) if (!keys.includes(k)) out[k] = (obj as Record<string, unknown>)[k];
  return out as T;
}

/** Fixed key order and no empty lists, so files written by different scripts look alike. */
export function canonical(entry: Entry): Entry {
  return ordered(
    {
      ...entry,
      pronunciation: entry.pronunciation?.map((p) => ordered(p, "pronunciation")),
      etymologies: entry.etymologies.map((e) =>
        ordered(
          {
            ...e,
            note: e.note && ordered(e.note, "text"),
            pos: e.pos.map((p) =>
              ordered(
                {
                  ...p,
                  senses: p.senses.map((s) =>
                    ordered(
                      {
                        ...s,
                        gloss: ordered(s.gloss, "text"),
                        examples: s.examples?.map((x) => ordered(x, "example")),
                      },
                      "sense",
                    ),
                  ),
                },
                "pos",
              ),
            ),
          },
          "etymology",
        ),
      ),
    },
    "entry",
  );
}

export function writeEntry(entry: Entry): string {
  const file = entryFile(entry.spelling);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, toYaml(canonical(entry)));
  return file;
}

export function* senses(entry: Entry): Generator<{ ety: Etymology; block: PosBlock; sense: Sense }> {
  for (const ety of entry.etymologies)
    for (const block of ety.pos) for (const sense of block.senses) yield { ety, block, sense };
}

// ---------- Vocabularies ----------

export function loadRegions(): Record<string, Region> {
  return readYaml(path.join(DATA, "regions.yaml"));
}
export function loadTopics(): Record<string, Topic> {
  return readYaml(path.join(DATA, "topics.yaml"));
}
export function loadSources(): Record<string, Source> {
  return readYaml(path.join(DATA, "sources.yaml"));
}

export const sourceId = (ref: SourceRef): string => (typeof ref === "string" ? ref : ref.id);

export type Status = "verified" | "pending" | "unsourced";

/** verified: 2+ independent sources; pending: 1; unsourced: 0. Copies (same_as) and provenance-only sources don't add. */
export function status(sense: Sense, registry: Record<string, Source>): Status {
  const roots = new Set<string>();
  for (const ref of sense.sources ?? []) {
    let id = sourceId(ref);
    const seen = new Set<string>();
    while (registry[id]?.same_as && !seen.has(id)) {
      seen.add(id);
      id = registry[id].same_as!;
    }
    if (registry[id] && registry[id].counts !== false) roots.add(id);
  }
  return roots.size >= 2 ? "verified" : roots.size === 1 ? "pending" : "unsourced";
}

export const collator = new Intl.Collator("vi", { sensitivity: "base" });
