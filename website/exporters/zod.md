# Zod Exporter

Produces Zod v3 runtime validation schemas from your `.clear` file.

## What It Produces

The Zod exporter generates TypeScript code that defines Zod schemas with full constraint mapping. The output includes the `import { z } from 'zod'` statement and exports each schema as a named `const`. You get runtime validation that mirrors the same contract described in your `.clear` file.

::: warning Peer Dependency
Zod must be installed in your project. The generated code imports from `'zod'` but ClearSchema does not bundle it.

```bash
npm install zod
```
:::

## CLI Usage

```bash
clearschema schema.clear -f zod -o validators.ts
```

## API Usage

```typescript
import { parse, exportZod } from '@clearschema/core';

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

// Default options
const zod = exportZod(schema);

// With options
const zodCustom = exportZod(schema, {
  includeDescriptions: false,  // omit .describe() calls
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeDescriptions` | `boolean` | `true` | Append `.describe("...")` to each field with a description. |

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

**Zod output:**

```typescript
import { z } from 'zod';

export const Schema = z.object({
  name: z.string().min(2).max(128).describe("User's full name"),
  email: z.string().email().describe("Email address"),
  age: z.number().int().min(0).max(150).optional().describe("Age in years"),
});
```

### With `$defs`

**ClearSchema input:**

```clearschema
$defs:
  Address: object: Mailing address
    street: string.required: Street line
    city: string.required: City name
    zip: string: Postal code

home: $ref: #/$defs/Address
work: $ref: #/$defs/Address
```

**Zod output:**

```typescript
import { z } from 'zod';

export const AddressSchema = z.object({
  street: z.string().describe("Street line"),
  city: z.string().describe("City name"),
  zip: z.string().optional().describe("Postal code"),
});

export const Schema = z.object({
  home: AddressSchema.optional(),
  work: AddressSchema.optional(),
});
```

## Constraint Mapping

ClearSchema modifiers are translated to Zod method chains:

### String Constraints

| ClearSchema Modifier | Zod Method |
|---------------------|------------|
| `minLength: N` | `.min(N)` |
| `maxLength: N` | `.max(N)` |
| `pattern: regex` | `.regex(/regex/)` |
| `format: email` | `.email()` |
| `format: uri` | `.url()` |
| `format: uuid` | `.uuid()` |
| `format: date-time` | `.datetime()` |

### Number Constraints

| ClearSchema Modifier | Zod Method |
|---------------------|------------|
| `min: N` | `.min(N)` |
| `max: N` | `.max(N)` |
| `exclusiveMin: N` | `.gt(N)` |
| `exclusiveMax: N` | `.lt(N)` |
| `multipleOf: N` | `.multipleOf(N)` |
| (integer type) | `.int()` |

### Array Constraints

| ClearSchema Modifier | Zod Method |
|---------------------|------------|
| `minItems: N` | `.min(N)` |
| `maxItems: N` | `.max(N)` |

### Universal Modifiers

| ClearSchema Modifier | Zod Method |
|---------------------|------------|
| (optional field) | `.optional()` |
| `.nullable` | `.nullable()` |
| `default: value` | `.default(value)` |
| `const: value` | `z.literal(value)` |
| `enum: [...]` (all strings) | `z.enum([...])` |
| `enum: [...]` (mixed) | `z.union([z.literal(...), ...])` |
| description text | `.describe("...")` |

## Type Mapping

| ClearSchema Type | Zod Schema |
|-----------------|------------|
| `string` | `z.string()` |
| `number` | `z.number()` |
| `integer` | `z.number().int()` |
| `boolean` | `z.boolean()` |
| `null` | `z.null()` |
| `object` | `z.object({...})` |
| `array` | `z.array(...)` |
| `map` | `z.record(z.string(), ...)` |
| `array.tuple` | `z.tuple([...])` |
| `union` | `z.union([...])` |
| `$ref` | reference to named `Schema` const |
| `allOf` (2 schemas) | `z.intersection(a, b)` |
| `allOf` (3+ schemas) | `z.intersection(a, b).and(c)` |
| `anyOf` / `oneOf` | `z.union([...])` |

## Format-Specific Notes

### Naming Convention

Definitions from `$defs` are exported with a `Schema` suffix. For example, a definition named `User` becomes `export const UserSchema`. Root-level fields are always grouped into `export const Schema`.

### Pairing with TypeScript Output

A common pattern is to generate both TypeScript types and Zod validators from the same `.clear` file. The TypeScript types give you compile-time safety, while the Zod schemas give you runtime validation:

```bash
clearschema models.clear -f typescript -o types.ts
clearschema models.clear -f zod -o validators.ts
```

You can also infer TypeScript types directly from Zod schemas using `z.infer`:

```typescript
import { Schema } from './validators';
type SchemaType = z.infer<typeof Schema>;
```

### `$ref` Resolution

References to `$defs` are translated to the corresponding named `Schema` const (e.g., `#/$defs/Address` becomes `AddressSchema`). This means all definitions must be exported before they are referenced.
