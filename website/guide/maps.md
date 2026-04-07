# Maps

ClearSchema supports `map` types for string-keyed dictionaries. A map is an object where the keys are arbitrary strings and all values share the same type.

## Syntax

```clearschema
fieldName: map: description
  - valueType
```

The value type is specified as a child item using the `- ` prefix, the same syntax used for array item types.

## Basic Examples

### Map with primitive values

```clearschema
metadata: map: Arbitrary key-value metadata
  - string
```

Produces a dictionary from strings to strings.

### Map with numeric values

```clearschema
scores: map.required: Player scores by name
  - number
```

### Map with object values

```clearschema
configs: map: Service configurations
  - object:
    host: string.required: Hostname
    port: integer.required: Port number
    enabled: boolean: Whether the service is active
      ^ default: true
```

### Map with $ref values

```clearschema
$defs:
  User: object: A user
    name: string.required
    email: string.required

users: map: Users indexed by ID
  - $ref: #/$defs/User
```

## Modifiers

Maps support the standard inline modifiers:

```clearschema
tags: map.required.nullable: Resource tags
  - string
```

## Export Targets

### JSON Schema

Maps compile to `additionalProperties`:

```json
{
  "type": "object",
  "additionalProperties": {
    "type": "string"
  },
  "description": "Arbitrary key-value metadata"
}
```

### TypeScript

Maps compile to `Record<string, T>`:

```typescript
/** Arbitrary key-value metadata */
metadata?: Record<string, string>;
```

### Pydantic

Maps compile to `Dict[str, T]`:

```python
metadata: Optional[Dict[str, str]] = Field(None, description="Arbitrary key-value metadata")
```

### Zod

Maps compile to `z.record()`:

```typescript
metadata: z.record(z.string(), z.string()).optional().describe("Arbitrary key-value metadata"),
```

### OpenAPI

Maps use the same `additionalProperties` pattern as JSON Schema, within an OpenAPI components document.

### LLM Schema

Map fields are omitted from LLM structured output schemas because `additionalProperties` is not supported in strict mode. A warning is emitted when this happens:

```
Warning: Map field 'metadata' omitted from LLM structured output (additionalProperties not supported in strict mode)
```

If you need dynamic key-value data in LLM structured output, consider using an array of key-value pair objects instead.

## When to Use

Use `map` when:

- You need a dictionary or hash map with string keys
- The keys are dynamic or user-defined (not a fixed set of known properties)
- All values share the same type

Use `object` instead when:

- You have a fixed, known set of property names
- Different properties have different types
- You want validation on specific named fields
