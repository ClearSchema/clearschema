# API Reference

ClearSchema exposes a programmatic API through the `@clearschema/core` package. All functions, types, and interfaces are available as named exports.

```typescript
import { parse, exportJsonSchema, exportTypeScript } from '@clearschema/core';
```

## parse

Parse a ClearSchema string into an AST.

```typescript
function parse(input: string): Schema
```

**Parameters:**
- `input` -- a string containing ClearSchema syntax

**Returns:** a `Schema` object containing `fields`, `definitions`, and `imports` arrays.

**Throws:** `ParseError` with line/column information if the input is invalid.

**Example:**

```typescript
import { parse } from '@clearschema/core';

const schema = parse(`
  name: string.required: Full name
    ^ minLength: 2
  email: string.required: Email
    ^ format: email
  age: integer: Age in years
    ^ min: 0
`);

console.log(schema.fields.length); // 3
console.log(schema.fields[0].name); // "name"
console.log(schema.fields[0].type); // "string"
```

---

## exportJsonSchema

Export a schema to JSON Schema.

```typescript
function exportJsonSchema(
  schema: Schema,
  options?: JsonSchemaExportOptions
): JsonSchema
```

**Options (`JsonSchemaExportOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schemaVersion` | `'2020-12' \| '2019-09' \| 'draft-07'` | `'2020-12'` | JSON Schema draft version |
| `includeDescriptions` | `boolean` | -- | Include field descriptions |
| `includeDefaults` | `boolean` | -- | Include default values |
| `rootId` | `string` | -- | Set the `$id` of the root schema |

**Returns:** a `JsonSchema` object.

**Example:**

```typescript
import { parse, exportJsonSchema } from '@clearschema/core';

const schema = parse(`name: string.required: Full name`);

const jsonSchema = exportJsonSchema(schema, {
  schemaVersion: 'draft-07',
  rootId: 'https://example.com/user.json',
});

console.log(JSON.stringify(jsonSchema, null, 2));
```

---

## exportTypeScript

Export a schema to TypeScript type declarations.

```typescript
function exportTypeScript(
  schema: Schema,
  options?: TypeScriptExportOptions
): string
```

**Options (`TypeScriptExportOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useInterfaces` | `boolean` | `true` | Use `interface` for objects; `false` uses `type` |
| `exportKeyword` | `'export' \| 'declare' \| ''` | `'export'` | Keyword before each declaration |
| `includeComments` | `boolean` | `true` | Include JSDoc comments from descriptions |

**Returns:** a string containing TypeScript source code.

**Example:**

```typescript
import { parse, exportTypeScript } from '@clearschema/core';

const schema = parse(`
  name: string.required: Full name
  age: integer: Age
`);

const ts = exportTypeScript(schema, { useInterfaces: true });
console.log(ts);
// export interface Schema {
//   /** Full name */
//   name: string;
//   /** Age */
//   age?: number;
// }
```

---

## exportPydantic

Export a schema to Python Pydantic v2 model classes.

```typescript
function exportPydantic(
  schema: Schema,
  options?: PydanticExportOptions
): string
```

**Options (`PydanticExportOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeComments` | `boolean` | `true` | Include docstrings and field descriptions |
| `useTyping` | `boolean` | `true` | Use `typing.Optional` vs `\| None` syntax |

**Returns:** a string containing Python source code.

**Example:**

```typescript
import { parse, exportPydantic } from '@clearschema/core';

const schema = parse(`
  name: string.required: Full name
  active: boolean: Is active
    ^ default: true
`);

const python = exportPydantic(schema);
console.log(python);
```

---

## exportZod

Export a schema to Zod validation schemas.

```typescript
function exportZod(
  schema: Schema,
  options?: ZodExportOptions
): string
```

**Options (`ZodExportOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeDescriptions` | `boolean` | `true` | Append `.describe()` calls from field descriptions |

**Returns:** a string containing TypeScript source code with Zod schemas.

**Example:**

```typescript
import { parse, exportZod } from '@clearschema/core';

const schema = parse(`
  email: string.required: Email address
    ^ format: email
  count: integer: Item count
    ^ min: 0
`);

const zod = exportZod(schema);
console.log(zod);
// import { z } from 'zod';
//
// export const Schema = z.object({
//   email: z.string().email().describe("Email address"),
//   count: z.number().int().min(0).optional().describe("Item count"),
// });
```

---

## exportOpenAPI

Export a schema to an OpenAPI 3.1 document.

```typescript
function exportOpenAPI(
  schema: Schema,
  options?: OpenAPIExportOptions
): OpenAPISchema
```

**Options (`OpenAPIExportOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string` | `'Generated API'` | API title in `info.title` |
| `version` | `string` | `'1.0.0'` | API version in `info.version` |
| `description` | `string` | -- | API description |
| `serverUrl` | `string` | -- | Server URL to include in `servers` |

**Returns:** an `OpenAPISchema` object with `openapi`, `info`, and `components.schemas`.

**Example:**

```typescript
import { parse, exportOpenAPI } from '@clearschema/core';

const schema = parse(`
  name: string.required: Full name
  email: string.required: Email
`);

const openapi = exportOpenAPI(schema, {
  title: 'User Service',
  version: '2.0.0',
  description: 'User management API schemas',
  serverUrl: 'https://api.example.com',
});

console.log(JSON.stringify(openapi, null, 2));
```

---

## exportLlmSchema

Export a schema to strict-mode JSON Schema suitable for LLM structured output APIs (OpenAI, Anthropic, Google).

```typescript
function exportLlmSchema(
  schema: Schema,
  options?: LlmSchemaExportOptions
): LlmSchemaResult
```

**Options (`LlmSchemaExportOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxDepth` | `number` | `5` | Maximum nesting depth before truncation |
| `maxProperties` | `number` | `100` | Maximum number of properties |

**Returns:** an `LlmSchemaResult` with two fields:
- `schema` -- the strict-mode JSON Schema object (all `$ref` inlined, `additionalProperties: false` on every object, unsupported keywords removed)
- `warnings` -- an array of strings describing any constraints that were stripped

**Example:**

```typescript
import { parse, exportLlmSchema } from '@clearschema/core';

const schema = parse(`
  name: string.required: User name
  age: integer.required: Age
    ^ min: 0
`);

const { schema: llmSchema, warnings } = exportLlmSchema(schema);

// warnings may include: "Removed unsupported keyword 'minimum' from 'age'"
console.log(JSON.stringify(llmSchema, null, 2));
```

:::warning
The LLM exporter intentionally strips constraints like `minLength`, `maxLength`, `pattern`, `format`, `minimum`, `maximum`, `minItems`, and `maxItems` because these are not supported by most LLM structured output APIs. Check the `warnings` array to see what was removed.
:::

---

## importJsonSchema

Import an existing JSON Schema object into the ClearSchema AST.

```typescript
function importJsonSchema(
  input: any,
  options?: JsonSchemaImportOptions
): ImportResult
```

**Options (`JsonSchemaImportOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultDraft` | `'2020-12' \| '2019-09' \| 'draft-07'` | `'2020-12'` | Fallback draft when `$schema` URI is absent |

**Returns:** an `ImportResult` with:
- `schema` -- the imported `Schema` AST
- `warnings` -- an array of strings for unsupported or ambiguous constructs

**Example:**

```typescript
import { importJsonSchema, exportClearSchema } from '@clearschema/core';

const jsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Full name' },
    age: { type: 'integer', minimum: 0 },
  },
  required: ['name'],
};

const { schema, warnings } = importJsonSchema(jsonSchema);
const clearText = exportClearSchema(schema);
console.log(clearText);
// name: string.required: Full name
// age: integer: 
//   ^ min: 0
```

---

## exportClearSchema

Serialize a `Schema` AST back to ClearSchema text. This is the inverse of `parse`.

```typescript
function exportClearSchema(schema: Schema): string
```

**Parameters:**
- `schema` -- a `Schema` AST object

**Returns:** a string in ClearSchema syntax.

**Example:**

```typescript
import { parse, exportClearSchema } from '@clearschema/core';

const schema = parse(`
  name: string.required: Full name
    ^ minLength: 2
`);

const text = exportClearSchema(schema);
console.log(text);
// name: string.required: Full name
//   ^ minLength: 2
```

:::tip
Combine `importJsonSchema` with `exportClearSchema` to convert existing JSON Schema files to `.clear` format programmatically.
:::

---

## resolveReferences

Inline all `$ref` references within a schema by replacing them with the referenced definition content.

```typescript
function resolveReferences(schema: Schema): Schema
```

**Parameters:**
- `schema` -- a `Schema` containing `$ref` fields and a `$defs` section

**Returns:** a new `Schema` with all `$ref` fields replaced by their resolved definitions.

**Example:**

```typescript
import { parse, resolveReferences, exportJsonSchema } from '@clearschema/core';

const schema = parse(`
  $defs:
    Address: object: Mailing address
      street: string.required: Street
      city: string.required: City

  home: $ref: #/$defs/Address
  work: $ref: #/$defs/Address
`);

const resolved = resolveReferences(schema);
// resolved.fields[0] is now a full object field, not a $ref
const json = exportJsonSchema(resolved);
```

---

## resolveImports

Asynchronously load and merge schemas from `import:` declarations.

```typescript
async function resolveImports(
  schema: Schema,
  options?: ResolverOptions
): Promise<ResolvedSchema>
```

**Options (`ResolverOptions`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `basePath` | `string` | `'./'` | Base directory for resolving relative import paths |
| `fileLoader` | `(path: string) => Promise<string>` | Node.js `fs.readFile` | Custom function to load file contents |

**Returns:** a `ResolvedSchema` (extends `Schema`) with a `resolvedImports` map containing the loaded schemas.

**Throws:** an error if a circular import is detected.

**Example:**

```typescript
import { parse, resolveImports } from '@clearschema/core';

const schema = parse(`
  import: ./common/types.clear
    - Address
    - User

  home: $ref: Address
`);

const resolved = await resolveImports(schema, {
  basePath: './schemas',
});
// resolved now contains the Address and User definitions
// merged from ./schemas/common/types.clear
```

---

## Type Exports

The package also exports all AST types for use in your own tooling:

```typescript
import type {
  Schema,
  Field,
  StringField,
  NumberField,
  BooleanField,
  NullField,
  ObjectField,
  ArrayField,
  MapField,
  TupleArrayField,
  UnionField,
  RefField,
  CompositionField,
  SchemaDefinition,
  ImportDeclaration,
  Modifier,
  SourceLocation,
} from '@clearschema/core';
```

See the [Types guide](/guide/types) for details on each field type and how they map to the AST.
