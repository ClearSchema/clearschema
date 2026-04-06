---
date: 2026-04-06
topic: post-v07-strategic-direction
focus: open-ended
---

# Ideation: ClearSchema Post-v0.7.0 Strategic Direction

## Codebase Context

- **ClearSchema** v0.7.0 — TypeScript DSL compiling to JSON Schema, TypeScript, Pydantic, OpenAPI, Zod, and LLM structured output schemas
- Multi-package repo: core (`clearschema/`), LSP (`clearschema-lsp/`), VS Code extension (`vscode-clearschema/`), playground (`playground/`), website (`website/`)
- 502 tests across 23 suites, zero runtime deps, hand-written recursive descent parser
- Recent: Zod-style constraint modifiers (min/max/gt/lt), range/exclusiveRange shorthands, type validation for constraints
- All 7 ideas from the April 4 ideation are complete (CI/CD, npm publish, playground, LLM exporter, LSP, Zod exporter, reverse importer, map type)
- **Pre-adoption phase**: zero GitHub issues, no external user signal yet
- Gaps: package.json version drift (0.3.0 vs 0.7.0), no npm workspaces, coverage artifacts in git
- No institutional learnings documented (no docs/solutions/)

## Ranked Ideas

### 1. AI-Native Schema Tool (Positioning + MCP Server + @example Directive)
**Description:** Reposition ClearSchema as the schema layer for LLM structured output across providers (OpenAI, Anthropic, Google). Add an MCP server exposing compile/validate/import as agent-callable tools. Add `@example` inline values that propagate to all exporters — critical for LLM few-shot guidance.
**Rationale:** Uncontested niche. Every AI SDK team hand-writes provider-specific JSON Schema. The LLM exporter already exists; the missing pieces are positioning (free), MCP integration (thin wrapper over existing programmatic API), and @example (one AST field). Combined, these make ClearSchema discoverable by the fastest-growing developer segment. The LLM examples already in `examples/` prove this use case is present but not marketed.
**Downsides:** Risks pigeonholing as "AI-only." Provider requirements shift. MCP is still early-stage.
**Confidence:** 85%
**Complexity:** Medium (three small pieces, not one big one)
**Status:** Unexplored

### 2. Intelligent Schema Editor (Target-Aware Linter + Rich LSP Hover)
**Description:** Surface target-specific constraint warnings as LSP diagnostics ("format: email is stripped by LLM exporter"). Extend hover to show all 6 exporter outputs for the field under cursor. One coherent "smart editor" feature built on existing LSP infrastructure.
**Rationale:** Structurally unique — only possible because ClearSchema has a unified AST across targets. The LSP already has hover.ts and diagnostics.ts. The LLM exporter already emits warnings for unsupported constraints. ARCHITECTURE.md Decision 4 explicitly envisioned this ("Linter warns about incompatibilities") but it was never implemented. Most demo-able, screenshot-able differentiator available.
**Downsides:** Requires building per-exporter capability metadata. Hover output could be noisy with 6 targets.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 3. Discriminated Unions / Conditional Schemas
**Description:** Add first-class syntax for tagged unions (discriminator field) and conditional field presence. Export to JSON Schema `if/then/else`, OpenAPI `discriminator`, Zod `z.discriminatedUnion()`, TypeScript discriminated unions.
**Rationale:** Language completeness gap, not a feature add. The importer already warns on `if/then/else` as unsupported — this is a known, explicitly-punted gap (ARCHITECTURE.md Non-Goals). Real-world API schemas (payment methods, event payloads, LLM tool results) almost always need discriminated unions. Without this, ClearSchema can't faithfully represent many schemas, making the reverse importer lossy.
**Downsides:** Grammar and parser changes required. Must handle across all 6+ exporters consistently. Design challenge in finding clean DSL syntax for conditionals.
**Confidence:** 78%
**Complexity:** High
**Status:** Explored (brainstorm 2026-04-06)

### 4. Schema Diffing & Breaking-Change Detection
**Description:** `clearschema diff old.clear new.clear` comparing two schemas and categorizing changes as breaking/compatible per target. Output as text, JSON, or CI annotations. The multi-target AST enables per-target diff ("breaking in Pydantic, compatible in TypeScript") that is structurally impossible without ClearSchema's central representation.
**Rationale:** Transforms ClearSchema from "schema compiler" to "schema governance tool" — a stickier, higher-value category. Strongest consensus signal across ideation agents (5/6 independently proposed it). Standard in schema registry tools (Confluent, Buf) but absent from lightweight DSL tools.
**Downsides:** Most valuable after teams have schemas under active maintenance — could be premature pre-adoption. Compatibility classification rules are nuanced.
**Confidence:** 72%
**Complexity:** Medium
**Status:** Unexplored

### 5. Watch Mode + Multi-File Batch Compilation
**Description:** `clearschema compile 'schemas/**/*.clear' -f typescript -o types/` with `--watch` flag. Dependency graph tracks imports for incremental rebuilds — only changed files and their dependents are re-emitted.
**Rationale:** Table-stakes DX for any file-based DSL. A developer evaluating the tool who must re-run the CLI manually after every save will bounce. The resolver already builds an import graph; watch mode is a small lift with outsized first-impression impact. The existing `--watch` concept was deferred in the initial ideation as a subtask — now unblocked.
**Downsides:** Undifferentiated — every build tool has this. Creates no lock-in.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 6. Constraint Propagation Warnings
**Description:** Detect logically impossible constraint combinations at parse time: `min > max`, `exclusiveRange` with equal bounds, `enum` with single value that should be `const`, conflicting constraints across composition types. Surface as parser warnings with source locations.
**Rationale:** v0.7.0 already validates constraint types (rejecting `min` on boolean). Cross-constraint logic is the natural next step. Low cost, high quality signal. Makes the tool feel intelligent — "ClearSchema knows your schema better than you do." Reinforces the brand as a tool that catches errors early.
**Downsides:** Edge cases in composition types. Must not over-warn on intentional patterns.
**Confidence:** 88%
**Complexity:** Low
**Status:** Unexplored

### 7. TypeScript Reverse Importer
**Description:** `clearschema import --from typescript types.ts` parsing interface/type alias declarations into .clear files using the TypeScript compiler API (already a devDep).
**Rationale:** The JSON Schema importer proves the architecture. TypeScript is the dominant language in the target audience. Removes the blank-page barrier: import existing types, get JSON Schema + Pydantic + Zod + LLM schema for free. This is an onramp, not a feature — it converts "I'd have to rewrite everything" into "point at your types.ts."
**Downsides:** TypeScript types can be arbitrarily complex (generics, conditional types, mapped types). Must scope to interface/type alias only. TypeScript compiler API adds weight.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Exporter Plugin API | Premature — no community to produce plugins yet |
| 2 | Programmatic Builder API | Competes with ClearSchema's core DSL identity; imitates Zod |
| 3 | Zero-Dep Runtime Validator | Zod exporter already covers this; niche concern pre-adoption |
| 4 | Schema Registry / Remote Imports | Infrastructure for zero users; classic pre-adoption trap |
| 5 | GraphQL Support | Mature existing ecosystem; poor conceptual fit; dilutes focus |
| 6 | WASM Build | Speculative infra; playground already runs in browser |
| 7 | Self-Hosting / Dogfooding | Zero external value; cosmetic confidence exercise |
| 8 | Schema Versioning / @deprecated | Governance for teams that don't exist yet |
| 9 | JSON Sample Inference | Lossy heuristics; quicktype already does this well |
| 10 | Pydantic v2 Importer | Indirect path (Pydantic → JSON Schema → ClearSchema) already works |
| 11 | Incremental Parser | Schema files are small; full re-parse is fast enough |
| 12 | Playground Hover Docs | Redundant with LSP; maintenance overhead of duplicating hover logic |
| 13 | Rust/Go/C# Exporters | Maintenance burden without adoption signal; different product category |
| 14 | Inline Doc Comments | Overlaps with @example directive; current description syntax adequate |
| 15 | Project Manifest / Config | Presupposes multi-file projects that don't exist yet |
| 16 | Test Data / Fixture Generator | Crowded space (faker, json-schema-faker); no differentiation |
| 17 | Ecosystem Platform (combo) | Plugin API + Registry = press release without a product |
| 18 | Governance Suite (combo) | Enterprise framing wrong for pre-adoption stage |
| 19 | Schema Build System (combo) | Bundling hygiene with differentiation dilutes the unique parts |

## Session Log
- 2026-04-06: Fresh open-ended ideation — 48 generated, 7 survived
- 2026-04-06: Selected #3 (Discriminated Unions) for brainstorm — 48 generated (6 agents × 8), deduped to 26 unique + 5 cross-cutting combos = 31 evaluated, 7 survived. Two adversarial critics (pragmatism + differentiation angles). Key theme: pre-adoption stage demands ideas that drive discovery and first-use, not governance or infrastructure.
