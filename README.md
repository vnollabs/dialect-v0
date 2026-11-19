# VN Dialect

**A machine-readable lexicon of Vietnamese regional dialects, starting with Mekong and Southern Vietnamese, built so AI agents use them correctly.**

An open project from [VN OpenLab](https://vnol.net) · Web portal (planned): [dialect.vnol.net](https://dialect.vnol.net)

> **Status: early.** The repo has the dataset (981 entries, 1,202 senses, seeded from an agent-skill dictionary and from Wiktionary), its schema, validation and build scripts, and two agent skills. Most senses still need a second source to count as verified. The web portal and the hosted JSON API are not built yet. See [`docs/PRD.md`](docs/PRD.md) for the plan.

---

## Why

LLMs mostly write standard Northern (Hanoi) Vietnamese, because that is what most of their training text is. When asked to speak like someone from the Mekong Delta (*Tây Nam Bộ*) or the Southeast (*Đông Nam Bộ*), they often:

- misuse or invent regional idioms and slang,
- mix registers within one conversation, e.g. the Northern particle *"ạ"* alongside the Southern pronoun *"tui"*,
- lose the warmth and social nuance of Southern speech.

Existing regional dictionaries are written for people to read. They have no machine-readable schema, no tags for when a word fits socially, and no mapping between regions. VN Dialect fills that gap.

## What's here

| Part                                                                                     | Description                                                                                                                                                       |
|:-----------------------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Dataset** ([`data/`](data))                                                            | One YAML file per spelling: etymologies, part of speech, senses with region, standard equivalent, examples, usage labels and sources                              |
| **Schema** ([`schema/entry.schema.json`](schema/entry.schema.json))                      | JSON Schema for an entry; guide in [`docs/data-format.md`](docs/data-format.md)                                                                                   |
| **Skill: `southern-mekong-vietnamese-dialect`** ([`skills/`](skills/southern-mekong-vietnamese-dialect)) | Makes an agent write authentic Southern / Mekong Delta Vietnamese: rules, a dictionary generated from `data/`, and a checker that flags *ạ*, *vâng* and Northern words |
| **Skill: `vietnamese-natural-writing`** ([`skills/`](skills/vietnamese-natural-writing)) | Makes Vietnamese text read like a person wrote it: writing modes, techniques from four Vietnamese authors, and a checker for machine-like patterns                |
| **Scripts** ([`scripts/`](scripts))                                                      | `validate`, `build` (skill dictionary + the JSON API, see [`docs/api.md`](docs/api.md)), `dict` (find / add / pending), Wiktionary import                                                    |
| **JSON API** ([`docs/api.md`](docs/api.md))                                              | Static JSON for sites, agents and RAG: a 42 KB search index, one file per entry, region bundles, JSON Schemas. Served at `dialect.vnol.net/api/v1/` once deployed |

Planned: the dialect.vnol.net portal (search, prompt playground, contribution form; built in vnol.net-landing-pages on top of the JSON API), an MCP server, north–south mappings, and Central and Northern regions.

## Example entry

Each sense says *where* and *how* a word is used, not only what it means. [`data/entries/b/bieeur.yaml`](data/entries/b/bieeur.yaml), abridged:

```yaml
spelling: biểu
etymologies:
  - type: variant                     # a sound variant of bảo
    of: bảo
    sound_change: {pattern: ao → iêu, compare: [[cáo, kiếu], [đào, điều]]}
    pos:
      - pos: verb
        senses:
          - gloss: {vi: Bảo, en: to tell}
            region: [south, south-central]
            standard: [bảo]
            examples:
              - {text: "Ê cu, lại đây tao biểu!", en: "Come here for a sec boy, I have something to tell you."}
            topics: [actions]         # included in the agent skill's dictionary
            sources: [skill-dictionary-v1, {id: wiktionary, url: "https://en.wiktionary.org/wiki/biểu"}]
```

## Repository layout

```text
dialect-v0/
├── data/
│   ├── entries/<letter>/<telex>.yaml   # one file per spelling (biểu → b/bieeur.yaml)
│   ├── regions.yaml · topics.yaml · sources.yaml
│   └── nguon-tu-dien.md                # notes for finding and verifying new words
├── schema/entry.schema.json
├── skills/
│   ├── southern-mekong-vietnamese-dialect/   # references/ dictionary is generated: don't edit by hand
│   └── vietnamese-natural-writing/
├── scripts/                            # TypeScript, run directly by Node ≥ 22.18
└── docs/                               # PRD, data format, Wiktionary import review list
```

## Using the skills

Copy a folder from [`skills/`](skills) into your agent's skills directory (for Claude Code: `~/.claude/skills/` or `.claude/skills/` in a project). Each skill is self-contained and needs only Python 3 for its scripts.

## Contributing

You don't need academic credentials. Native speakers' knowledge of everyday usage is exactly what this project needs.

```bash
npm install
npm run dict -- find "xuồng"                         # is the word there already?
npm run dict -- add "mưa dông" "Mưa to kèm sấm sét" --topic weather-orchards \
  --example "Chiều nay mưa dông lớn lắm nghen" --source <id>
npm run dict -- pending                              # senses waiting for a source
npm run validate && npm run build                    # then commit data/ and the regenerated skill files
```

A sense is **verified** once it has two independent sources (see [`data/sources.yaml`](data/sources.yaml)). Write glosses and examples in your own words: books still under copyright can be cited to verify a word but not copied.

Every pull request runs CI: schema and file-name validation, a check that the generated skill files are up to date, type-checking, and both skills' tests.

**No binary files in Git.** Audio files (`.mp3`, `.wav`) are not accepted in this repository. Pronunciation audio is stored externally (e.g. Cloudflare R2, managed with voice.vnol.net), and entries link to it by URL.

[`docs/wiktionary-import-review.md`](docs/wiktionary-import-review.md) lists 89 words where an existing sense sits next to Wiktionary's; merging duplicates there is a good first contribution.

## Roadmap

- **Phase 1: Mekong & Southern (MVP).** Schema ✓, dataset seeded ✓ (verification ongoing; target 1,500+ verified entries), build pipeline for `SKILL.md` and JSON bundles ✓, web portal.
- **Phase 2: Cross-regional mapping & TTS.** North–south mappings, plus pronunciation audio linked with [voice.vnol.net](https://voice.vnol.net).
- **Phase 3: Multi-region expansion.** Community maintainers for Central (*Huế, Quảng, Nghệ*) and Northern sub-dialects.

## License

The planned licensing is:

- **Dataset and lexicon** (`data/`, and the skills' prose and references in `skills/`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with attribution to VN OpenLab
- **Code** (`scripts/`, `skills/*/scripts/`, `schema/`, `web/`): [MIT](https://opensource.org/licenses/MIT)

The dataset includes material from [English Wiktionary](https://en.wiktionary.org/), available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); each imported sense links to its source page.

License files will be added along with the first release.
