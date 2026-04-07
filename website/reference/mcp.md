# MCP Server Reference

The `@clearschema/mcp` package exposes ClearSchema's capabilities as [MCP](https://modelcontextprotocol.io/) tools. This lets AI editors like Claude Desktop, Cursor, and Windsurf compile, validate, import, and inspect schemas directly within a conversation.

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clearschema": {
      "command": "npx",
      "args": ["-y", "@clearschema/mcp"]
    }
  }
}
```

### Cursor

Add to your MCP server settings:

```json
{
  "clearschema": {
    "command": "npx",
    "args": ["-y", "@clearschema/mcp"]
  }
}
```

The server uses stdio transport and requires no configuration, environment variables, or authentication.

## Tools

### list_exporters

Returns the list of available export formats with descriptions. Call this before `compile_schema` to discover valid target names.

**Parameters:** none

**Example response:**

```
Available export formats:
- json-schema: JSON Schema Draft 2020-12
- typescript: TypeScript interfaces and types
- pydantic: Python Pydantic v2 models
- openapi: OpenAPI 3.1 schema components
- zod: Zod validation schemas
- llm-schema: LLM structured output schema (OpenAI/Anthropic/Google compatible)
- clearschema: ClearSchema DSL syntax (round-trip serialization)
```

### compile_schema

Compiles ClearSchema source into a target format.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | ClearSchema source code |
| `target` | string | Format name from `list_exporters` |

Returns the compiled output as text. For JSON-based formats (json-schema, openapi, llm-schema), the output is pretty-printed JSON. For code formats (typescript, pydantic, zod), the output is ready-to-use source code.

When the LLM schema exporter strips constraints (like `pattern` or `min`/`max`), warnings are appended to the response so you know what was removed.

**Error responses include:**
- Line and column numbers for parse errors
- Hints for common mistakes
- The list of valid formats when an unknown target is provided

### validate_schema

Checks ClearSchema source for syntax errors without producing output.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | ClearSchema source code |

Returns `"Valid. No errors found."` on success, or structured diagnostics with line/column locations on failure.

### import_json_schema

Converts a JSON Schema document into ClearSchema syntax.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `jsonSchema` | string | JSON Schema document as a JSON string |

Returns the equivalent `.clear` source code. Import warnings (unsupported features, ambiguous constructs) are appended to the response. If the input is valid JSON but not a meaningful JSON Schema, a note explains what was expected.

### inspect_schema

Parses ClearSchema source and returns a structured JSON summary of all defined types. Useful for understanding a schema's structure without compiling it.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | ClearSchema source code |

**Example output:**

```json
[
  {
    "name": "User",
    "type": "object",
    "fields": [
      { "name": "name", "type": "string", "required": true },
      { "name": "email", "type": "string", "required": true },
      { "name": "age", "type": "integer", "required": false }
    ]
  }
]
```

The summary includes field types, required status, descriptions, `$ref` targets, discriminated union variants, and array/map value types.

## Technical Details

- **Transport:** stdio (the server reads from stdin and writes to stdout)
- **SDK:** `@modelcontextprotocol/sdk` v1.x
- **Dependencies:** `@clearschema/core` (the same parser and exporters used by the CLI)
- **Tool annotations:** All tools are marked `readOnlyHint: true` and `idempotentHint: true` -- they are pure functions with no side effects. MCP clients can auto-approve them without user confirmation.
