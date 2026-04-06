# LLM Structured Output Exporter

Produces a strict JSON Schema subset optimized for LLM structured output APIs.

## What It Produces

The LLM Schema exporter generates a JSON Schema document that conforms to the strict subset required by **OpenAI**, **Anthropic**, and **Google** structured output APIs. It takes a standard ClearSchema definition and post-processes the JSON Schema output to enforce the constraints these APIs require:

- `additionalProperties: false` on every object
- All properties listed in `required` (no optional fields)
- All `$ref` references inlined (no `$defs` or `$ref` in the output)
- Unsupported keywords stripped (with warnings)
- Nesting depth and property count validated

The result is a `{ schema, warnings }` object where `schema` is the strict JSON Schema and `warnings` lists any modifications made during post-processing.

## CLI Usage

```bash
clearschema schema.clear -f llm-schema -o tool-schema.json
```

## API Usage

```typescript
import { parse, exportLlmSchema } from '@clearschema/core';

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
const { schema: llmSchema, warnings } = exportLlmSchema(schema);

// With custom limits
const result = exportLlmSchema(schema, {
  maxDepth: 3,         // warn if nesting exceeds 3 levels
  maxProperties: 50,   // warn if total properties exceed 50
});

// Check warnings
if (result.warnings.length > 0) {
  console.warn('LLM schema warnings:', result.warnings);
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxDepth` | `number` | `5` | Maximum allowed object nesting depth. Exceeding this produces a warning. |
| `maxProperties` | `number` | `100` | Maximum total property count across all objects. Exceeding this produces a warning. |

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

**LLM Schema output:**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "User's full name"
    },
    "email": {
      "type": "string",
      "description": "Email address"
    },
    "age": {
      "type": "integer",
      "description": "Age in years"
    }
  },
  "required": ["name", "email", "age"],
  "additionalProperties": false
}
```

**Warnings produced:**

```
Dropped 'minLength' constraint from properties.name
Dropped 'maxLength' constraint from properties.name
Dropped 'format' constraint from properties.email
Dropped 'minimum' constraint from properties.age
Dropped 'maximum' constraint from properties.age
```

Notice the key differences from a standard JSON Schema export:

- No `$schema` URI
- `additionalProperties: false` is set
- `age` is included in `required` even though it was not `.required` in the source (all fields must be required for LLM structured output)
- Constraints like `minLength`, `maxLength`, `format`, `minimum`, and `maximum` are stripped

## Stripped Keywords

The following JSON Schema keywords are removed from the output because they are not supported by LLM structured output APIs:

| Keyword | Reason |
|---------|--------|
| `default` | LLMs do not apply defaults |
| `examples` | Not used by structured output parsers |
| `const` | Not supported in strict mode |
| `minimum` / `maximum` | Numeric constraints not enforced |
| `minLength` / `maxLength` | String length constraints not enforced |
| `pattern` | Regex constraints not enforced |
| `minItems` / `maxItems` | Array size constraints not enforced |
| `format` | Format validation not enforced |

Each stripped keyword produces a warning so you know exactly what was removed.

## Validation Checks

### Nesting Depth

LLM APIs typically limit how deeply objects can be nested. The exporter counts object nesting levels and warns if the depth exceeds `maxDepth` (default: 5).

### Property Count

LLM APIs limit the total number of properties across the entire schema. The exporter counts all properties recursively and warns if the count exceeds `maxProperties` (default: 100).

### Circular References

Circular `$ref` chains are detected and produce an error. LLM structured output schemas must be finite and fully inlined, so circular references cannot be represented:

```
Error: Recursive schemas are not supported in LLM structured output mode
```

## Format-Specific Notes

### All Fields Become Required

In LLM structured output mode, every property on every object is added to the `required` array, regardless of whether it was marked `.required` in the ClearSchema source. This is mandated by the structured output specification -- LLMs must return all declared fields.

If you want a field to be truly optional in the LLM response, model it as a nullable type instead:

```clearschema
nickname: string.nullable: Optional nickname
```

This produces `"type": ["string", "null"]` in the output, allowing the LLM to return `null` for that field.

### No `$ref` or `$defs`

All `$ref` references are fully inlined into the schema. The `$defs` section is removed from the output entirely. If the same definition is referenced in multiple places, it will be duplicated at each reference point.

### Map Types Are Omitted

Map/dictionary types (`map` in ClearSchema, `additionalProperties` in JSON Schema) are not supported by LLM structured output APIs. Any map fields are removed from the output and a warning is produced.

### No `$schema` or `$id`

The `$schema` and `$id` keywords are removed from the output since they are not relevant to LLM structured output contexts.

### Using with OpenAI

Pass the generated schema directly to the `response_format` parameter:

```typescript
const { schema } = exportLlmSchema(parsed);

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Extract user info from: ...' }],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'user_extraction',
      strict: true,
      schema: schema,
    },
  },
});
```

### Using with Anthropic

Pass the schema as a tool definition:

```typescript
const { schema } = exportLlmSchema(parsed);

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  tools: [{
    name: 'extract_user',
    description: 'Extract user information',
    input_schema: schema,
  }],
  messages: [{ role: 'user', content: 'Extract user info from: ...' }],
});
```
