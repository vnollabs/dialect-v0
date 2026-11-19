/**
 * The static JSON API (v1), generated from data/ by `npm run build` and served at
 * https://dialect.vnol.net/api/v1/. Format documented in docs/api.md; JSON Schemas in schema/api/v1/.
 *
 *   meta.json              counts, file layout, vocabularies (regions, topics, sources)
 *   index.json             one small search record per entry
 *   lexicon.json           every entry
 *   regions/<id>.json      entries with senses in that region or its sub-regions (only those senses)
 *   entries/<id>.json      one entry; <id> is the Telex file name (biểu -> bieeur)
 *   schema/*.schema.json   JSON Schemas for all of the above
 */
import {
  senses, status, type Entry, type Loaded, type Region, type Sense, type Source, type Status, type Topic,
} from "./data.ts";
import { slug } from "./telex.ts";
import { fold, words } from "./search.ts";

export { fold };

export const API_VERSION = "v1";
export const SCHEMA_BASE = "https://dialect.vnol.net/api/v1/schema/";
const LICENSE = "CC BY-SA 4.0";
const LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const ATTRIBUTION =
  "VN Dialect by VN OpenLab (https://dialect.vnol.net). Includes material from English Wiktionary " +
  "(https://en.wiktionary.org/), CC BY-SA 4.0: each such sense lists its Wiktionary page in `sources`.";

export type Header = {
  api: string;
  data_version: string;
  built: string;
  license: string;
  license_url: string;
  attribution: string;
};
export type ApiSense = Sense & { status: Status };
export type ApiEntry = Omit<Entry, "etymologies"> & {
  id: string;
  etymologies: (Omit<Entry["etymologies"][number], "pos"> & {
    pos: (Omit<Entry["etymologies"][number]["pos"][number], "senses"> & { senses: ApiSense[] })[];
  })[];
};
export type IndexRecord = {
  id: string;
  word: string;
  forms: string[];
  keys: string[];
  standard: string[];
  gloss?: string;
  gloss_en?: string;
  gloss_words: string[];
  regions: string[];
  pos: string[];
  topics: string[];
  status: Status;
  senses: number;
};

const uniq = <T>(xs: (T | undefined)[]) => [...new Set(xs.filter((x): x is T => x !== undefined && x !== ""))];
const RANK: Record<Status, number> = { verified: 2, pending: 1, unsourced: 0 };

function toApiEntry(entry: Entry, registry: Record<string, Source>): ApiEntry {
  return {
    id: slug(entry.spelling),
    ...entry,
    etymologies: entry.etymologies.map((e) => ({
      ...e,
      pos: e.pos.map((b) => ({ ...b, senses: b.senses.map((s) => ({ ...s, status: status(s, registry) })) })),
    })),
  };
}

/** The regions and every region above them (mekong-delta -> mekong-delta, south). */
function withAncestors(ids: string[], regions: Record<string, Region>): string[] {
  const out: string[] = [];
  for (const start of ids)
    for (let id: string | undefined = start; id && !out.includes(id); id = regions[id]?.parent) out.push(id);
  return out;
}

function indexRecord(e: ApiEntry, regions: Record<string, Region>): IndexRecord {
  const all = e.etymologies.flatMap((et) => et.pos.flatMap((b) => b.senses.map((s) => ({ b, s }))));
  const forms = uniq<string>([e.spelling, ...all.flatMap(({ b }) => [b.head, ...(b.alt_forms ?? [])])]);
  const best = all.reduce<Status>((acc, { s }) => (RANK[s.status] > RANK[acc] ? s.status : acc), "unsourced");
  // Both preview glosses come from one sense: the first with a curated Vietnamese gloss, else the first sense.
  // So gloss_en is missing when that sense has only a Vietnamese gloss, and gloss when no sense has one.
  const preview = (all.find(({ s }) => s.gloss.vi) ?? all[0])?.s.gloss;
  return {
    id: e.id,
    word: e.spelling,
    forms,
    keys: uniq(forms.map(fold)),
    standard: uniq(all.flatMap(({ s }) => [...(s.standard ?? []), s.variant_of])),
    gloss: preview?.vi,
    gloss_en: preview?.en,
    gloss_words: uniq(all.flatMap(({ s }) => words(`${s.gloss.vi ?? ""} ${s.gloss.en ?? ""}`))),
    // Parents too, so a facet on `south` finds Mekong Delta words, like regions/south.json.
    regions: withAncestors(uniq(all.flatMap(({ s }) => s.region)), regions),
    pos: uniq(all.map(({ b }) => b.pos)),
    topics: uniq(all.flatMap(({ s }) => s.topics ?? [])),
    status: best,
    senses: all.length,
  };
}

/** A region and every region below it (south -> south, southeast, saigon, mekong-delta). */
function descendants(id: string, regions: Record<string, Region>): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [r, v] of Object.entries(regions))
      if (v.parent && out.has(v.parent) && !out.has(r)) {
        out.add(r);
        grew = true;
      }
  }
  return out;
}

/** The entry restricted to senses and pronunciations in `wanted`; undefined when no sense is left. */
function onlyRegions(e: ApiEntry, wanted: Set<string>): ApiEntry | undefined {
  const etymologies = e.etymologies
    .map((et) => ({
      ...et,
      pos: et.pos
        .map((b) => ({ ...b, senses: b.senses.filter((s) => s.region.some((r) => wanted.has(r))) }))
        .filter((b) => b.senses.length),
    }))
    .filter((et) => et.pos.length);
  if (!etymologies.length) return undefined;
  const out: ApiEntry = { ...e, etymologies };
  const pronunciation = e.pronunciation?.filter((p) => p.region.some((r) => wanted.has(r)));
  if (pronunciation?.length) out.pronunciation = pronunciation;
  else delete out.pronunciation;
  return out;
}

/**
 * Every API file, as path (relative to /api/v1/) -> JSON text. `entrySchema` is schema/entry.schema.json,
 * `apiSchemas` the hand-written schemas in schema/api/v1/.
 */
export function buildApi(opts: {
  entries: Loaded[];
  regions: Record<string, Region>;
  topics: Record<string, Topic>;
  sources: Record<string, Source>;
  dataVersion: string;
  built: string;
  entrySchema: Record<string, unknown>;
  apiSchemas: Record<string, unknown>;
}): Map<string, string> {
  const header: Header = {
    api: API_VERSION,
    data_version: opts.dataVersion,
    built: opts.built,
    license: LICENSE,
    license_url: LICENSE_URL,
    attribution: ATTRIBUTION,
  };
  const files = new Map<string, string>();
  const put = (p: string, value: unknown) => files.set(p, JSON.stringify(value));

  const entries = opts.entries.map(({ entry }) => toApiEntry(entry, opts.sources));
  for (const e of entries) {
    // validate.ts rules this out (each file is named by its id); never overwrite an entry silently.
    if (files.has(`entries/${e.id}.json`)) throw new Error(`two entries have the id ${e.id}`);
    put(`entries/${e.id}.json`, e);
  }
  put("index.json", { ...header, entries: entries.map((e) => indexRecord(e, opts.regions)) });
  put("lexicon.json", { ...header, entries });

  const regionFiles: Record<string, string> = {};
  for (const [id, r] of Object.entries(opts.regions)) {
    const wanted = descendants(id, opts.regions);
    const subset = entries.map((e) => onlyRegions(e, wanted)).filter((e): e is ApiEntry => !!e);
    if (!subset.length) continue;
    regionFiles[id] = `regions/${id}.json`;
    put(regionFiles[id], { ...header, region: { id, ...r }, entries: subset });
  }

  const all = entries.flatMap((e) => [...senses(e as unknown as Entry)].map(({ sense }) => sense as ApiSense));
  put("meta.json", {
    ...header,
    counts: {
      entries: entries.length,
      senses: all.length,
      verified: all.filter((s) => s.status === "verified").length,
      pending: all.filter((s) => s.status === "pending").length,
      unsourced: all.filter((s) => s.status === "unsourced").length,
      ai_draft_examples: all.flatMap((s) => s.examples ?? []).filter((x) => x.ai_draft).length,
    },
    files: {
      index: "index.json",
      lexicon: "lexicon.json",
      entry: "entries/{id}.json",
      regions: regionFiles,
      schemas: Object.fromEntries(["meta", "index", "bundle", "entry"].map((n) => [n, `schema/${n}.schema.json`])),
    },
    regions: opts.regions,
    topics: opts.topics,
    sources: opts.sources,
  });

  // The API entry schema is the source schema plus `id` and each sense's computed `status`.
  const entrySchema = structuredClone(opts.entrySchema) as {
    $id: string; title: string; required: string[]; properties: Record<string, unknown>;
    $defs: { sense: { required: string[]; properties: Record<string, unknown> } };
  };
  entrySchema.$id = `${SCHEMA_BASE}entry.schema.json`;
  entrySchema.title = "VN Dialect API v1 entry";
  entrySchema.properties = {
    id: { description: "Telex form of the spelling; also the file name: entries/<id>.json", type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" },
    ...entrySchema.properties,
  };
  entrySchema.required = ["id", ...entrySchema.required];
  entrySchema.$defs.sense.properties.status = {
    description: "verified: 2+ independent sources; pending: 1; unsourced: none.",
    enum: ["verified", "pending", "unsourced"],
  };
  entrySchema.$defs.sense.required = [...entrySchema.$defs.sense.required, "status"];
  put("schema/entry.schema.json", entrySchema);
  for (const [name, schema] of Object.entries(opts.apiSchemas)) put(`schema/${name}.schema.json`, schema);

  return files;
}

/** Cloudflare static-assets headers for everything under /api/. */
export const HEADERS_FILE = `# Generated by npm run build. Cloudflare Workers static assets read this file.
/api/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300, stale-while-revalidate=86400
  X-Content-Type-Options: nosniff
`;
