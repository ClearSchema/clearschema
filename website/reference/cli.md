# CLI Reference

The `clearschema` CLI converts `.clear` schema files to multiple output formats and imports existing JSON Schema files into the ClearSchema format.

## Basic Usage

```bash
clearschema <file> [options]
```

Parse a `.clear` file and export it. Without any flags the output is printed to stdout as JSON Schema.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format <format>` | Output format | `json-schema` |
| `-o, --output <file>` | Write output to a file instead of stdout | stdout |
| `--schema-version <version>` | JSON Schema draft version | `2020-12` |

### Valid Formats

| Format value | Output |
|-------------|--------|
| `json-schema` | JSON Schema (Draft 2020-12, 2019-09, or Draft-07) |
| `typescript` | TypeScript interfaces and type aliases |
| `pydantic` | Python Pydantic v2 model classes |
| `zod` | Zod validation schemas |
| `openapi` | OpenAPI 3.1 components document |
| `llm-schema` | Strict-mode JSON Schema for LLM structured output (OpenAI, Anthropic, Google) |

### Valid Schema Versions

Used with the `--schema-version` flag when the format is `json-schema`:

- `2020-12` (default)
- `2019-09`
- `draft-07`

## Export Examples

### JSON Schema

```bash
# Default (Draft 2020-12, stdout)
clearschema user.clear

# Explicit format, write to file
clearschema user.clear -f json-schema -o user-schema.json

# Use Draft-07
clearschema user.clear -f json-schema --schema-version draft-07 -o user-schema.json
```

### TypeScript

```bash
clearschema models.clear -f typescript -o types.ts
```

Produces TypeScript interfaces with JSDoc comments:

```typescript
export interface Schema {
  /** User's full name */
  name: string;
  /** Email address */
  email: string;
  /** Age in years */
  age?: number;
}
```

### Pydantic

```bash
clearschema models.clear -f pydantic -o models.py
```

Produces Pydantic v2 model classes:

```python
from pydantic import BaseModel, Field

class Schema(BaseModel):
    name: str = Field(..., description="User's full name", min_length=2, max_length=128)
    email: EmailStr = Field(..., description="Email address")
    age: Optional[int] = Field(None, description="Age in years", ge=0, le=150)
```

### Zod

```bash
clearschema models.clear -f zod -o validators.ts
```

Produces Zod schemas with chained validations:

```typescript
import { z } from 'zod';

export const Schema = z.object({
  name: z.string().min(2).max(128).describe("User's full name"),
  email: z.string().email().describe("Email address"),
  age: z.number().int().min(0).max(150).optional().describe("Age in years"),
});
```

### OpenAPI

```bash
clearschema models.clear -f openapi -o openapi.json
```

Produces an OpenAPI 3.1 document with your schema under `components.schemas`.

### LLM Schema

```bash
clearschema tool-definition.clear -f llm-schema -o tool-schema.json
```

Produces strict-mode JSON Schema compatible with OpenAI, Anthropic, and Google structured output APIs. All `$ref` values are inlined and `additionalProperties: false` is set on every object. Unsupported constraints (like `minLength`, `pattern`, `format`) are stripped with warnings.

## Import Subcommand

```bash
clearschema import <file> [options]
```

Convert an existing JSON Schema file into ClearSchema format. Supports JSON Schema Draft 2020-12, 2019-09, and Draft-07.

### Options

The import subcommand accepts the same flags as the export command:

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format <format>` | Output format for re-export | `clearschema` |
| `-o, --output <file>` | Write output to a file instead of stdout | stdout |

### Import Examples

```bash
# Import JSON Schema to .clear format
clearschema import existing-schema.json -o schema.clear

# Import and immediately re-export to TypeScript
clearschema import existing-schema.json -f typescript -o types.ts

# Import and re-export to Pydantic
clearschema import existing-schema.json -f pydantic -o models.py
```

:::tip
The import command is useful for migrating existing JSON Schema projects to ClearSchema. Import your schemas, review the generated `.clear` files, and use them as your new source of truth.
:::

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Parse error, file not found, or invalid options |

Parse errors include line and column information to help you locate the problem:

```
ParseError: Invalid modifier 'minLength' for number field
  --> schema.clear:3:5
```
