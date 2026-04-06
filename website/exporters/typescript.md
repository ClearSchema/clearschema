# TypeScript Exporter

Produces TypeScript type definitions from your `.clear` file.

## What It Produces

The TypeScript exporter generates TypeScript interfaces (or type aliases) with proper optional/required markers, JSDoc comments, union types, intersection types, and tuple types. The output is ready to drop into any TypeScript project.

## CLI Usage

```bash
clearschema schema.clear -f typescript -o types.ts
```

## API Usage

```typescript
import { parse, exportTypeScript } from '@clearschema/core';

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
const ts = exportTypeScript(schema);

// With options
const tsCustom = exportTypeScript(schema, {
  useInterfaces: false,     // emit type aliases instead of interfaces
  exportKeyword: 'declare', // use 'declare' instead of 'export'
  includeComments: false,   // omit JSDoc comments
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useInterfaces` | `boolean` | `true` | `true` emits `interface`, `false` emits `type` aliases. |
| `exportKeyword` | `'export' \| 'declare' \| ''` | `'export'` | Keyword placed before each type. Use `''` for no keyword. |
| `includeComments` | `boolean` | `true` | Include JSDoc comments from ClearSchema descriptions. |

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

**TypeScript output:**

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

**TypeScript output:**

```typescript
/** Mailing address */
export interface Address {
  /** Street line */
  street: string;
  /** City name */
  city: string;
  /** Postal code */
  zip?: string;
}

export interface Schema {
  home?: Address;
  work?: Address;
}
```

## Type Mapping

| ClearSchema Type | TypeScript Type |
|-----------------|-----------------|
| `string` | `string` |
| `number` | `number` |
| `integer` | `number` |
| `boolean` | `boolean` |
| `null` | `null` |
| `object` (no fields) | `Record<string, unknown>` |
| `object` (with fields) | inline `{ ... }` or named `interface` |
| `array` | `T[]` |
| `map` | `Record<string, T>` |
| `array.tuple` | `[T1, T2, ...]` |
| `string\|number` (union) | `string \| number` |
| `$ref` | resolved type name (e.g., `Address`) |
| `allOf` | `T1 & T2` (intersection) |
| `anyOf` / `oneOf` | `T1 \| T2` (union) |

## Format-Specific Notes

### Optional vs Required

Optional fields use the `?` suffix on the property name. A field is optional unless it has the `.required` inline modifier.

```typescript
// required field
name: string;
// optional field
age?: number;
```

### Nullable Fields

Nullable fields append `| null` to the type:

```typescript
middleName?: string | null;
```

### Constraints Are Not Represented

TypeScript's type system cannot express runtime constraints like `minLength`, `min`, `max`, or `pattern`. These modifiers are silently ignored in the TypeScript output. If you need runtime validation alongside your types, consider pairing the TypeScript exporter with the [Zod exporter](/exporters/zod).

### Comments

When `includeComments` is `true` (the default), each field's description appears as a JSDoc comment above the property. These comments provide IDE hover documentation in most editors.
