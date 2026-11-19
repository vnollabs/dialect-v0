# Data format

Everything under `data/` is the source of truth, and the only one in Git. The agent skill's dictionary, the packaged skills and the JSON bundle are generated from it by `npm run build` and are not committed.

```text
data/
├── entries/<letter>/<telex>.yaml   one file per spelling
├── regions.yaml                    region ids (south, mekong-delta, south-central, …)
├── topics.yaml                     topic ids = groups of the skill dictionary
├── sources.yaml                    source ids, and which sources copy each other
└── nguon-tu-dien.md                notes for finding new words (sources read, unreadable, not to use)
schema/entry.schema.json            JSON Schema every entry must pass
```

## One file per spelling

A file holds everything spelled one way, the way a Wiktionary page does. Its name is the spelling typed in [Telex](https://vi.wikipedia.org/wiki/Telex_(ki%E1%BB%83u_g%C3%B5)), with the tone key at the end of each syllable:

| Spelling | File                              |
|:---------|:----------------------------------|
| biểu     | `data/entries/b/bieeur.yaml`      |
| lẩu mắm  | `data/entries/l/laaur-mawms.yaml` |
| đâu có   | `data/entries/d/ddaau-cos.yaml`   |

Telex keeps words that differ only by tone apart (*lâu, lầu, lẩu, lậu*), and ASCII names behave the same on macOS, Windows and Linux. Three extra rules keep loanwords out of another word's file and keep every name usable on Windows:

- A letter Telex would read as a mark on the letter before it is written after `_`: *xoong* → `x/xo_ong.yaml`, because *xông* is `x/xoong.yaml`. The same goes for *boong*, *soóc* (`so_ocs`), *moóc* and *goòng*.
- A syllable without a tone that ends in s, f, r, x, j or z gets Telex's "no tone" key `z`: *bas* → `basz`, because *bá* is `bas`.
- A name Windows reserves for a device (con, nul, aux, prn, com0–9, lpt0–9) gets a trailing `_`, or Git for Windows can't check it out: *con* → `c/con_.yaml`.

You never need to work the name out yourself: `npm run dict -- add` creates the file, and `npm run validate` reports a file whose name doesn't match its spelling.

Spellings are lowercase except proper nouns. When a proper noun and a common word share a file (*Nhựt*, a given name, and *nhựt* = *nhật*), the proper noun's block sets `head: Nhựt`.

## Structure

```text
spelling
pronunciation[]         only checked exceptions: ipa, region, sources (see below)
etymologies[]           unrelated words spelled the same (the book's homograph numbers)
  type, lang, of, han, source_form, sound_change, note, derived
  pos[]                 part-of-speech blocks
    pos, head, han_nom, classifiers, alt_forms
    senses[]
      gloss {vi, en}    at least one
      region[]          required
      qualifier, labels, standard, variant_of, synonyms, examples[], topics, ai, sources, note
```

A full example, `data/entries/b/bieeur.yaml`:

```yaml
spelling: biểu
etymologies:
  - type: variant                 # biến âm of another word
    of: bảo
    sound_change:
      pattern: ao → iêu
      compare:                    # other pairs with the same change
        - [cáo, kiếu]
        - [đào, điều]
    note:
      en: Variant of bảo. Compare cáo vs. kiếu, đào vs. điều. …
    pos:
      - pos: verb
        han_nom: [𠶓]
        senses:
          - gloss:
              vi: Bảo
              en: to tell
            region: [south, south-central]
            standard: [bảo]       # đối chiếu: the standard word
            variant_of: bảo
            synonyms: [nói]
            examples:
              - text: Ê cu, lại đây tao biểu!
                en: Come here for a sec boy, I have something to tell you.
            topics: [actions]     # included in the skill dictionary, group "Hành động"
            sources:
              - skill-dictionary-v1
              - id: wiktionary
                url: https://en.wiktionary.org/wiki/bi%E1%BB%83u#Vietnamese
```

## Fields worth knowing

| Field                | Where     | Meaning                                                                                                                                                  |
|:---------------------|:----------|:---------------------------------------------------------------------------------------------------------------------------------------------------------|
| `etymologies[].type` | etymology | `native` (thuần Việt), `sino` (Hán Việt, set `han`), `loan` (set `lang`, `source_form`), `variant` (biến âm, set `of`), `compound`                       |
| `derived`            | etymology | Words formed from *this* etymology. *Biểu đồ* belongs to 表, not to the Southern *biểu* = *bảo*, so it is not listed here                                |
| `pos`                | block     | wiktextract codes: `noun`, `verb`, `adj`, `adv`, `pron`, `particle`, `intj`, `phrase`, … Leave it out when unsure; `validate` counts unclassified senses |
| `head`               | block     | Display form when it differs from the spelling: `… coi` for the sentence-final particle                                                                  |
| `classifiers`        | block     | Loại từ: `cái`, `con`, `trái`, `tờ`                                                                                                                      |
| `region`             | sense     | Narrowest region the sources support, from `data/regions.yaml`                                                                                           |
| `standard`           | sense     | Standard-Vietnamese equivalent (*đắt* for *mắc*). Different from `variant_of`, which says the word is a sound variant of another (*biểu* of *bảo*)       |
| `labels`             | sense     | Usage labels: `colloquial`, `slang`, `dated`, `figurative`, `vulgar`, … (full list in the schema)                                                        |
| `topics`             | sense     | Puts the sense in the agent skill's dictionary, under the first topic. Needs `gloss.vi`. A word is listed there once: its senses with other topics join the same line |
| `ai`                 | sense     | Guidance for agents: `tone`, `register`, `relationship`, `usage_notes`                                                                                   |
| `examples[].ai_draft` | sense    | `true` on examples written by AI and not yet reviewed by a person. The skill dictionary leaves them out until reviewed                                    |
| `sources`            | sense     | Source ids from `data/sources.yaml`, or `{id, url, note}`                                                                                                |

## Sources and verification

A sense is **verified** with two independent sources, **pending** with one, **unsourced** with none. It's computed, not stored:

- Sources that copy another set `same_as` in `data/sources.yaml` and count once (scr.vn copies nghengu.vn).
- `skill-dictionary-v1` only records where a sense came from (`counts: false`). The old skill dictionary kept no per-word sources, so those senses start unsourced.
- A native speaker's confirmation counts: cite `contributor` with a dated note, never a name.
- Copyrighted books (e.g. Huỳnh Công Tín's *Từ điển từ ngữ Nam Bộ*) can be cited to verify a word, but their definitions and quotations must not be copied in: write glosses and examples in your own words.

```bash
npm run dict -- pending --status pending     # waiting for a second source
npm run dict -- pending --status unsourced
```

## Everyday commands

```bash
npm run dict -- find "dọc mùng"
npm run dict -- topics
npm run dict -- add "mưa dông" "Mưa to kèm sấm sét" --topic weather-orchards \
  --example "Chiều nay mưa dông lớn lắm nghen" --source <id>
npm run dict -- drafts  # AI-drafted examples awaiting review
npm run validate        # schema, file names, NFC, ids, skill dictionary
npm run build           # regenerate the skill dictionary, the packaged skills in dist/skills and the JSON API in dist/public (docs/api.md)
```

`add` refuses a word that already has a file unless `--new-sense` says it's a different meaning; to improve an existing sense, edit the file. `--new-sense` adds the meaning unclassified, in a block without a part of speech under an etymology without origin data, so it doesn't inherit another meaning's; an editor classifies it later. It refuses a meaning the skill dictionary couldn't list, because the word already sits there in a line with synonyms or a qualifier; add that one by hand without `topics`. It leaves the rest of the file, comments included, as it was. Any editor works for other changes. `validate` catches what the schema doesn't (wrong file name, unknown ids, text not in NFC).

## Reviewing AI-drafted examples

Senses that had no example got one drafted by AI, marked `ai_draft: true`. Native speakers review them in later pull requests:

```bash
npm run dict -- drafts                       # every draft awaiting review
npm run dict -- drafts --topic food-drink   # one topic at a time
```

For each draft, check that it uses the word in *this* sense, sounds like a real Southern speaker, and says nothing untrue. Then fix the sentence (and its `standard` rendering) or delete the example, and remove `ai_draft: true`. A reviewed example is a usage illustration, not a source: it doesn't change a sense's verification status.

## Wiktionary

`npm run import:wiktionary` seeded the data from the [kaikki.org](https://kaikki.org/dictionary/Vietnamese/) dump of English Wiktionary (CC BY-SA 4.0). It is a seed, not a sync: spellings that already cite Wiktionary are skipped on re-runs. Merging rewrites a whole file, so a file with comments is skipped too and listed for merging by hand. Every imported sense keeps its page URL in `sources` for attribution.

## Pronunciation

Vietnamese spelling predicts pronunciation by rule, so regular pronunciations are not stored: a custom IPA tool will generate them for each region (roadmap #28). `pronunciation` holds only what the rules can't predict, checked by ear with a speaker or a recording:

```yaml
pronunciation:
  - ipa: "[…]"                    # square brackets: phonetic transcription
    region: [mekong-delta]
    sources:
      - {id: contributor, note: "ghi âm người Cần Thơ, 2026-11-20"}
```

Don't copy IPA from Wiktionary: its `{{vi-IPA}}` template computes it from the spelling, so it is not a checked transcription. Audio stays out of Git (PRD §6).

## YAML pitfalls

- Files are read as YAML 1.2, where `no` (as in *ăn no*) is a word. Older parsers such as PyYAML read it as `false`, and read `1:20` as 80 and `2024-01-01` as a date. The scripts quote such text when they write files; quote it yourself if you edit by hand (`spelling: "no"`).
- Keep text in NFC. Most editors do; `validate` reports text that isn't.
