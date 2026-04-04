---
date: 2026-04-04
topic: general-improvement
focus: this project in general
---

# Ideation: ClearSchema General Improvement

## Codebase Context

**Corrected after thorough verification (initial scan was inaccurate):**

- **ClearSchema** is a TypeScript DSL that compiles to JSON Schema, TypeScript, Pydantic, and OpenAPI
- **All 4 exporters are implemented and working** (json-schema.ts, typescript.ts, pydantic.ts, openapi.ts)
- **CLI exists and works** (src/cli/index.ts with -f format, -o output, --schema-version flags, bin entry in package.json)
- Hand-written recursive descent lexer/parser, zero runtime deps, 232 tests at 93%+ coverage across 16 test files
- VS Code extension with syntax highlighting for .cs and .clearschema
- Cross-file imports and $ref/$defs composition already supported
- Resolver module handles import and reference resolution
- All 8 roadmap phases genuinely complete at v0.2.0
- Comprehensive docs: ARCHITECTURE.md, GRAMMAR.md (EBNF), TESTING.md, 8 phase docs, CONTRIBUTING.md, CHANGELOG.md

**Actual gaps:**
- No CI/CD pipeline (no GitHub Actions)
- Coverage artifacts (lcov-report/, lcov.info) committed to repo
- .cs file extension collides with C#
- Not published to npm
- No author field in package.json
- No CLAUDE.md/AGENTS.md
- No LSP (VS Code extension is syntax highlighting only)
- No browser playground
- No watch mode in CLI
- No reverse importer (JSON Schema -> ClearSchema)
- No map/dictionary type support
- No runtime validator exporter (e.g., Zod)

## Ranked Ideas

### 1. Ship-Ready Bundle: CI/CD + npm Publish + .cs Rename
**Description:** Add GitHub Actions CI (test gating, coverage threshold, lint), automate npm publish-on-tag, rename `.cs` to `.cschema` before first publish, remove committed coverage artifacts, fill in package.json author field. One coordinated push to make the project installable and professional.
**Rationale:** Nothing else matters if people can't `npm install clearschema`. CI, npm presence, and a non-colliding extension are table stakes that gate every other improvement. The .cs rename is time-sensitive -- free now, expensive after npm publish.
**Downsides:** Moderate effort across multiple files. Extension rename touches parser, CLI, VS Code extension, examples, tests, and docs.
**Confidence:** 95%
**Complexity:** Medium
**Status:** Unexplored

### 2. Browser Playground with Shareable URLs
**Description:** Ship a single-page web app (GitHub Pages) with ClearSchema input on the left, live output on the right with format tabs (JSON Schema / TypeScript / Pydantic / OpenAPI), inline error highlighting, and shareable URLs.
**Rationale:** Zero runtime deps + pure TypeScript = parser runs in browser with no WASM. Eliminates install friction entirely, serves as living documentation, and is the #1 adoption tool for every successful DSL.
**Downsides:** Requires building and maintaining a web frontend. Must stay in sync with the core library.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 3. Target LLM Structured Output as the Wedge Use Case
**Description:** Reposition ClearSchema as the fastest way to author structured output schemas for LLM APIs (OpenAI, Anthropic, Google). Add an `llm-schema` exporter emitting the exact JSON Schema subset each provider accepts.
**Rationale:** LLM structured output is an exploding use case where developers hand-write JSON Schema constantly. The schemas are moderately complex, the pain is fresh, and no tool targets this niche.
**Downsides:** Risks pigeonholing. Provider requirements change frequently.
**Confidence:** 72%
**Complexity:** Medium
**Status:** Unexplored

### 4. LSP Server for Editor Intelligence
**Description:** Build an LSP providing real-time diagnostics, type/modifier autocomplete, hover-to-preview-output, and go-to-definition for cross-file $ref and imports. Wire into the existing VS Code extension.
**Rationale:** Parser already emits structured errors with line/column, resolver already tracks cross-file imports. Hover-to-preview (write ClearSchema, hover to see generated JSON Schema) is a killer demo.
**Downsides:** Significant implementation effort. Must handle partial/invalid input gracefully.
**Confidence:** 78%
**Complexity:** High
**Status:** Unexplored

### 5. Zod/Runtime Validator Exporter
**Description:** Add a fifth exporter that emits Zod schemas from ClearSchema, giving TypeScript teams both static types and runtime validation from a single source of truth.
**Rationale:** The TypeScript exporter generates types erased at runtime. Teams pair TS types with Zod for validation and keeping them in sync is painful. One `.cschema` file producing both `types.ts` and `validators.ts` is the strongest "why ClearSchema?" pitch. The Pydantic exporter already proves this pattern works.
**Downsides:** Adds a runtime dependency concern (Zod as peer dep). Must track Zod API changes.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 6. JSON Schema Reverse Importer
**Description:** Build `clearschema import schema.json` that reads existing JSON Schema and emits idiomatic `.cschema` files. Enable one-command adoption on existing projects.
**Rationale:** The cold-start problem is the biggest DSL adoption barrier. The JSON Schema exporter already encodes the full AST-to-JSON-Schema mapping -- the reverse is mechanically derivable.
**Downsides:** JSON Schema is extremely permissive -- some valid schemas won't have clean ClearSchema equivalents.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 7. Map/Dictionary Type Support
**Description:** Add a first-class `map<string, V>` type that compiles to JSON Schema `additionalProperties`, TypeScript `Record<K, V>`, and Pydantic `Dict[str, V]`.
**Rationale:** Every API has metadata fields, headers, tags, or labels that are string-keyed maps. This is the most common type power users will reach for and find missing. Currently no way to express this without workarounds.
**Downsides:** Requires grammar and parser changes. Must handle across all 4+ exporters consistently.
**Confidence:** 82%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Watch mode / incremental compilation | Nice CLI feature, not strategic -- subtask of ship-ready work |
| 2 | Multi-file batch compilation | CLI enhancement, subsumed by ship-ready work |
| 3 | Schema constraint validation | Good engineering, not a top strategic idea |
| 4 | CLAUDE.md | Useful but minor |
| 5 | Schema composition stdlib | Premature -- needs adoption first |
| 6 | Programmatic builder API | Niche use case |
| 7 | Pluggable exporter registry | Premature -- 4 exporters don't need a plugin system |
| 8 | AST source maps | Niche power-user feature |
| 9 | Schema diffing/migration | High value but premature for project maturity |
| 10 | Fuzz testing | Engineering practice, not a product idea |
| 11 | Stdin pipe mode / glob support | CLI detail, part of ship-ready work |
| 12 | Inline @test blocks | Novel but niche |
| 13 | Streaming/incremental parse | Premature -- subsumed by LSP work |
| 14 | AST-preserving roundtrip | Foundation for reverse importer, not standalone |
| 15 | oneOf/anyOf/allOf combinators | Already supported in the DSL |
| 16 | Type-checked defaults/examples | Nice feature but not top-tier |
| 17 | API client stub generation | Too ambitious, blurs project identity |
| 18 | Raw JSON Schema passthrough | Valid but niche escape hatch |
| 19 | Bidirectional defaults | Feature, not strategic direction |

## Session Log
- 2026-04-04: Initial ideation -- 48 generated (6 agents x 8), inaccurate grounding led to "Credibility Reset" as #1
- 2026-04-04: Re-ran ideation with verified codebase context -- all claimed features confirmed implemented. 48 new ideas generated, 26 unique + 3 cross-cutting = 29 evaluated, 7 survived. Corrected ranked list reflects actual project state.
