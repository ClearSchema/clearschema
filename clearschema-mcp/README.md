# @clearschema/mcp

MCP server for [ClearSchema](https://github.com/ClearSchema/ClearSchema) -- exposes schema compilation, validation, import, and introspection as tools for AI editors.

Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.

## Installation

```bash
npm install @clearschema/mcp
```

Or run directly with npx:

```bash
npx @clearschema/mcp
```

## Configuration

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

## Tools

### list_exporters

List all available export formats and their descriptions. Call this first to discover valid format names for `compile_schema`.

### compile_schema

Compile ClearSchema source code into a target format.

**Parameters:**
- `source` -- ClearSchema source code
- `target` -- format name (use `list_exporters` to see options)

**Supported formats:** `json-schema`, `typescript`, `pydantic`, `openapi`, `zod`, `llm-schema`, `clearschema`

### validate_schema

Check ClearSchema source for syntax errors without producing output. Returns structured diagnostics with line and column numbers.

**Parameters:**
- `source` -- ClearSchema source code

### import_json_schema

Convert a JSON Schema document into ClearSchema syntax.

**Parameters:**
- `jsonSchema` -- JSON Schema as a JSON string

### inspect_schema

Parse ClearSchema source and return a structured JSON summary of defined types, fields, references, and composition structure. Useful for understanding a schema without compiling it.

**Parameters:**
- `source` -- ClearSchema source code

## Example Usage

Once configured, your AI editor can:

```
"Compile this schema to TypeScript"
"Validate my .clear file for syntax errors"
"Convert this JSON Schema to ClearSchema"
"What types are defined in this schema?"
```

## Requirements

- Node.js >= 20
- `@clearschema/core` (included as dependency)

## License

MIT
