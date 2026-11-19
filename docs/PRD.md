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

### 4.1 Monorepo Structure (`vnol/vn-dialect`)
A single repository will house all regional datasets, schemas, and build scripts to enforce data integrity and enable cross-regional validation.

```text
vn-dialect/
├── schema/
│   ├── entry.schema.json        # Core JSON schema for lexical entries
│   └── mapping.schema.json      # Schema for cross-regional word equivalence
├── data/
│   ├── mekong/                  # Flagship: Mekong Delta (Tây Nam Bộ)
│   │   ├── pronouns.json        # High-priority: Xưng hô & đại từ
│   │   ├── particles.json       # High-priority: Tiểu từ tình thái (hen, nghen, đa...)
│   │   └── lexicon-*.json       # Categorized or alphabetical vocabulary
│   ├── south/                   # General Southern / Saigon urban dialect
│   ├── central/                 # [Future] Central dialects
│   └── north/                   # [Future] Northern reference / regionalisms
├── mappings/
│   └── north-south.json         # Equivalence pairs for AI translation/style-transfer
├── skills/                      # Auto-generated artifacts for AI Agents
│   ├── mekong-agent/
│   │   └── SKILL.md             # Ready-to-use prompt instructions & rules
│   └── south-agent/
│       └── SKILL.md
├── scripts/
│   ├── validate.ts              # CI schema & duplicate checker
│   └── build-artifacts.ts       # Compiles raw JSON into minified API/Skills
└── web/                         # Source code for dialect.vnol.net
```

### 4.2 AI-Centric Lexical Entry Schema
Unlike traditional dictionaries, every entry must prioritize **pragmatic usage** so an LLM knows *when* and *how* to use the word.

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