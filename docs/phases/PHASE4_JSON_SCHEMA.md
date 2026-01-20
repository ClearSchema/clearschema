# Phase 4: JSON Schema Export

**Goal:** Complete JSON Schema Draft 2020-12 export.

**Portfolio Value:** Minimum viable portfolio piece

---

## Deliverables

- [ ] Exporter architecture with visitor pattern
- [ ] Type mapping for all field types
- [ ] Modifier to constraint mapping
- [ ] `$defs` and `$ref` export
- [ ] Composition type export (allOf, anyOf, oneOf)
- [ ] Export options (schema version, titles, descriptions)
- [ ] Comprehensive export tests
- [ ] Snapshot tests for output stability

---

## Output Format

JSON Schema Draft 2020-12:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Full name",
      "minLength": 2
    },
    "email": {
      "type": "string",
      "description": "Email address",
      "format": "email"
    },
    "age": {
      "type": "number",
      "description": "Age in years",
      "minimum": 0,
      "maximum": 150
    }
  },
  "required": ["name", "email"]
}
```

---

## Implementation Guidance

### Exporter Interface

```typescript
interface Exporter<T> {
  export(schema: Schema, options?: ExportOptions): T;
}

interface JsonSchemaExportOptions extends ExportOptions {
  schemaVersion?: '2020-12' | '2019-09' | 'draft-07';
  includeDescriptions?: boolean;
  includeDefaults?: boolean;
  rootId?: string;
}
```

### Visitor Pattern

```typescript
class JsonSchemaExporter implements Exporter<JsonSchema> {
  export(schema: Schema, options?: JsonSchemaExportOptions): JsonSchema {
    const result: JsonSchema = {
      $schema: this.getSchemaUri(options?.schemaVersion),
      type: 'object',
      properties: {},
      required: []
    };

    // Export definitions
    if (schema.definitions.length > 0) {
      result.$defs = {};
      for (const def of schema.definitions) {
        result.$defs[def.name] = this.exportField(def.field, options);
      }
    }

    // Export fields
    for (const field of schema.fields) {
      result.properties[field.name] = this.exportField(field, options);
      if (field.required) {
        result.required.push(field.name);
      }
    }

    return result;
  }

  private exportField(field: Field, options?: JsonSchemaExportOptions): JsonSchemaField {
    switch (field.type) {
      case 'string': return this.exportString(field, options);
      case 'number':
      case 'integer': return this.exportNumber(field, options);
      case 'boolean': return this.exportBoolean(field, options);
      case 'null': return this.exportNull(field, options);
      case 'object': return this.exportObject(field, options);
      case 'array': return this.exportArray(field, options);
      case 'array.tuple': return this.exportTuple(field, options);
      case 'union': return this.exportUnion(field, options);
      case 'ref': return this.exportRef(field, options);
      // ... composition types
    }
  }
}
```

### Type Mapping

| ClearSchema | JSON Schema |
|-------------|-------------|
| `string` | `{ "type": "string" }` |
| `number` | `{ "type": "number" }` |
| `integer` | `{ "type": "integer" }` |
| `boolean` | `{ "type": "boolean" }` |
| `null` | `{ "type": "null" }` |
| `object` | `{ "type": "object", "properties": {...} }` |
| `array` | `{ "type": "array", "items": {...} }` |
| `array.tuple` | `{ "type": "array", "prefixItems": [...], "items": false }` |
| `string\|number` | `{ "anyOf": [{"type": "string"}, {"type": "number"}] }` |
| `$ref: #/$defs/X` | `{ "$ref": "#/$defs/X" }` |

### Modifier Mapping

| ClearSchema | JSON Schema |
|-------------|-------------|
| `minLength: N` | `minLength: N` |
| `maxLength: N` | `maxLength: N` |
| `pattern: X` | `pattern: X` |
| `format: X` | `format: X` |
| `min: N` | `minimum: N` |
| `max: N` | `maximum: N` |
| `exclusiveMin: N` | `exclusiveMinimum: N` |
| `exclusiveMax: N` | `exclusiveMaximum: N` |
| `multipleOf: N` | `multipleOf: N` |
| `minItems: N` | `minItems: N` |
| `maxItems: N` | `maxItems: N` |
| `uniqueItems: true` | `uniqueItems: true` |
| `default: X` | `default: X` |
| `const: X` | `const: X` |
| `enum: [...]` | `enum: [...]` |

### Nullable Handling

```typescript
// ClearSchema: name: string.nullable: Name
// JSON Schema:
{
  "anyOf": [
    { "type": "string" },
    { "type": "null" }
  ]
}
// OR using type array:
{
  "type": ["string", "null"]
}
```

---

## Test Specifications

### Export Tests (`tests/unit/exporters/json-schema.test.ts`)

```typescript
describe('JSON Schema Exporter', () => {
  describe('primitive types', () => {
    it('exports string field', () => {
      const schema = parse('name: string: User name');
      const output = exportJsonSchema(schema);

      expect(output.properties.name).toEqual({
        type: 'string',
        description: 'User name'
      });
    });

    it('exports string with modifiers', () => {
      const schema = parse(`email: string: Email
  ^ format: email
  ^ minLength: 5`);
      const output = exportJsonSchema(schema);

      expect(output.properties.email).toEqual({
        type: 'string',
        description: 'Email',
        format: 'email',
        minLength: 5
      });
    });

    it('exports required fields', () => {
      const schema = parse('name: string.required: Name');
      const output = exportJsonSchema(schema);

      expect(output.required).toContain('name');
    });
  });

  describe('complex types', () => {
    it('exports nested object', () => {
      const schema = parse(`user: object: User
  name: string.required: Name`);
      const output = exportJsonSchema(schema);

      expect(output.properties.user).toEqual({
        type: 'object',
        description: 'User',
        properties: {
          name: { type: 'string', description: 'Name' }
        },
        required: ['name']
      });
    });

    it('exports array with items', () => {
      const schema = parse(`tags: array: Tags
  - string`);
      const output = exportJsonSchema(schema);

      expect(output.properties.tags).toEqual({
        type: 'array',
        description: 'Tags',
        items: { type: 'string' }
      });
    });
  });

  describe('references', () => {
    it('exports $defs and $ref', () => {
      const schema = parse(`$defs:
  User: object: User
    name: string: Name

user: $ref: #/$defs/User`);
      const output = exportJsonSchema(schema);

      expect(output.$defs.User).toBeDefined();
      expect(output.properties.user).toEqual({
        $ref: '#/$defs/User'
      });
    });
  });
});
```

### Snapshot Tests (`tests/snapshots/`)

```typescript
describe('JSON Schema Export Snapshots', () => {
  it('matches snapshot for complex schema', () => {
    const input = readFixture('complex-user.cs');
    const output = exportJsonSchema(parse(input));

    expect(output).toMatchSnapshot();
  });
});
```

---

## Acceptance Criteria

- [ ] JSON Schema export passes JSON Schema meta-validation
- [ ] Exported schemas validate same data as ClearSchema
- [ ] All modifier constraints correctly mapped
- [ ] `$defs` and `$ref` export correctly
- [ ] Nullable fields export correctly
- [ ] Union types export as `anyOf`
- [ ] Composition types (allOf, anyOf, oneOf) export correctly
- [ ] Snapshot tests ensure output stability
- [ ] All tests pass with 100% coverage

---

## Validation

Use a JSON Schema validator to verify exported schemas:

```typescript
import Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(exportedSchema);

// Test with valid data
expect(validate({ name: 'John' })).toBe(true);

// Test with invalid data
expect(validate({ name: 123 })).toBe(false);
```
