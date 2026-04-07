# ClearSchema Exporter

The ClearSchema exporter serializes a parsed AST back into `.clear` syntax. This enables round-trip workflows: import a JSON Schema, review or edit the `.clear` output, then export to any target format.

## What It Produces

The exporter writes idiomatic ClearSchema syntax preserving all type information, modifiers, descriptions, `$defs`, `$ref` references, composition types, and discriminated unions. The output is a valid `.clear` file that can be parsed again without loss.

## CLI Usage

The ClearSchema format is the default output for the `import` subcommand:

```bash
# Import JSON Schema and output as .clear
clearschema import schema.json -o schema.clear

# Explicit format flag
clearschema import schema.json -f clear -o schema.clear
```

## API Usage

```typescript
import { parse, exportClearSchema, importJsonSchema } from '@clearschema/core';

// Round-trip: parse, then serialize back
const schema = parse(`
  name: string.required: Full name
  age: integer: Age in years
    ^ min: 0
`);
const output = exportClearSchema(schema);
// output is valid .clear syntax

// Import then serialize
const { schema: imported } = importJsonSchema(jsonSchemaObj);
const clearText = exportClearSchema(imported);
```

## Example

**ClearSchema input:**

```clearschema
$defs:
  Address: object: Mailing address
    street: string.required: Street address
    city: string.required: City
    zip: string: Postal code
      ^ pattern: ^\d{5}$

name: string.required: Full name
address: $ref: #/$defs/Address
```

**ClearSchema output** (after parse + export round-trip):

```clearschema
$defs:
  Address: object: Mailing address
    street: string.required: Street address
    city: string.required: City
    zip: string: Postal code
      ^ pattern: ^\d{5}$

name: string.required: Full name
address: $ref: #/$defs/Address
```

The output preserves the original structure. Minor whitespace differences may occur but the semantic content is identical.

## Use Cases

### Migrating from JSON Schema

Import an existing JSON Schema file and convert it to ClearSchema as your new source of truth:

```bash
clearschema import existing-api-schema.json -o api.clear
```

Review the `.clear` file, clean up any import warnings, then use it to export to all targets:

```bash
clearschema api.clear -f typescript -o types.ts
clearschema api.clear -f pydantic -o models.py
clearschema api.clear -f zod -o validators.ts
```

### Round-Trip Testing

The exporter is used internally to verify that the parser and serializer are lossless. Any schema that parses successfully should produce identical output after a round-trip through `parse()` and `exportClearSchema()`.

## Format-Specific Notes

- Namespace, version, and target declarations are preserved when present
- Import declarations are serialized with their original paths and definition lists
- Discriminated unions use the `match(discriminator)` syntax
- Map types use the `map` type with `- valueType` child syntax
- Composition types (`allOf`, `anyOf`, `oneOf`) preserve their schema lists
- Inline modifiers (`.required`, `.nullable`) appear on the type line
- Block modifiers (`^ key: value`) appear indented below the field
