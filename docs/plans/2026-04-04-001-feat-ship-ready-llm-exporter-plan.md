---
title: "feat: Ship-Ready Bundle + LLM Structured Output Exporter"
type: feat
status: completed
date: 2026-04-04
origin: docs/brainstorms/2026-04-04-ship-ready-llm-positioning-requirements.md
---

# feat: Ship-Ready Bundle + LLM Structured Output Exporter

## Overview

Make ClearSchema installable via `npm install @clearschema/core`, add CI/CD, rename the `.cs` extension to `.clear`, and ship a new LLM structured output exporter. This turns a functionally complete but invisible project into a publishable, professional tool with a timely adoption angle.

## Problem Frame

ClearSchema has all 4 exporters working, a CLI, and 232 tests — but is not on npm, has no CI, uses a file extension that collides with C#, and has no clear differentiator. (see origin: `docs/brainstorms/2026-04-04-ship-ready-llm-positioning-requirements.md`)

## Requirements Trace

- R1. Package as `@clearschema/core` at version 0.3.0
- R2. `files` field restricting npm publish to dist/, README.md, LICENSE
- R3. Author: "Darin Chambers"
- R4. `prepublishOnly` script (build + test)
- R4a. CLI version from package.json (not hardcoded "1.0.0")
- R4b. Fix lint script (`--ext .ts` removed in ESLint 9+)
- R5-R8. Rename `.cs` to `.clear`, drop `.cs` entirely, update all references
- R9-R12. GitHub Actions CI + release workflows, coverage hygiene
- R11a. Root .gitignore
- R13-R15. LLM structured output exporter (`-f llm-schema`)
- R14a. Warnings for dropped constraints
- R16. LLM-focused examples
- R17-R20. README updates, use cases section, equal LLM positioning

## Scope Boundaries

- No LSP server, browser playground, Zod exporter, reverse importer, or map type
- No watch mode or batch compilation
- No provider-specific LLM exporters
- VS Code extension changes limited to file associations

## Context & Research

### Relevant Code and Patterns

- **Exporter interface**: `clearschema/src/exporters/types.ts` — `Exporter<T>` with `export(schema, options)` method
- **Exporter pattern**: Class + convenience function. OpenAPI exporter wraps JSON Schema exporter and post-processes — exact precedent for LLM exporter
- **CLI dispatch**: `clearschema/src/cli/index.ts` — if/else chain at lines 139-157, format union type at line 14, validation at line 62
- **Resolver**: `clearschema/src/resolver/resolver.ts` — `resolveReferences()` populates `resolvedRef` on each `RefField`, usable for inline expansion
- **Test pattern**: Inline ClearSchema DSL strings → `parse()` → exporter → `toEqual`/`toMatchObject` assertions
- **Package root**: `clearschema/` (not repo root). CI must use `working-directory: clearschema`

### .cs Rename Blast Radius

~60 occurrences across ~20 files: CLI help text (6), examples (2 files), test fixtures (~10), VS Code extension config (1), docs (~40+). All string literals — no runtime logic depends on the extension.

## Key Technical Decisions

- **CI working directory**: Use `working-directory: clearschema` in GitHub Actions rather than restructuring the repo (see origin: Dependencies)
- **LLM exporter strategy**: Wrap the JSON Schema exporter (like OpenAPI does), then post-process to strip unsupported keywords, inline `$ref` via `resolvedRef`, and add `additionalProperties: false`. This maximizes code reuse and consistency
- **Ref inlining approach**: Call `resolveReferences()` on the AST before export. When visiting a `RefField`, emit the `resolvedRef` content inline instead of a `$ref` pointer. Handle circular refs by erroring (recursive schemas are not supported per R14)
- **Node LTS versions**: Test on 22.x (current) and 20.x (previous)
- **CLI version**: Read from `require('../package.json').version` instead of hardcoding

## Open Questions

### Resolved During Planning

- **Package structure**: Use `working-directory` in CI, no restructuring needed
- **$ref inlining**: Use existing `resolveReferences()` + `resolvedRef` field on RefField nodes
- **Coverage artifacts**: Not tracked in git. Root .gitignore is the only action needed
- **VS Code extension rename**: Only the `extensions` array in package.json needs changing. Grammar scope names (`source.clearschema`) are correct and stay

### Deferred to Implementation

- **Exact nesting depth counting logic**: R14 specifies max 5 levels. The counting strategy (object nesting only vs. all container types) should be determined when writing the exporter
- **Warning format for R14a**: Whether warnings go to stderr, are returned as metadata, or both — determine during implementation based on CLI patterns
- **README layout**: Exact use cases section structure — determine during R19/R20 implementation

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
LLM Exporter Pipeline:

  ClearSchema AST
       │
       ▼
  resolveReferences(schema)     ← Populates resolvedRef on all RefField nodes
       │
       ▼
  JsonSchemaExporter.export()   ← Produces standard JSON Schema output
       │
       ▼
  LLM Post-Processing:
    1. Walk all objects: add additionalProperties: false
    2. Walk all objects: move all properties to required[]
    3. Inline any remaining $ref by substituting resolvedRef content
    4. Remove $defs blocks
    5. Strip unsupported keywords: default, examples, const,
       minimum, maximum, minLength, maxLength, pattern
    6. Validate: nesting depth ≤ 5, total properties ≤ 100
    7. Collect warnings for any stripped constraints
       │
       ▼
  { schema: JsonSchema, warnings: string[] }
```

## Implementation Units

- [ ] **Unit 1: Root .gitignore and Repo Hygiene**

**Goal:** Prevent accidental commits of build artifacts and establish clean repo baseline.

**Requirements:** R11, R11a

**Dependencies:** None (do first)

**Files:**
- Create: `.gitignore`

**Approach:**
- Create root-level `.gitignore` covering: `node_modules/`, `dist/`, `coverage/`, `*.tgz`, `.env`, `.DS_Store`
- Verify no coverage/dist/node_modules artifacts are tracked with `git ls-files`
- If any are tracked, run `git rm -r --cached` on those paths before committing the `.gitignore`

**Test expectation:** None — pure config, no behavioral change.

**Verification:**
- `git status` shows `.gitignore` as only new file
- `git ls-files | grep -E '(node_modules|dist|coverage)'` returns empty

---

- [ ] **Unit 2: File Extension Rename (.cs → .clear)**

**Goal:** Replace all `.cs` references with `.clear` across the entire codebase.

**Requirements:** R5, R6, R7, R8

**Dependencies:** None

**Files:**
- Rename: `examples/user.cs` → `examples/user.clear`
- Rename: `examples/ecommerce.cs` → `examples/ecommerce.clear`
- Modify: `clearschema/src/cli/index.ts` (help text, ~6 occurrences)
- Modify: `clearschema/tests/unit/parser/imports.test.ts` (~10 occurrences)
- Modify: `vscode-clearschema/package.json` (extensions array)
- Modify: `vscode-clearschema/README.md`
- Modify: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `ROADMAP.md`
- Modify: `docs/GRAMMAR.md`, `docs/TESTING.md`, `docs/ARCHITECTURE.md`
- Modify: `docs/phases/PHASE3_REFERENCES.md`, `docs/phases/PHASE4_JSON_SCHEMA.md`, `docs/phases/PHASE6_CLI.md`, `docs/phases/PHASE7_VSCODE_LSP.md`

**Approach:**
- Rename example files first
- Global find-and-replace `.cs` → `.clear` in all source, test, and doc files listed above
- In VS Code extension package.json: change `extensions` from `[".cs", ".clearschema"]` to `[".clear"]`
- In GRAMMAR.md EBNF: update `filename = identifier , ".cs"` to `filename = identifier , ".clear"`
- The parser itself does not validate file extensions — no parser changes needed

**Patterns to follow:**
- Existing occurrences are all string literals in help text, test fixtures, and documentation

**Test scenarios:**
- Happy path: All existing parser tests pass after renaming import path strings from `.cs` to `.clear`
- Happy path: CLI `--help` output shows `.clear` extension in all examples
- Edge case: No remaining `.cs` references in source or test files (verified by grep)

**Verification:**
- `grep -r '\.cs"' clearschema/src/ clearschema/tests/ examples/ vscode-clearschema/` returns zero matches (excluding `.clearschema` scope names)
- All 232 tests pass
- VS Code extension package.json shows only `.clear` in extensions array

---

- [ ] **Unit 3: Package.json and CLI Fixes**

**Goal:** Prepare the npm package for publishing as `@clearschema/core` at v0.3.0.

**Requirements:** R1, R2, R3, R4, R4a, R4b

**Dependencies:** Unit 2 (extension rename must be done first so published package reflects `.clear`)

**Files:**
- Modify: `clearschema/package.json`
- Modify: `clearschema/src/cli/index.ts`

**Approach:**
- In `package.json`: change `name` to `@clearschema/core`, `version` to `0.3.0`, set `author` to `"Darin Chambers"`, add `files: ["dist/", "README.md", "LICENSE"]`, add `prepublishOnly: "npm run build && npm test"`, fix lint script to `"eslint src tests"` (remove `--ext .ts`), add `engines: { "node": ">=20" }`
- Note: `README.md` and `LICENSE` are at repo root, not in `clearschema/`. The `files` field references relative to package.json. Either copy these files into `clearschema/` as a build step or adjust the `files` field. Planning defers the exact approach but the implementer must ensure these files are included in the published package.
- In `cli/index.ts`: replace hardcoded version strings with dynamic read from package.json (e.g., `require('../package.json').version` or import from the compiled dist path)

**Patterns to follow:**
- Standard npm package.json conventions for scoped packages

**Test scenarios:**
- Happy path: `clearschema --version` outputs `0.3.0` (matching package.json)
- Happy path: `clearschema --help` displays updated package info
- Happy path: `npm run lint` succeeds (no `--ext` error)
- Edge case: `npm pack` (dry run in `clearschema/`) produces a tarball containing only dist/, README.md, and LICENSE

**Verification:**
- `npm pack --dry-run` in `clearschema/` lists only intended files
- `npm run lint` passes
- `npm run build && npm test` passes (prepublishOnly chain)

---

- [ ] **Unit 4: LLM Structured Output Exporter**

**Goal:** Implement the LLM-compatible JSON Schema exporter that produces output valid for OpenAI, Anthropic, and Google structured output APIs.

**Requirements:** R13, R14, R14a, R15

**Dependencies:** Unit 2 (for consistent extension references in any test fixtures)

**Files:**
- Create: `clearschema/src/exporters/llm-structured-output.ts`
- Create: `clearschema/tests/unit/exporters/llm-structured-output.test.ts`
- Modify: `clearschema/src/index.ts` (add exports)

**Approach:**
- Create `LlmSchemaExporter` class implementing `Exporter<LlmSchemaResult>` where result includes both the schema and any warnings
- Strategy: call `resolveReferences()` on the AST, then delegate to `JsonSchemaExporter.export()`, then post-process the JSON Schema output:
  1. Walk all object nodes: set `additionalProperties: false`
  2. Walk all object nodes: ensure all properties are in `required` array
  3. Replace any `$ref` with inlined content from resolved definitions
  4. Remove all `$defs` blocks
  5. Strip unsupported keywords: `default`, `examples`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `minItems`, `maxItems`, `format` (except date/date-time/time if keeping partial format support — but safest to strip all)
  6. Validate: nesting depth ≤ 5, total property count ≤ 100
  7. Collect warnings for each stripped constraint (R14a)
- Handle circular refs: if `resolveReferences()` encounters a cycle, the exporter should error with a clear message ("Recursive schemas are not supported in LLM structured output mode")
- Convenience function: `exportLlmSchema(schema, options?) → LlmSchemaResult`

**Patterns to follow:**
- `clearschema/src/exporters/openapi.ts` — wraps JSON Schema exporter and restructures
- `clearschema/src/exporters/types.ts` — Exporter<T> interface
- `clearschema/src/resolver/resolver.ts` — `resolveReferences()` for ref resolution

**Test scenarios:**
- Happy path: Simple object schema → produces JSON with `additionalProperties: false` and all properties in `required`
- Happy path: Schema with `$ref` to a `$defs` type → ref is inlined, no `$ref` or `$defs` in output
- Happy path: Schema with nested objects → each nested object has `additionalProperties: false` and `required`
- Happy path: Schema with enum field → enum preserved in output
- Happy path: Schema with `anyOf` union type → `anyOf` preserved (non-root)
- Edge case: Schema with `minLength`, `pattern`, or `default` → keywords stripped, warnings emitted listing each dropped constraint
- Edge case: Schema with exactly 5 levels of nesting → passes validation
- Edge case: Schema with 6 levels of nesting → error or warning about exceeding LLM provider limits
- Edge case: Schema with 100 properties → passes; schema with 101 → warning
- Error path: Schema with circular `$ref` (A → B → A) → clear error message about recursive schemas not being supported
- Error path: Schema with `$ref` to non-existent definition → error from resolver
- Integration: Full pipeline — parse ClearSchema DSL string → resolve references → export LLM schema → validate output is self-contained JSON with no $ref

**Verification:**
- All new tests pass
- Output for each test case contains no `$ref`, no `$defs`, has `additionalProperties: false` on every object
- Warnings array is populated when constraints are stripped
- Overall test suite still at 93%+ coverage

---

- [ ] **Unit 5: CLI Integration for llm-schema Format**

**Goal:** Wire the new exporter into the CLI as `-f llm-schema`.

**Requirements:** R13

**Dependencies:** Unit 4

**Files:**
- Modify: `clearschema/src/cli/index.ts`

**Approach:**
- Add `'llm-schema'` to the format union type
- Add to format validation check
- Add else-if branch in dispatch: call `resolveReferences()` on the parsed schema, then `exportLlmSchema()`
- Output the schema as `JSON.stringify(result.schema, null, 2)`
- Print any warnings to stderr
- Update help text to include `llm-schema` in the format list

**Patterns to follow:**
- Existing format dispatch pattern in `clearschema/src/cli/index.ts` lines 139-157

**Test scenarios:**
- Happy path: `clearschema example.clear -f llm-schema` produces valid JSON to stdout
- Happy path: CLI help text lists `llm-schema` as a valid format
- Edge case: Schema with dropped constraints → warnings printed to stderr, schema still output to stdout
- Error path: Invalid format flag → existing error message behavior

**Verification:**
- CLI `--help` lists `llm-schema` format
- Running against example files produces valid LLM-compatible JSON Schema output
- All CLI tests pass

---

- [ ] **Unit 6: GitHub Actions CI/CD**

**Goal:** Add automated testing on PR/push and npm release on version tags.

**Requirements:** R9, R10, R12

**Dependencies:** Unit 3 (package.json must be ready)

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

**Approach:**
- **ci.yml**: Trigger on push and PR to main. Matrix: Node 20.x, 22.x. Steps: checkout, setup-node, `npm ci` (working-directory: clearschema), `npm run lint`, `npm run build`, `npm test -- --coverage`. Add a coverage threshold check step (fail if below 93%)
- **release.yml**: Trigger on tag push matching `v*`. Steps: checkout, setup-node with registry-url for npm, `npm ci`, `npm run build`, `npm test`, `npm publish --access public` (working-directory: clearschema). Uses `NODE_AUTH_TOKEN` secret
- All steps use `working-directory: clearschema` since package.json is in the subdirectory

**Patterns to follow:**
- Standard GitHub Actions Node.js workflow patterns
- `actions/setup-node@v4` with `node-version` matrix

**Test scenarios:**
- Happy path: CI workflow YAML is valid (can be validated with `actionlint` or manual review)
- Happy path: CI runs lint, build, and test in correct order with working-directory
- Edge case: Coverage below 93% threshold → CI fails

**Verification:**
- Workflow files exist at `.github/workflows/ci.yml` and `.github/workflows/release.yml`
- Running `npm ci && npm run lint && npm run build && npm test` locally in `clearschema/` succeeds (simulates CI)

---

- [ ] **Unit 7: Examples, README, and Documentation Updates**

**Goal:** Add LLM examples, update README with use cases, and ensure all docs reference `.clear` and `@clearschema/core`.

**Requirements:** R16, R17, R18, R19, R20

**Dependencies:** Units 2, 3, 4, 5 (all functional changes complete first)

**Files:**
- Create: `examples/llm-tool-definition.clear`
- Create: `examples/llm-structured-response.clear`
- Create: `examples/llm-agent-output.clear`
- Modify: `README.md`

**Approach:**
- Create 3 LLM-focused example files demonstrating: (1) function/tool definition schema, (2) structured response format, (3) multi-step agent output schema. Keep examples concise and practical
- Update README.md:
  - Installation: `npm install @clearschema/core`
  - All `.cs` references → `.clear` (already done in Unit 2 for docs, but verify README)
  - Add "Use Cases" section with 3-4 scenarios: API schema generation, TypeScript type generation, Python/Pydantic models, LLM structured output — equal positioning
  - Each use case: 2-3 sentence description + brief CLI example
- Verify all doc files from Unit 2 still reference `.clear` correctly

**Patterns to follow:**
- Existing `examples/user.clear` and `examples/ecommerce.clear` for example file style
- README's existing structure for where to insert use cases

**Test scenarios:**
- Happy path: Each LLM example file parses without errors (`clearschema <file> -f llm-schema` succeeds)
- Happy path: README installation command matches package name
- Edge case: No remaining `.cs` references in any documentation file

**Verification:**
- All example files compile with all 5 export formats
- README is coherent and all code examples use `.clear` extension and `@clearschema/core` package name
- `grep -r '\.cs"' README.md docs/ examples/` returns zero matches

## System-Wide Impact

- **Interaction graph:** The LLM exporter wraps the JSON Schema exporter — changes to JSON Schema output will automatically flow through. The resolver is called before export, adding a new dependency path (CLI → resolver → JSON Schema exporter → LLM post-processor)
- **Error propagation:** Resolver errors (circular refs, missing definitions) surface through the LLM exporter. CLI prints warnings to stderr and schema to stdout
- **API surface parity:** The new `exportLlmSchema()` function joins the public API alongside `exportJsonSchema()`, `exportTypeScript()`, `exportPydantic()`, `exportOpenAPI()`. All are exported from `src/index.ts`
- **Unchanged invariants:** All 4 existing exporters, the parser, lexer, and resolver are not modified. Existing test suite must continue passing at 93%+ coverage

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `@clearschema` npm org requires creation and auth setup | Org verified available. Implementer needs npm account access to create org and configure GitHub Actions secret |
| Extension rename breaks test fixtures | All changes are string literals. Run full test suite after rename to catch any missed references |
| LLM provider constraints change | Constraints are documented in R14 with sources. The exporter is a post-processor over JSON Schema, making it easy to adjust individual rules |
| README/LICENSE not in `clearschema/` directory for npm publish | `files` field or a copy step needed. Deferred to implementation — implementer must verify `npm pack` includes these files |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-04-ship-ready-llm-positioning-requirements.md](docs/brainstorms/2026-04-04-ship-ready-llm-positioning-requirements.md)
- Exporter interface: `clearschema/src/exporters/types.ts`
- OpenAPI exporter (wrap pattern): `clearschema/src/exporters/openapi.ts`
- CLI format dispatch: `clearschema/src/cli/index.ts:139-157`
- Resolver: `clearschema/src/resolver/resolver.ts`
- LLM provider research: Verified April 2026 against OpenAI, Anthropic, and Google docs (see origin document Dependencies section)
