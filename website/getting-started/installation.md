# Installation

ClearSchema is distributed as a single npm package that includes both the CLI tool and the programmatic API. There are no runtime dependencies.

## Requirements

- **Node.js 20** or later

## Install as a Project Dependency

This is the recommended approach when you want to use ClearSchema in a specific project, either from scripts or from your own code:

```bash
npm install @clearschema/core
```

After installation the `clearschema` command is available via `npx`:

```bash
npx clearschema schema.clear -f json-schema
```

## Install Globally

If you want the `clearschema` command available everywhere on your system without `npx`:

```bash
npm install -g @clearschema/core
```

Verify the installation:

```bash
clearschema --help
```

## Programmatic Usage

Import functions directly in your TypeScript or JavaScript code:

```typescript
import { parse, exportJsonSchema } from '@clearschema/core';

const schema = parse(`
  name: string.required: Full name
  email: string.required: Email
    ^ format: email
`);

const jsonSchema = exportJsonSchema(schema);
console.log(JSON.stringify(jsonSchema, null, 2));
```

ClearSchema ships with full TypeScript type declarations. All AST types, option interfaces, and return types are exported from the package.

:::info
ClearSchema has **zero runtime dependencies**. The parser is hand-written and the package adds no transitive dependencies to your project.
:::

## What Gets Installed

The `@clearschema/core` package provides:

| Component | Description |
|-----------|-------------|
| `clearschema` CLI | Command-line tool for exporting and importing schemas |
| `parse()` | Parser that turns `.clear` text into an AST |
| Exporters | Functions to generate JSON Schema, TypeScript, Pydantic, Zod, OpenAPI, and LLM-compatible schemas |
| `importJsonSchema()` | Importer that converts existing JSON Schema into the ClearSchema AST |
| `resolveReferences()` | Utility to inline `$ref` references in a schema |
| `resolveImports()` | Async utility to load and merge cross-file imports |

## Editor Support

ClearSchema includes a Language Server (LSP) that provides diagnostics, autocomplete, hover documentation, go-to-definition, and document symbols for `.clear` files. See the VS Code extension for setup instructions.

## Next Steps

- [Introduction](/getting-started/introduction) -- create and export your first schema
- [CLI Reference](/reference/cli) -- all commands and flags
- [API Reference](/reference/api) -- full programmatic API documentation
