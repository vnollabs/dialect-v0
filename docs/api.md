# JSON API (v1)

The lexicon as static JSON, generated from `data/` by `npm run build` and served by a Cloudflare Worker.

- **Base URL:** `https://dialect.vnol.net/api/v1/` (live after the first deploy; see [Deployment](#deployment))
- **Locally:** `npm run dev:api`, then `http://localhost:8787/api/v1/meta.json`
- **Schemas:** `/api/v1/schema/*.schema.json` (JSON Schema 2020-12); sources in `schema/api/v1/` and `schema/entry.schema.json`

## Files

| Path | Contents | Size (gzipped, Nov 2026) |
|:--|:--|--:|
| `meta.json` | Counts, file layout, and the region, topic and source vocabularies (Vietnamese `name`, English `en`) | 3 KB |
| `index.json` | One search record per entry | 58 KB |
| `entries/{id}.json` | One full entry. `{id}` is the entry's file name, the Telex spelling: *mắc* → `mawcs`, *biểu* → `bieeur`, *xoong* → `xo_ong` ([rules](data-format.md#one-file-per-spelling)) | 0.5–3 KB each (uncompressed) |
| `regions/{region}.json` | Entries with senses in that region or its sub-regions; other senses, and pronunciations from other regions, removed. `south.json` includes Mekong Delta, Southeast and Saigon senses | 4–144 KB |
| `lexicon.json` | Every entry | 147 KB |

Entries are the files in `data/entries/` (see [data-format.md](data-format.md)) plus `id`, and each sense's computed `status`: `verified` (2+ independent sources), `pending` (1), `unsourced` (0).

Every bundle (`meta`, `index`, `lexicon`, `regions/*`) starts with the same header:

```json
{
  "api": "v1",
  "data_version": "2026-11-19+9e9fb04",
  "built": "2026-11-19T05:12:44.000Z",
  "license": "CC BY-SA 4.0",
  "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
  "attribution": "VN Dialect by VN OpenLab (https://dialect.vnol.net). Includes material from English Wiktionary …"
}
```

`data_version` is the build date and commit. The commit ends in `-dirty` when the build had uncommitted changes in `data/`, `schema/` or `scripts/`, and is `dev` outside a git checkout.

## Searching

Load `index.json` once (58 KB) and search in the browser. A record:

```json
{
  "id": "mawcs", "word": "mắc", "forms": ["mắc"], "keys": ["mac"],
  "standard": ["đắt", "đắt đỏ"], "gloss": "Đắt / Đắt đỏ", "gloss_en": "expensive; dear",
  "gloss_words": ["to", "contract", "debt", "owe", "be", "busy", "…", "đắt", "đỏ", "expensive", "dear"],
  "regions": ["central", "south"], "pos": ["verb", "adj"], "topics": ["qualities-feelings"],
  "status": "pending", "senses": 5
}
```

- `gloss` and `gloss_en` preview one sense: the first with a Vietnamese gloss, or the first sense when none has one. `gloss_en` is left out when that sense has no English gloss, so the two never describe different meanings.
- `gloss_words` holds the distinct words of every sense's glosses, lowercase with marks kept, for search by meaning.
- `regions` lists each sense's region and every region above it: a Mekong Delta sense also gives `south`.

[`scripts/lib/search.ts`](../scripts/lib/search.ts) is a tested reference implementation with no dependencies; copy it. It ranks, best first:

1. exact spelling or form, alternative forms included: `mắc`, `quíu` → *quýu*
2. an exact standard word, in reverse: `bố` → *ba*, `đắt` → *mắc*, `bát` → *chén*
3. the same letters without tone or vowel marks (`mac` → *mắc, mác, mặc*), or Telex typed without a Vietnamese keyboard: `mawcs`, `mawsc` (the tone key anywhere after the vowel), `mawcs coong` → *mắc công*
4. prefix of a form, for autocomplete: `ma` → *mắc, má, mần…*
5. a standard word typed without marks: `dat` → *mắc*
6. gloss words, for queries of 3+ letters: every query word must appear in some gloss of the entry (`pineapple` → *thơm*, `expensive` → *mắc*). A word typed with marks must match them, so `đắt` doesn't find glosses with *đất*; a word typed without marks matches either.

Filter on `regions`, `topics`, `pos` and `status` for facets; since `regions` includes parent regions, a `south` facet finds the same entries as `regions/south.json`. Fetch `entries/{id}.json` when a result is opened.

At around 10,000 entries the index reaches roughly half a megabyte gzipped; at that point move search behind a Worker endpoint using the same records.

## Showing an entry

- **Verification:** show each sense's `status`; `pending` and `unsourced` senses aren't confirmed by two independent sources yet.
- **AI drafts:** examples with `"ai_draft": true` were written by AI and not yet reviewed by a person (roadmap #35). Label them (e.g. "Ví dụ do AI soạn, chưa duyệt") or leave them out.
- **Attribution (required by CC BY-SA):** show the `attribution` text, and for a sense whose `sources` include `{"id": "wiktionary", "url": …}`, link that page and the license.
- **Names:** region and topic ids map to Vietnamese `name` and English `en` in `meta.json`.
- **Pronunciation:** only pronunciations checked by ear are stored; regular ones will come from the IPA tool (roadmap #28).

## Caching and CORS

Every response under `/api/` carries:

```
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=300, stale-while-revalidate=86400
```

plus an `ETag`, so browsers revalidate cheaply. `data_version` changes with every deploy; use it to bust your own caches.

## Versioning

`/api/v1/` only changes by adding fields or files. Anything that would break a consumer goes to `/api/v2/`, and v1 keeps being served next to it until consumers have moved.

## Deployment

[`wrangler.jsonc`](../wrangler.jsonc) defines an assets-only Worker, `dialect-api`, serving `dist/public/` on the route `dialect.vnol.net/api/*` (zone `vnol.net`). The dialect.vnol.net site from vnol.net-landing-pages owns the hostname as a Custom Domain; a Route on the same hostname takes precedence for the paths it matches, so the site reads the API from its own origin without CORS.

- **Automatic:** CI deploys on every push to `main` (`npm run deploy`, which runs `validate` and `build` first), once the repository variable `DEPLOY_API` is `true`. Until then the deploy job is skipped, so `main` stays green before the secrets exist.
- **Secrets:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the repository settings. The token needs Editor on the `dialect-api` Worker and Zone › Workers Routes › Write on `vnol.net`. Then set `DEPLOY_API` to `true` (Settings › Secrets and variables › Actions › Variables).
- **First deploy:** creating the Worker needs the Workers Admin role, so the first `npm run deploy` is easiest from a member's machine (`npx wrangler login`).
- **DNS:** the route only receives traffic once `dialect.vnol.net` resolves through Cloudflare, which the site's Custom Domain sets up. Until then the API has no public URL.
