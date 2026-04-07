---
date: 2026-04-06
topic: mcp-server
---

# MCP Server for ClearSchema

## Problem Frame

ClearSchema compiles `.clear` files to 7 target formats, but using it requires switching to a terminal and running the CLI. When working with AI editors (Claude Desktop, Cursor, Windsurf), the schema compilation workflow is disconnected from the conversation — you write a `.clear` schema, switch contexts to compile it, then paste the output back. An MCP server makes ClearSchema's capabilities directly callable by the AI agent, eliminating the context switch.

## Requirements

**Tools**

- R1. `compile_schema` tool: accepts ClearSchema source text and a target format string, returns the compiled output using exporter defaults (option handling deferred to planning). Parse errors return structured diagnostics with line/column locations and `isError: true`.
- R2. `validate_schema` tool: accepts ClearSchema source text, returns either "valid" confirmation or structured diagnostics. No target format required.
- R3. `import_json_schema` tool: accepts a JSON Schema string, returns the equivalent ClearSchema syntax using the existing reverse importer. Includes any import warnings in the response.
- R4. `list_exporters` tool: accepts no input, returns the list of available export formats with short descriptions. Allows the LLM to discover capabilities at runtime rather than relying on hardcoded knowledge.
- R5. `inspect_schema` tool: accepts ClearSchema source text, returns a structured summary of defined types, their fields, references, and composition structure. Schema introspection without compilation. Note: no existing `inspect` function exists in core — this tool walks the parsed AST directly. The exact output shape (flat list, tree, or AST summary) is deferred to planning.

**Tool Quality**

- R6. Every tool parameter has a `.describe()` annotation so the LLM understands what to pass.
- R7. All tools are annotated as `readOnlyHint: true` and `idempotentHint: true` — they are pure functions with no side effects. Clients can auto-approve them.
- R8. Error messages include enough context for the LLM to fix the input and retry (line numbers, expected vs actual, suggestions when available).
- R9. Server-level `instructions` field describes the intended tool workflow (e.g., "call list_exporters to discover formats before compile_schema").

**Packaging**

- R10. New package `clearschema-mcp/` in the monorepo, published as `@clearschema/mcp` on npm.
- R11. Runnable via `npx @clearschema/mcp` with no configuration — stdio transport, shebang entry point.
- R12. Depends on `@clearschema/core` as a runtime dependency (not bundled/duplicated).
- R13. Zero configuration required — no env vars, no config files, no auth. It compiles schemas; that's it.

**Testing**

- R14. Unit tests for each tool handler covering: valid input, parse errors, unknown formats, empty input, and edge cases (schemas with imports/refs, discriminated unions).
- R15. At least one integration test that spins up the MCP server and exercises a tool call end-to-end via the SDK's client. CI execution strategy deferred to planning.

## Success Criteria

- An AI agent in Claude Desktop or Cursor can compile a `.clear` schema to any format without the user touching the CLI
- All 7 export formats (json-schema, typescript, pydantic, openapi, zod, llm-structured-output, clearschema) work through the MCP server identically to the CLI
- The reverse importer works through the MCP server
- Adding a new exporter to `@clearschema/core` requires only adding it to the exporter map in the MCP server — no architectural changes

## Scope Boundaries

- No file system access — tools accept source text as strings, not file paths. The AI editor handles file reading.
- No watch mode or file monitoring — that's a separate feature (ideation #9).
- No resource or prompt primitives — tools only. Resources and prompts can be added later if useful.
- No authentication or authorization — this is a local-only, read-only MCP server.
- MCP SDK v1.x (`@modelcontextprotocol/sdk`) — stable, well-documented. Migrate to v2 later when it stabilizes.

## Key Decisions

- **Full 5 tools over minimal 3:** The extra `list_exporters` and `inspect_schema` tools are low-cost (each is ~10 lines of handler code) and make the server more useful to LLMs that don't have hardcoded knowledge of ClearSchema's capabilities.
- **Separate package over bundled in core:** Follows the existing monorepo pattern (`clearschema/`, `clearschema-lsp/`, `clearschema-mcp/`). Keeps the MCP SDK dependency out of core. Users who don't need MCP don't pull the dependency.
- **Exporter dispatch map is new code in the MCP server:** Core uses a hardcoded if/else chain in the CLI for format dispatch. The MCP server will create a `Record<string, ExporterFn>` map shared by `compile_schema` and `list_exporters`. This map lives in the MCP package, not in core.
- **String inputs, not file paths:** MCP tools that read arbitrary files need careful security scoping. String inputs are simpler, safer, and match how AI editors typically pass content (they read the file and send the text).
- **`z.string()` for target format, not `z.enum()`:** Lets the underlying library validate and return a helpful error. Avoids staleness if new exporters are added to core before the MCP server is updated.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] Should `compile_schema` support exporter-specific options (e.g., LLM schema provider selection for OpenAI/Anthropic/Google), or just use defaults?
- [Affects R5][Needs research] What's the most useful shape for `inspect_schema` output — flat type list, tree structure, or JSON AST summary?
- [Affects R10][Technical] Should CI run the MCP integration test, or is it manual-only given the stdio transport complexity?

## Next Steps

-> `/ce:plan` for structured implementation planning
