---
title: "feat: Add MCP server for ClearSchema"
type: feat
status: active
date: 2026-04-06
origin: docs/brainstorms/2026-04-06-mcp-server-requirements.md
---

# feat: Add MCP server for ClearSchema

## Overview

Add a new `clearschema-mcp/` package that exposes ClearSchema's compile, validate, import, list, and inspect capabilities as MCP tools. This makes ClearSchema callable from AI editors (Claude Desktop, Cursor, Windsurf) without leaving the conversation.

## Problem Frame

ClearSchema compiles `.clear` files to 7 formats, but using it requires context-switching to the CLI. An MCP server wraps the existing programmatic API so AI agents can call it directly. (see origin: `docs/brainstorms/2026-04-06-mcp-server-requirements.md`)

## Requirements Trace

- R1. `compile_schema` — source text + target format → compiled output (defaults only)
- R2. `validate_schema` — source text → valid confirmation or structured diagnostics
- R3. `import_json_schema` — JSON Schema string → ClearSchema syntax + warnings
- R4. `list_exporters` — no input → available formats with descriptions
- R5. `inspect_schema` — source text → flat JSON list of defined types, fields, and structure
- R6. `.describe()` on every Zod parameter
- R7. `readOnlyHint: true` and `idempotentHint: true` on all tools
- R8. Error messages with line numbers and recovery context
- R9. Server-level `instructions` field
- R10. New `clearschema-mcp/` package as `@clearschema/mcp`
- R11. `npx @clearschema/mcp` with stdio transport
- R12. Depends on `@clearschema/core` via `file:../clearschema`
- R13. Zero configuration
- R14. Unit tests per tool handler
- R15. Integration test via SDK client

## Scope Boundaries

- No file system access — string inputs only (see origin)
- No MCP resources or prompts — tools only
- No authentication
- No exporter-specific options in v0.1.0 — defaults only
- MCP SDK v1.x (`@modelcontextprotocol/sdk`)

## Context & Research

### Relevant Code and Patterns

- `clearschema-lsp/` — sibling package template (package.json, tsconfig, jest.config, test layout)
- `clearschema/src/index.ts` — full public API surface (parse, all exporters, importJsonSchema, ParseError)
- `clearschema/src/cli/index.ts` — format dispatch pattern (if/else chain, different return types per exporter)
- `clearschema/src/ast/types.ts` — AST node types for inspect_schema walking
- `clearschema-lsp/src/diagnostics.ts` — canonical parse + error handling (both thrown ParseError and schema.errors[])
- `clearschema/src/parser/errors.ts` — ParseError class with location, hint, format()

### Key Patterns to Replicate

- **Dual error path:** `parse()` can throw `ParseError` (catastrophic) AND return `schema.errors[]` (recoverable). Both must be checked. See `clearschema-lsp/src/diagnostics.ts`.
- **Exporter return types vary:** TypeScript/Pydantic/Zod return strings. JSON Schema/OpenAPI return objects (need `JSON.stringify`). LLM schema returns `{ schema, warnings }`. The dispatch map must normalize these.
- **Package structure:** Copy LSP's `package.json` shape, `tsconfig.json`, `jest.config.js`, and `tests/` layout.

## Key Technical Decisions

- **Defaults only for compile_schema (R1):** Exporter-specific options (e.g., LLM provider selection) deferred to a future version. Keeps the tool interface simple.
- **inspect_schema returns flat JSON:** A list of `{ name, type, fields: [{ name, type, required }], ... }` objects. Simple to produce from `schema.definitions`, useful to LLMs, easy to extend.
- **Exporter dispatch map:** A `Record<string, { fn: (schema: Schema) => { output: string, warnings?: string[] }, description: string }>` in the MCP server that normalizes all exporter outputs. The LLM exporter returns warnings (stripped constraints, omitted fields) that must be surfaced in the compile response — not silently dropped. Shared by `compile_schema` and `list_exporters`.
- **CI runs integration test:** The MCP SDK client connects over stdio in-process — same as LSP integration tests. No special CI configuration needed.

## Open Questions

### Resolved During Planning

- **Exporter options:** Defaults only for v0.1.0 — adding optional `options` parameter later is backward-compatible.
- **inspect_schema shape:** Flat JSON type list. Walking `schema.definitions` and `schema.fields` recursively. Each entry: `{ name, type, required, fields?, itemType?, variants? }`.
- **CI integration test:** Yes — runs in CI like LSP integration tests. SDK client connects in-process via stdio.

### Deferred to Implementation

- **Exact inspect_schema recursive depth:** How deep to recurse into nested ObjectField/ArrayField types. Start with one level of field listing; deepen if LLM feedback suggests more is useful.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────────────┐
│  clearschema-mcp/src/index.ts  (entry point)            │
│                                                         │
│  McpServer("clearschema", version, { instructions })    │
│       │                                                 │
│       ├── server.tool("list_exporters")                │
│       │     → return EXPORTER_MAP keys + descriptions   │
│       │                                                 │
│       ├── server.tool("compile_schema")                │
│       │     → parse(source)                             │
│       │     → check schema.errors                       │
│       │     → EXPORTER_MAP[target](schema)              │
│       │     → return compiled string                    │
│       │                                                 │
│       ├── server.tool("validate_schema")               │
│       │     → parse(source)                             │
│       │     → check schema.errors                       │
│       │     → return "valid" or diagnostics             │
│       │                                                 │
│       ├── server.tool("import_json_schema")            │
│       │     → JSON.parse(input)                         │
│       │     → importJsonSchema(parsed)                  │
│       │     → exportClearSchema(result.schema)          │
│       │     → return .clear text + warnings             │
│       │                                                 │
│       └── server.tool("inspect_schema")                │
│             → parse(source)                             │
│             → walk schema.definitions + schema.fields   │
│             → return JSON type summary                  │
│                                                         │
│  StdioServerTransport → server.connect()                │
└─────────────────────────────────────────────────────────┘

EXPORTER_MAP: Record<string, { fn: (schema) => { output, warnings? }, description }>
  "json-schema"   → { output: JSON.stringify(exportJsonSchema(schema)) }
  "typescript"    → { output: exportTypeScript(schema) }
  "pydantic"      → { output: exportPydantic(schema) }
  "openapi"       → { output: JSON.stringify(exportOpenAPI(schema)) }
  "zod"           → { output: exportZod(schema) }
  "llm-schema"    → { output: JSON.stringify(result.schema), warnings: result.warnings }
  "clearschema"   → { output: exportClearSchema(schema) }

Note: OpenAPI exporter needs default options { title, version }.
Note: LLM exporter can throw on recursive schemas — wrap in try-catch.
Note: compile_schema response appends warnings when present.
```

## Implementation Units

- [ ] **Unit 1: Package scaffold**

**Goal:** Create the `clearschema-mcp/` package with build infrastructure, matching the LSP package pattern.

**Requirements:** R10, R11, R12, R13

**Dependencies:** None

**Files:**
- Create: `clearschema-mcp/package.json`
- Create: `clearschema-mcp/tsconfig.json`
- Create: `clearschema-mcp/jest.config.js`
- Create: `clearschema-mcp/src/index.ts` (minimal — shebang + empty server setup)

**Approach:**
- Copy `clearschema-lsp/` package.json structure, update name to `@clearschema/mcp`, version `0.1.0`
- bin: `clearschema-mcp` → `dist/index.js`
- Dependencies: `@clearschema/core: "file:../clearschema"`, `@modelcontextprotocol/sdk: ^1.29.0`, `zod: ^3.23.0`
- devDependencies: match LSP versions (jest ^30, ts-jest ^29, typescript ^5.9)
- Entry point: shebang `#!/usr/bin/env node`, create McpServer instance with name/version/instructions, connect to StdioServerTransport
- Copy `tsconfig.json` and `jest.config.js` from LSP

**Patterns to follow:**
- `clearschema-lsp/package.json` — package.json shape
- `clearschema-lsp/tsconfig.json` — TypeScript config
- `clearschema-lsp/jest.config.js` — Jest config

**Test expectation:** none — pure scaffold, verified by build

**Verification:**
- `npm install` succeeds in `clearschema-mcp/`
- `npm run build` compiles without errors
- `node dist/index.js` starts without crashing (exits when stdin closes)

---

- [ ] **Unit 2: Exporter dispatch map and list_exporters tool**

**Goal:** Create the shared exporter map and the `list_exporters` discovery tool.

**Requirements:** R4, R6, R7, R9

**Dependencies:** Unit 1

**Files:**
- Create: `clearschema-mcp/src/exporters.ts`
- Modify: `clearschema-mcp/src/index.ts`
- Test: `clearschema-mcp/tests/unit/exporters.test.ts`

**Approach:**
- Define `EXPORTER_MAP: Record<string, { fn: (schema: Schema) => string, description: string }>` normalizing all return types to strings
- Handle the LLM exporter's `{ schema, warnings }` return shape and potential throw
- Handle JSON Schema and OpenAPI's object returns with `JSON.stringify(result, null, 2)`
- Register `list_exporters` tool with no input schema, returns formatted list of keys + descriptions
- Include `readOnlyHint: true`, `idempotentHint: true` annotations

**Patterns to follow:**
- `clearschema/src/cli/index.ts` lines 304-341 — main compile format dispatch (note: different return types per exporter)

**Test scenarios:**
- Happy path: `list_exporters` returns all 7 format names with descriptions
- Happy path: EXPORTER_MAP contains entries for all 7 formats (json-schema, typescript, pydantic, openapi, zod, llm-schema, clearschema)
- Edge case: each EXPORTER_MAP entry produces a string (not an object) from a simple test schema

**Verification:**
- Calling `list_exporters` returns a response listing all 7 formats
- Every exporter in the map compiles a basic schema to a non-empty string

---

- [ ] **Unit 3: compile_schema and validate_schema tools**

**Goal:** Implement the two core tools that parse and optionally compile ClearSchema source.

**Requirements:** R1, R2, R6, R7, R8

**Dependencies:** Unit 2

**Files:**
- Modify: `clearschema-mcp/src/index.ts`
- Test: `clearschema-mcp/tests/unit/compile.test.ts`
- Test: `clearschema-mcp/tests/unit/validate.test.ts`

**Approach:**
- `compile_schema`: accepts `source` (string) and `target` (string). Parse with `parse()`, check both thrown `ParseError` and `schema.errors[]`. Recoverable parse errors (schema.errors[]) should be treated as fatal (return `isError: true`), matching CLI behavior. Look up target in EXPORTER_MAP, return `isError: true` with helpful message for unknown targets. Wrap exporter dispatch in try-catch — the LLM exporter can throw on recursive schemas. On success, return compiled string + any exporter warnings (e.g., LLM exporter's stripped constraint warnings).
- `validate_schema`: accepts `source` (string). Parse with `parse()`, same dual error handling. Return "Valid. No errors found." or structured diagnostics with line/column.
- Both tools: `z.string().describe(...)` on all parameters. `readOnlyHint: true`, `idempotentHint: true`.
- Error responses include line, column, message, and hint when available from ParseError.

**Patterns to follow:**
- `clearschema-lsp/src/diagnostics.ts` — canonical dual error handling pattern

**Test scenarios:**
- Happy path: compile a simple `type User { name string }` schema to json-schema format, verify valid JSON output
- Happy path: compile same schema to all 7 formats, verify non-empty string output
- Happy path: validate a valid schema, verify "valid" response
- Error path: compile with syntax error, verify `isError: true` with line number in response
- Error path: compile with unknown format string, verify `isError: true` with helpful message mentioning `list_exporters`
- Error path: compile empty string, verify `isError: true` with meaningful error
- Error path: validate invalid schema, verify diagnostics with line/column
- Edge case: compile schema with recoverable parse errors (schema.errors[]), verify warnings are included
- Edge case: compile schema with discriminated unions (`match` type), verify it works
- Edge case: compile schema with `$ref` references, verify output is valid
- Edge case: compile schema with recursive `$ref` to llm-schema format, verify `isError: true` (LLM exporter throws on circular refs)
- Edge case: compile to llm-schema format, verify exporter warnings are included in response (e.g., stripped constraints)

**Verification:**
- All 7 export formats produce identical output to calling the core API directly
- Parse errors produce structured, actionable diagnostics

---

- [ ] **Unit 4: import_json_schema tool**

**Goal:** Expose the reverse importer as an MCP tool.

**Requirements:** R3, R6, R7, R8

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema-mcp/src/index.ts`
- Test: `clearschema-mcp/tests/unit/import.test.ts`

**Approach:**
- Accepts `jsonSchema` (string). `JSON.parse()` the input, call `importJsonSchema()`, then `exportClearSchema()` on the result to produce `.clear` syntax. Include `result.warnings` in the response text.
- Error handling: catch `JSON.parse` errors (invalid JSON) with a clear "invalid JSON" message. Note: `importJsonSchema()` does not throw — malformed-but-parseable JSON produces a mostly-empty schema with warnings rather than an exception. Check if the resulting schema has zero definitions and zero fields — treat as a soft error with the warnings included.

**Patterns to follow:**
- `clearschema/src/cli/index.ts` import subcommand — shows the import → re-export pipeline

**Test scenarios:**
- Happy path: import a simple JSON Schema with `type: "object"`, `properties`, `required` — verify valid `.clear` output
- Happy path: import with warnings, verify warnings appear in response
- Error path: pass invalid JSON string, verify `isError: true` with "invalid JSON" message
- Error path: pass valid JSON that isn't a JSON Schema (e.g., `[1,2,3]`), verify meaningful error
- Edge case: import schema with `$ref` and `$defs`, verify round-trip fidelity

**Verification:**
- Importing a JSON Schema and compiling the result back to json-schema produces equivalent output

---

- [ ] **Unit 5: inspect_schema tool**

**Goal:** Add schema introspection without compilation — returns a structured type summary.

**Requirements:** R5, R6, R7, R8

**Dependencies:** Unit 1

**Files:**
- Create: `clearschema-mcp/src/inspect.ts`
- Modify: `clearschema-mcp/src/index.ts`
- Test: `clearschema-mcp/tests/unit/inspect.test.ts`

**Approach:**
- Accepts `source` (string). Parse with `parse()`, walk `schema.definitions` and `schema.fields`.
- For each definition: extract `{ name, type, fields?, itemType?, variants? }`. For ObjectField, recurse one level into fields listing `{ name, type, required }`.
- Return as JSON string. This is new logic (no existing core function), but the AST walking is straightforward.

**Patterns to follow:**
- `clearschema/src/ast/types.ts` — AST node shapes to inspect
- `clearschema-lsp/src/symbols.ts` — walks the AST for document symbols, closest existing pattern

**Test scenarios:**
- Happy path: inspect schema with 2 type definitions, verify both names appear in output with correct field lists
- Happy path: inspect schema with nested object type, verify fields include nested field names and types
- Error path: inspect invalid schema, verify `isError: true` with diagnostics
- Edge case: inspect schema with `match` type (discriminated union), verify variants appear
- Edge case: inspect schema with `$ref` references, verify refs are listed
- Edge case: inspect empty schema (no definitions), verify empty list response (not error)

**Verification:**
- Output accurately reflects the schema's type definitions and field structure

---

- [ ] **Unit 6: Integration test**

**Goal:** Verify the full MCP server works end-to-end via the SDK client.

**Requirements:** R15

**Dependencies:** Units 1-5

**Files:**
- Create: `clearschema-mcp/tests/integration/mcp-server.test.ts`

**Approach:**
- Use `@modelcontextprotocol/sdk` Client class connected to the server via in-process stdio transport
- Exercise at least: `list_exporters`, `compile_schema` (one format), `validate_schema` (valid + invalid), `import_json_schema`, `inspect_schema`
- Use a shared realistic schema constant (similar to LSP integration test pattern)

**Patterns to follow:**
- `clearschema-lsp/tests/integration/lsp-protocol.test.ts` — integration test structure

**Test scenarios:**
- Integration: list_exporters returns 7 formats
- Integration: compile_schema with valid source + json-schema format produces valid JSON
- Integration: validate_schema with valid source returns success
- Integration: validate_schema with invalid source returns error with line info
- Integration: import_json_schema with valid JSON Schema returns .clear syntax
- Integration: inspect_schema with valid source returns type definitions

**Verification:**
- All 5 tools are callable through the SDK client and return expected response shapes
- Tests pass in CI alongside existing test suites

---

- [ ] **Unit 7: Documentation and CI**

**Goal:** Update project docs and CI to include the MCP package.

**Requirements:** R10

**Dependencies:** Units 1-6

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `.github/workflows/ci.yml` (if it exists)

**Approach:**
- Add MCP server section to README with usage instructions (Claude Desktop config snippet, Cursor config)
- Add CHANGELOG entry for the new package
- Add `clearschema-mcp/` to CI workflow (npm install, build, test) following the same pattern as clearschema-lsp

**Test expectation:** none — documentation and CI config

**Verification:**
- CI runs MCP tests alongside existing suites
- README documents how to configure the MCP server in Claude Desktop and Cursor

## System-Wide Impact

- **Interaction graph:** The MCP server is a thin wrapper — it calls core's public API and returns results. No callbacks, middleware, or observers. No impact on existing packages.
- **Error propagation:** ParseError from core → structured MCP error response with `isError: true`. JSON.parse errors from import → separate error message. All errors are caught and returned, never thrown to the MCP transport.
- **API surface parity:** The MCP server should support the same 7 formats as the CLI. When a new exporter is added to core, it must be added to the EXPORTER_MAP in the MCP server.
- **Unchanged invariants:** `@clearschema/core` public API is unchanged. `clearschema-lsp/` is unchanged. No modifications to existing packages.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| MCP SDK v1.x API changes before v2 stabilizes | Pin to `^1.29.0`, monitor SDK releases. Migration to v2 is straightforward (server.tool vs .tool) |
| Exporter return type inconsistency causes bugs | Unit tests per format in the dispatch map (Unit 2). Normalize all outputs to strings in one place |
| inspect_schema output shape isn't useful to LLMs | Start simple (flat list), iterate based on real usage. The output shape is easy to change since no external consumers depend on it |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-06-mcp-server-requirements.md](docs/brainstorms/2026-04-06-mcp-server-requirements.md)
- Related code: `clearschema-lsp/` (sibling package template)
- Related code: `clearschema/src/cli/index.ts` (format dispatch pattern)
- Related code: `clearschema-lsp/src/diagnostics.ts` (error handling pattern)
- External docs: MCP TypeScript SDK v1.x (`@modelcontextprotocol/sdk`)
