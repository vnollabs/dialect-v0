# VN Dialect

**A machine-readable lexicon of Vietnamese regional dialects, starting with Mekong and Southern Vietnamese, built so AI agents use them correctly.**

An open project from [VN OpenLab](https://vnol.net) · Web portal (planned): [dialect.vnol.net](https://dialect.vnol.net)

> **Status: pre-alpha / planning.** This repository currently holds only the product requirements ([`docs/PRD.md`](docs/PRD.md)). The schema, dataset, build scripts, and web portal described below are planned and not yet implemented. Feedback on the PRD is welcome.

---

## Why

LLMs mostly write standard Northern (Hanoi) Vietnamese, because that is what most of their training text is. When asked to speak like someone from the Mekong Delta (*Tây Nam Bộ*) or the Southeast (*Đông Nam Bộ*), they often:

- misuse or invent regional idioms and slang,
- mix registers within one conversation, e.g. the Northern particle *"ạ"* alongside the Southern pronoun *"tui"*,
- lose the warmth and social nuance of Southern speech.

Existing regional dictionaries are written for people to read. They have no machine-readable schema, no tags for when a word fits socially, and no mapping between regions. VN Dialect fills that gap.

## What it will provide

| Deliverable                     | Description                                                                                                                                 |
|:--------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------|
| **JSON schema**                 | `entry.schema.json`, which records pragmatic context (tone, register, relationship) along with each definition                              |
| **Curated dataset**             | At least 1,500 high-frequency Mekong and Southern entries, covering all common regional pronouns and sentence-final particles               |
| **`SKILL.md` files for agents** | Short, token-efficient rule sets generated from the data and ready to drop into Claude Skills, Cursor Rules, custom GPTs, or system prompts |
| **Static JSON API**             | CDN-cached endpoints such as `https://dialect.vnol.net/api/v1/mekong.json`, for MCP servers and RAG pipelines                               |
| **Style-guard rules**           | Anti-patterns to avoid when writing Southern speech, e.g. *lợn → heo*, *bát → chén*, *vâng → dạ*                                            |
| **Web portal**                  | Lexicon search, a prompt playground comparing output with and without VN Dialect, and a contribution form that opens PRs for you            |

## Example entry

Each entry describes *when* and *how* to use a word, as well as what it means:

```json
{
  "id": "mk-00042",
  "term": "nghen",
  "variants": ["hen", "nha"],
  "region": ["mekong", "south"],
  "pos": "sentence_final_particle",
  "standard_equivalent": ["nhé", "nha"],
  "pragmatics": {
    "tone": ["friendly", "persuasive", "gentle", "colloquial"],
    "register": "informal_to_semi_formal",
    "relationship": "equal_or_affectionate_to_younger"
  },
  "definition_vi": "Tiểu từ đặt cuối câu dùng để rủ rê, dặn dò hoặc xác nhận một cách nhẹ nhàng, thân tình.",
  "definition_en": "Sentence-final particle used to soften suggestions, reminders, or confirmations with warmth.",
  "examples": [
    {
      "dialect": "Mai mốt rảnh ghé nhà tui chơi nghen!",
      "standard": "Hôm nào rảnh ghé nhà tôi chơi nhé!",
      "context": "Inviting a friend warmly."
    }
  ],
  "ai_usage_notes": "Avoid pairing 'nghen' with Northern pronouns like 'tớ/cậu' or formal particles like 'ạ'. Pair with 'tui/bạn', 'anh/em', or 'chú/con'."
}
```

## Planned repository layout

One monorepo holds every region, so the schema and the cross-region checks stay consistent.

```text
dialect-v0/
├── schema/
│   ├── entry.schema.json        # Core schema for lexical entries
│   └── mapping.schema.json      # Schema for cross-regional equivalences
├── data/
│   ├── mekong/                  # Flagship: Mekong Delta (Tây Nam Bộ)
│   │   ├── pronouns.json        # Xưng hô & đại từ
│   │   ├── particles.json       # Tiểu từ tình thái (hen, nghen, đa…)
│   │   └── lexicon-*.json       # General vocabulary
│   ├── south/                   # Southern / Saigon urban usage
│   ├── central/                 # [Future] Central dialects
│   └── north/                   # [Future] Northern reference
├── mappings/
│   └── north-south.json         # Equivalence pairs for translation / style transfer
├── skills/                      # Generated: do not edit by hand
│   ├── mekong-agent/SKILL.md
│   └── south-agent/SKILL.md
├── scripts/
│   ├── validate.ts              # Schema + duplicate-ID checks (CI)
│   └── build-artifacts.ts       # Builds SKILL.md files and minified JSON bundles
├── web/                         # Source for dialect.vnol.net
└── docs/
    └── PRD.md                   # Product requirements
```

## Roadmap

- **Phase 1: Mekong & Southern (MVP).** Schema, a dataset of 1,500+ entries, the build pipeline for `SKILL.md` and JSON bundles, and the web portal.
- **Phase 2: Cross-regional mapping & TTS.** `mappings/north-south.json`, plus pronunciation audio linked with [voice.vnol.net](https://voice.vnol.net).
- **Phase 3: Multi-region expansion.** Community maintainers for Central (*Huế, Quảng, Nghệ*) and Northern sub-dialects.

## Contributing

You don't need academic credentials. Native speakers' knowledge of everyday usage is exactly what this project needs. Once the schema is in place, you'll be able to contribute through:

1. **GitHub pull requests:** add or edit entries under `data/<region>/`.
2. **The web form** at dialect.vnol.net, which turns your submission into valid JSON and opens a PR for you.

Every PR will have to pass CI:

- JSON schema validation
- No duplicate IDs
- Each entry includes `examples` or `ai_usage_notes`

**No binary files in Git.** Audio files (`.mp3`, `.wav`) are not accepted in this repository. Pronunciation audio is stored externally (e.g. Cloudflare R2, managed with voice.vnol.net), and entries link to it by URL.

Until then, the most useful contribution is feedback on [`docs/PRD.md`](docs/PRD.md). Open an issue or start a discussion.

## License

The planned licensing is:

- **Dataset and lexicon** (`data/`, `mappings/`, `skills/`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with attribution to VN OpenLab
- **Scripts and web code** (`scripts/`, `web/`, `schema/`): [MIT](https://opensource.org/licenses/MIT)

License files will be added along with the first data and code.
