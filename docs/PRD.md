# Product Requirements Document (PRD): VN Dialect

| Metadata            | Details                                                                   |
|:--------------------|:--------------------------------------------------------------------------|
| **Project Name**    | **VN Dialect** (Flagship Release: *Mekong & Southern Vietnamese Dialect*) |
| **Organization**    | VN OpenLab (`vnol.net`)                                                   |
| **Domain / URL**    | `https://dialect.vnol.net`                                                |
| **Repository**      | `https://github.com/vnollabs/dialect-v0.git` (Monorepo Architecture)      |
| **Document Status** | Draft v1.0                                                                |
| **Target Audience** | AI/LLM Engineers, Prompt Engineers, Open-Source Contributors, Linguists   |

---

## 1. Executive Summary

### 1.1 Background & Problem Statement
Large Language Models (LLMs) and AI Agents predominantly default to standardized Northern Vietnamese (Hanoi dialect) due to the distribution of pre-training web corpora. When tasked with generating conversational responses, localized customer support, or creative content tailored to Southern Vietnam—specifically the Mekong Delta (*Tây Nam Bộ*) and Southeast (*Đông Nam Bộ*)—AI agents frequently:
* Hallucinate or misuse regional idioms and slang.
* Mix regional vocabularies inconsistently within the same conversation (e.g., combining Northern honorifics like *"ạ"* with Southern pronouns like *"tui"*).
* Fail to capture nuanced social registers, warmth, and cultural context inherent to Southern communication.

Traditional regional dictionaries (e.g., printed/PDF lexicons) are designed for human reading and historical preservation. They lack machine-readable schemas, pragmatic context tags, and cross-regional mapping required for automated consumption by AI systems.

### 1.2 Vision & Product Goal
**VN Dialect** is an open-source, machine-first lexical infrastructure and dataset ecosystem under **VN OpenLab**. 

* **Primary Goal:** Build a structured, context-rich lexicon starting with **Mekong & Southern Vietnamese** as the flagship release, enabling AI agents to comprehend, reason about, and naturally generate authentic regional speech.
* **Scalability Goal:** Establish a unified monorepo schema that allows seamless future expansion into Central (*Miền Trung*) and Northern (*Miền Bắc*) dialects, complete with cross-regional semantic mappings.

---

## 2. Target Users & Use Cases

| User Persona               | Core Needs                                                                       | Primary Use Cases                                                                                                       |
|:---------------------------|:---------------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------------------------------|
| **AI Agent Builders**      | Low-token, high-density context rules and clean JSON/Markdown outputs.           | Injecting `SKILL.md` or System Prompts into conversational bots (e.g., Southern customer service, virtual tour guides). |
| **NLP / ML Engineers**     | Standardized, validated datasets with clear licensing and metadata.              | Fine-tuning local LLMs, building RAG pipelines, or evaluating dialect comprehension benchmarks.                         |
| **Voice AI Developers**    | Phonetic hints and text-normalization rules (integrating with `voice.vnol.net`). | Ensuring TTS (Text-to-Speech) models pronounce regional spelling variations naturally.                                  |
| **Community Contributors** | Low-friction contribution workflows without needing deep academic credentials.   | Submitting local words, usage examples, and regional nuances via GitHub PRs or Web UI.                                  |

---

## 3. Product Scope & Roadmap

### Phase 1: Flagship Release — Mekong & Southern Dialect (MVP)
* **Focus:** Mekong Delta (*Tây Nam Bộ*) core vocabulary, pronouns, particles, idioms, and broader Southern (*Nam Bộ / Sài Gòn*) urban usage.
* **Deliverables:**
  * Standardized JSON Schema (`entry.schema.json`).
  * Initial curated dataset ($\ge 1,500$ high-frequency entries).
  * Automated build pipeline generating AI-ready `SKILL.md` files and lightweight JSON bundles.
  * Public web portal at `dialect.vnol.net` for browsing, searching, and testing agent prompts.

### Phase 2: Cross-Regional Mapping & TTS Integration
* **Focus:** Semantic mapping between Southern and Standard/Northern Vietnamese.
* **Deliverables:**
  * `mappings/north-south.json` translation/equivalence tables.
  * Audio pronunciation integration linked with `voice.vnol.net` (hosted externally via Cloud Storage).

### Phase 3: Multi-Region Expansion
* **Focus:** Onboarding community maintainers for Central (*Huế, Quảng, Nghệ*) and Northern regional sub-dialects under the same monorepo architecture.

---

## 4. Technical Architecture & Data Design

### 4.1 Monorepo Structure (`vnollabs/dialect-v0`)
A single repository holds all regional data, the schema and the build scripts, so cross-regional checks run on everything. Region is a field on each sense, not a folder: one word is often used in several regions.

```text
dialect-v0/
├── schema/
│   └── entry.schema.json        # JSON Schema for one entry file
├── data/                        # Source of truth (YAML, edited by hand or with `npm run dict`)
│   ├── entries/<letter>/<telex>.yaml   # One file per spelling, all regions
│   ├── regions.yaml             # Region ids: south, mekong-delta, south-central, north, …
│   ├── topics.yaml              # Topic ids (groups of the agent skill's dictionary)
│   ├── sources.yaml             # Source ids; copies (same_as) count once
│   └── nguon-tu-dien.md         # Notes for finding and verifying new words
├── skills/                      # Agent skills (SKILL.md + references + scripts)
│   ├── southern-mekong-vietnamese-dialect/   # Dictionary in references/ is generated from data/
│   └── vietnamese-natural-writing/
├── scripts/                     # TypeScript, run directly by Node ≥ 22.18
│   ├── validate.ts              # Schema, file names, NFC, ids (CI)
│   ├── build.ts                 # Skill dictionary + dist/lexicon.json; --check for CI
│   ├── dict.ts                  # find / add / pending / topics
│   └── import-wiktionary.ts     # Seed from the kaikki.org dump of Wiktionary
├── docs/
│   ├── PRD.md
│   └── data-format.md           # Contributor guide to the entry format
└── web/                         # [Future] Source code for dialect.vnol.net
```

Source files are YAML (readable Vietnamese prose, comments, small diffs); every published artifact is JSON or Markdown generated from them. One file per spelling keeps pull requests from conflicting and gives each word its own history. File names are the Telex spelling (`biểu` → `bieeur.yaml`), which keeps words that differ only by tone apart and avoids NFC/NFD file-name problems across operating systems.

### 4.2 AI-Centric Lexical Entry Schema
The entry model follows the structure of full dialect dictionaries (e.g. Huỳnh Công Tín's *Từ điển từ ngữ Nam Bộ*) and of Wiktionary, so entries can be imported from Wiktionary and grow to a full dictionary: a spelling holds etymologies (unrelated words spelled the same), each with part-of-speech blocks, each with senses. **Pragmatic usage lives on the sense** (region, labels, standard equivalent, examples, `ai` guidance), so an LLM knows *when* and *how* to use each meaning. Full guide: [`docs/data-format.md`](data-format.md).

```yaml
# data/entries/b/bieeur.yaml (abridged; the `ai` block is added here to show the field)
spelling: biểu
etymologies:
  - type: variant
    of: bảo
    sound_change: {pattern: ao → iêu, compare: [[cáo, kiếu], [đào, điều]]}
    pos:
      - pos: verb
        han_nom: [𠶓]
        senses:
          - gloss: {vi: Bảo, en: to tell}
            region: [south, south-central]
            standard: [bảo]
            variant_of: bảo
            examples:
              - {text: "Ê cu, lại đây tao biểu!", en: "Come here for a sec boy, I have something to tell you."}
            topics: [actions]
            ai: {register: informal, usage_notes: "Pair with tao/mày or anh/em; never with Northern 'ạ'."}
            sources: [skill-dictionary-v1, {id: wiktionary, url: "https://en.wiktionary.org/wiki/biểu"}]
```

A sense's verification status is computed from its sources: two independent sources make it *verified*, one *pending*, none *unsourced*.

Pronunciation is not stored per entry: Vietnamese spelling predicts it by rule, so a custom IPA tool will generate it per region (Phase 2). Entries keep only pronunciations checked by ear that differ from the rules, each with a source.

---

## 5. Key Functional Requirements

### 5.1 AI Agent Deliverables (Automated Build Outputs)
1. **Modular `SKILL.md` Generators:**
   * Automatically compile high-impact rules (pronoun matrices, sentence-final particles, forbidden word combinations, and top 200 idioms) into concise Markdown files optimized for LLM context windows (e.g., Claude Skills, Cursor Rules, OpenAI Custom GPTs).
2. **REST / Static JSON API:**
   * Expose clean, CDN-cached JSON endpoints (e.g., `https://dialect.vnol.net/api/v1/mekong.json`) for MCP (Model Context Protocol) servers and RAG pipelines.
3. **Style-Guard / Linter Rules:**
   * Provide a list of "anti-patterns" (Northern/unnatural words to avoid when roleplaying Southern characters, e.g., replacing *"lợn"* $\rightarrow$ *"heo"*, *"bát"* $\rightarrow$ *"chén"*, *"vâng"* $\rightarrow$ *"dạ"*).

### 5.2 Web Portal (`dialect.vnol.net`)
1. **Lexicon Explorer:**
   * Fast fuzzy search by dialect term, standard Vietnamese equivalent, or pragmatic tag (e.g., filter by *Pronouns*, *Food*, *Emotion*).
2. **AI Prompt Playground / Preview:**
   * Interactive widget showing side-by-side comparisons of standard LLM output vs. VN Dialect-enhanced output.
   * One-click copy for `SKILL.md` snippets and MCP configuration.
3. **Contribution Interface:**
   * Web form that formats user submissions directly into valid JSON and opens a GitHub Pull Request (for non-technical contributors).

---

## 6. Quality Assurance & Governance

* **Automated CI Checks:** Every Pull Request must pass JSON schema validation, duplicate ID checks, and ensure `ai_usage_notes` or `examples` are present.
* **No Binary Assets in Git:** Audio files (`.mp3`/`.wav`) are strictly prohibited in the Git repository. Audio pronunciation links must reference external object storage (e.g., Cloudflare R2) managed alongside `voice.vnol.net`.
* **Open Licensing:**
  * Dataset & Lexicon: **CC BY-SA 4.0** (ensuring open academic and commercial AI training with attribution to VN OpenLab).
  * Scripts & Web Code: **MIT License**.

---

## 7. Success Metrics (KPIs)

* **Dataset Coverage (Month 3):** $\ge 1,500$ validated Mekong & Southern entries, including 100% coverage of common regional pronouns and sentence-final particles.
* **Developer Adoption (Month 6):** $\ge 200$ GitHub Stars, $\ge 50$ external community PRs, and active integration into at least 3 open-source Vietnamese AI agent frameworks or MCP servers.
* **AI Output Quality:** Measurable reduction in regional vocabulary mixing (validated via blind human evaluation by native Mekong Delta speakers).
```

Bản PRD này được thiết kế theo hướng **Machine-First** (ưu tiên cấu trúc dữ liệu để AI tiêu thụ qua `SKILL.md`, RAG hoặc MCP) và giữ đúng kiến trúc **Monorepo** mở rộng theo từng vùng như bạn đã định hướng. Bạn có thể lưu trực tiếp file này thành `PRD.md` trong thư mục gốc của repo `vn-dialect` để làm tài liệu định hướng cho cộng đồng đóng góp.