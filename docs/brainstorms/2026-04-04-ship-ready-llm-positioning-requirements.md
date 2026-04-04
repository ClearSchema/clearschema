---
date: 2026-04-04
topic: ship-ready-llm-positioning
---

# Ship-Ready Bundle + LLM Structured Output Positioning

## Problem Frame

ClearSchema is a functionally complete TypeScript DSL that compiles to JSON Schema, TypeScript, Pydantic, and OpenAPI. All 4 exporters work, the CLI works, 232 tests pass at 93%+ coverage. But the project is invisible: it's not on npm, has no CI, uses a file extension that collides with C#, and has no clear adoption story distinguishing it from the crowded schema tool space.

This work has two goals: (1) make ClearSchema installable and professional, and (2) add an LLM structured output exporter as one of several highlighted use cases, giving the project a timely angle for both portfolio and adoption purposes.

## Requirements

**Packaging and Distribution**

- R1. Rename the package to `@clearschema/core` and publish to npm at version 0.3.0
- R2. Add a `"files"` field to `package.json` restricting the published package to `dist/`, `README.md`, and `LICENSE`
- R3. Set the `"author"` field to `"Darin Chambers"`
- R4. Add a `prepublishOnly` script that runs build and test before publishing
- R4a. Fix the CLI version output to read from package.json instead of the hardcoded "1.0.0" (CLI currently prints "ClearSchema CLI v1.0.0" while package.json is 0.2.0 and target is 0.3.0)
- R4b. Fix the lint script in package.json -- remove the `--ext .ts` flag which was removed in ESLint 9+ flat config (the project uses ESLint 9+ with eslint.config.js)

**File Extension Migration**

- R5. Change the canonical file extension from `.cs` to `.clear`
- R6. Drop `.cs` support entirely -- no deprecated alias, no fallback
- R7. Update all references: CLI help text, examples, VS Code extension language registration, test fixtures, documentation, and GRAMMAR.md
- R8. The VS Code extension should register `.clear` as the sole extension (remove both `.cs` and `.clearschema`)

**CI/CD Pipeline**

- R9. Add a GitHub Actions CI workflow that runs on push and PR: lint, build, and test with coverage threshold enforcement (93%+)
- R10. Add a GitHub Actions release workflow that publishes to npm on version tag (e.g., `v0.3.0`)
- R11. Ensure coverage artifacts (`clearschema/coverage/`) are excluded from git tracking and the published npm package (coverage/ is already in clearschema/.gitignore but verify no artifacts are tracked)
- R11a. Create a root-level `.gitignore` covering node_modules/, dist/, coverage/, *.tgz, and .env (no root .gitignore currently exists)
- R12. The CI workflow should test on Node LTS versions (current + previous)

**LLM Structured Output Exporter**

- R13. Add a new `llm-schema` export format accessible via `-f llm-schema` in the CLI and programmatically via `exportLlmSchema()`
- R14. The `llm-schema` format produces a strict JSON Schema subset compatible with all major LLM providers (OpenAI, Anthropic, Google). Verified constraints (as of April 2026):
  - `additionalProperties: false` on all objects (required by OpenAI and Anthropic)
  - No `$ref` or `$defs` -- inline all definitions (Gemini's `$defs` support is ambiguous in REST API)
  - All properties listed in `required` array (required by OpenAI; avoids Anthropic's 24-optional-parameter limit)
  - No recursive schemas (Anthropic does not support them)
  - No `default`, `examples`, `const` (OpenAI does not support them)
  - No `minimum`/`maximum`/`minLength`/`maxLength`/`pattern` (OpenAI and Anthropic do not support them)
  - Max 5 levels of nesting (OpenAI limit)
  - Max 100 total properties (OpenAI limit)
  - `enum` is allowed (strings and numbers)
  - `anyOf` is allowed for union types (but not at root object level per OpenAI)
- R14a. When a ClearSchema source uses features unsupported by the LLM subset (e.g., `minLength`, `pattern`, recursive `$ref`), the exporter should emit a warning listing the dropped constraints, not silently discard them
- R15. The exporter should emit a clean, self-contained JSON Schema document that can be pasted directly into an LLM API call's `response_format` or `tool` parameter
- R16. Add LLM-focused examples in `examples/` demonstrating common patterns: function tool definitions, structured response schemas, multi-step agent outputs

**Documentation Updates**

- R17. Update installation instructions to `npm install @clearschema/core`
- R18. Update all file extension references from `.cs` to `.clear`

**Product Positioning and Messaging**

- R19. Add LLM structured output as one of several highlighted use cases (alongside API schemas, TypeScript projects, and Python/Pydantic projects) -- equal positioning, not leading
- R20. Add a "Use Cases" section in the README showing 3-4 concrete scenarios with brief examples (these are README-embedded summaries; R16 covers the executable example files in `examples/`)

## Success Criteria

- `npm install @clearschema/core` works and the package includes working CLI, all 5 exporters, and TypeScript types
- `clearschema schema.clear -f llm-schema` produces valid output that passes OpenAI's structured output validation and is accepted by Anthropic's tool_use and Google Gemini's function calling
- GitHub Actions CI runs on every PR and blocks merge on test/lint/coverage failure
- No `.cs` files remain in the repository; all examples and docs use `.clear`
- README presents ClearSchema as a versatile tool with LLM use cases featured equally alongside other use cases

## Scope Boundaries

- No LSP server in this work (idea #4 from ideation, separate effort)
- No browser playground (idea #2, separate effort)
- No Zod exporter (idea #5, separate effort)
- No reverse importer (idea #6, separate effort)
- No map type (idea #7, separate effort)
- No watch mode or batch compilation in CLI
- No provider-specific LLM exporters -- single `llm-schema` format only
- Do not change the VS Code extension beyond updating file associations

## Key Decisions

- **Package name: `@clearschema/core`** — Scoped package leaves room for `@clearschema/playground`, `@clearschema/lsp` later
- **Extension: `.clear`** — Short, memorable, no known collisions. Drop `.cs` and `.clearschema` entirely
- **Version: 0.3.0** — Signals meaningful additions (extension rename + LLM exporter) while acknowledging the project is still evolving
- **Single `llm-schema` format** — One format targeting the common subset across providers, not provider-specific flags
- **Equal positioning for LLM use case** — Featured alongside other use cases, not the sole identity

## Dependencies / Assumptions

- npm org `@clearschema` verified available (checked April 2026); both `@clearschema/core` and `clearschema` are unclaimed
- GitHub repo must have npm publish secrets configured for the release workflow
- LLM provider JSON Schema requirements verified (April 2026): no `$ref`, `additionalProperties: false`, all properties required, plus additional constraints (no `default`/`examples`/`const`, no numeric/string constraints, max 5 levels nesting, max 100 properties). See R14 for full list

## Outstanding Questions

### Resolve Before Planning

(All resolved -- npm org verified available, LLM provider constraints verified)

### Deferred to Planning

- [Affects R8][Technical] Confirm that registering only `.clear` in the VS Code extension doesn't break existing installs -- may need a version bump and changelog note
- [Affects R11][Technical] Verify whether coverage artifacts are actually tracked in git history (they may already be gitignored)
- [Affects R12][Technical] Determine which Node LTS versions to test (22.x + 20.x likely)
- [Affects R1, R9][Technical] Package.json is at `clearschema/package.json`, not repo root. Determine whether to restructure or use `working-directory` in CI workflows
- [Affects R14][Technical] The existing JSON Schema exporter emits bare `$ref` -- the LLM exporter must resolve and inline these. Determine integration approach with the resolver module

## Next Steps

-> `/ce:plan` for structured implementation planning
