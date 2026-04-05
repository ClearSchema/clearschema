# JSON Schema Exporter

Produces a standards-compliant JSON Schema document from your `.clear` file.

## What It Produces

The JSON Schema exporter generates a JSON Schema object conforming to **Draft 2020-12** by default. It also supports **Draft 2019-09** and **Draft-07**. The output includes a `$schema` URI, a root `type: "object"`, `properties`, `required`, and optional `$defs` for reusable definitions.

## CLI Usage

```bash
# Default (Draft 2020-12)
clearschema schema.clear -f json-schema -o schema.json

# Specify a draft version
clearschema schema.clear -f json-schema --schema-version draft-07 -o schema.json
clearschema schema.clear -f json-schema --schema-version 2019-09 -o schema.json
clearschema schema.clear -f json-schema --schema-version 2020-12 -o schema.json
```

## API Usage

```typescript
import { parse, exportJsonSchema } from '@clearschema/core';

const schema = parse(`
  name: string.required: User's full name
    ^ minLength: 2
    ^ maxLength: 128
  email: string.required: Email address
    ^ format: email
  age: integer: Age in years
    ^ min: 0
    ^ max: 150
`);

// Default options (Draft 2020-12)
const jsonSchema = exportJsonSchema(schema);

// With options
const jsonSchemaDraft07 = exportJsonSchema(schema, {
  schemaVersion: 'draft-07',
  includeDescriptions: true,
  includeDefaults: true,
  rootId: 'https://example.com/user.schema.json',
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schemaVersion` | `'2020-12' \| '2019-09' \| 'draft-07'` | `'2020-12'` | Which JSON Schema draft to target. |
| `includeDescriptions` | `boolean` | `true` | Include `description` fields from ClearSchema comments. |
| `includeDefaults` | `boolean` | `true` | Include `default` values in the output. |
| `rootId` | `string` | (none) | Set a `$id` on the root schema object. |

## Example

**ClearSchema input:**

```clearschema
name: string.required: User's full name
  ^ minLength: 2
  ^ maxLength: 128

email: string.required: Email address
  ^ format: email

age: integer: Age in years
  ^ min: 0
  ^ max: 150
```

**JSON Schema output (Draft 2020-12):**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "User's full name",
      "minLength": 2,
      "maxLength": 128
    },
    "email": {
      "type": "string",
      "description": "Email address",
      "format": "email"
    },
    "age": {
      "type": "integer",
      "description": "Age in years",
      "minimum": 0,
      "maximum": 150
    }
  },
  "required": ["name", "email"]
}
```

## Modifier Mapping

ClearSchema modifiers map directly to JSON Schema keywords:

| ClearSchema Modifier | JSON Schema Keyword |
|---------------------|---------------------|
| `minLength` | `minLength` |
| `maxLength` | `maxLength` |
| `pattern` | `pattern` |
| `format` | `format` |
| `min` | `minimum` |
| `max` | `maximum` |
| `exclusiveMin` | `exclusiveMinimum` |
| `exclusiveMax` | `exclusiveMaximum` |
| `multipleOf` | `multipleOf` |
| `minItems` | `minItems` |
| `maxItems` | `maxItems` |
| `uniqueItems` | `uniqueItems` |
| `default` | `default` |
| `const` | `const` |
| `enum` | `enum` |

## Format-Specific Notes

### Differences Between Draft Versions

- **Draft 2020-12** (default): Uses `$schema: "https://json-schema.org/draft/2020-12/schema"`. Tuples use `prefixItems` with `items: false`.
- **Draft 2019-09**: Uses `$schema: "https://json-schema.org/draft/2019-09/schema"`. Identical structure to 2020-12 in most cases.
- **Draft-07**: Uses `$schema: "http://json-schema.org/draft-07/schema#"` (note `http`, not `https`, and the trailing `#`).

### Nullable Fields

Nullable fields are represented using `anyOf` with a null type:

```json
{
  "anyOf": [
    { "type": "string" },
    { "type": "null" }
  ]
}
```

### Union Types

Union types (e.g., `string|number`) are exported as `anyOf`:

```json
{
  "anyOf": [
    { "type": "string" },
    { "type": "number" }
  ]
}
```

### Schema References

`$defs` and `$ref` are preserved as-is in the output. Use `resolveReferences()` before exporting if you want all references inlined.
