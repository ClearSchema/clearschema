# Phase 5: Additional Exporters

**Goal:** TypeScript and Python/Pydantic exports.

**Portfolio Value:** Shows multi-target codegen

---

## Deliverables

- [ ] TypeScript type definition export
- [ ] Python Pydantic model export
- [ ] OpenAPI 3.1 export (builds on JSON Schema)
- [ ] Smart type mapping (e.g., `format: email` → `EmailStr` in Pydantic)
- [ ] Export CLI integration

---

## TypeScript Export

### Output Format

```typescript
/** User profile */
export interface User {
  /** Full name */
  name: string;
  /** Email address */
  email: string;
  /** Age in years */
  age?: number;
}
```

### Type Mapping

| ClearSchema | TypeScript |
|-------------|------------|
| `string` | `string` |
| `number` | `number` |
| `integer` | `number` |
| `boolean` | `boolean` |
| `null` | `null` |
| `object` | `interface` |
| `array` | `T[]` |
| `array.tuple` | `[T1, T2, ...]` |
| `string\|number` | `string \| number` |
| `$ref: User` | `User` |

### Optional Fields

```typescript
// ClearSchema: age: number: Age
// TypeScript:
age?: number;

// ClearSchema: name: string.required: Name
// TypeScript:
name: string;
```

### Nullable Fields

```typescript
// ClearSchema: name: string.nullable: Name
// TypeScript:
name: string | null;

// ClearSchema: name: string.required.nullable: Name
// TypeScript:
name: string | null;
```

---

## Pydantic Export

### Output Format

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class User(BaseModel):
    """User profile"""
    name: str = Field(..., min_length=2, description="Full name")
    email: EmailStr = Field(..., description="Email address")
    age: Optional[int] = Field(None, ge=0, le=150, description="Age in years")
```

### Type Mapping

| ClearSchema | Pydantic |
|-------------|----------|
| `string` | `str` |
| `string` + `format: email` | `EmailStr` |
| `string` + `format: uri` | `HttpUrl` |
| `string` + `format: date-time` | `datetime` |
| `string` + `format: date` | `date` |
| `string` + `format: uuid` | `UUID` |
| `number` | `float` |
| `integer` | `int` |
| `integer` + `min: 1` | `PositiveInt` |
| `integer` + `min: 0` | `NonNegativeInt` |
| `boolean` | `bool` |
| `null` | `None` |
| `array` | `list[T]` |
| `object` | `BaseModel` subclass |
| `string\|number` | `str \| int` |

### Modifier Mapping

| ClearSchema | Pydantic Field |
|-------------|----------------|
| `minLength: N` | `min_length=N` |
| `maxLength: N` | `max_length=N` |
| `pattern: X` | `pattern=X` |
| `min: N` | `ge=N` |
| `max: N` | `le=N` |
| `exclusiveMin: N` | `gt=N` |
| `exclusiveMax: N` | `lt=N` |
| `default: X` | `default=X` |

---

## OpenAPI 3.1 Export

### Output Format

```yaml
openapi: 3.1.0
info:
  title: Generated API
  version: 1.0.0
components:
  schemas:
    User:
      type: object
      properties:
        name:
          type: string
          description: Full name
          minLength: 2
        email:
          type: string
          format: email
          description: Email address
      required:
        - name
        - email
```

OpenAPI 3.1 uses JSON Schema 2020-12 for its schema objects, so this largely reuses the JSON Schema exporter.

---

## Implementation Guidance

### TypeScript Exporter

```typescript
class TypeScriptExporter implements Exporter<string> {
  export(schema: Schema, options?: TypeScriptExportOptions): string {
    const lines: string[] = [];

    // Export definitions as interfaces
    for (const def of schema.definitions) {
      lines.push(this.exportInterface(def.name, def.field, options));
    }

    // Export root fields as main interface
    if (schema.fields.length > 0) {
      const rootName = options?.rootInterfaceName || 'Root';
      lines.push(this.exportRootInterface(rootName, schema.fields, options));
    }

    return lines.join('\n\n');
  }

  private exportInterface(name: string, field: ObjectField, options?: TypeScriptExportOptions): string {
    const lines: string[] = [];

    if (options?.includeDescriptions && field.description) {
      lines.push(`/** ${field.description} */`);
    }

    lines.push(`export interface ${name} {`);

    for (const child of field.fields) {
      const optional = !child.required ? '?' : '';
      const type = this.mapType(child);
      const nullable = child.nullable ? ' | null' : '';

      if (options?.includeDescriptions && child.description) {
        lines.push(`  /** ${child.description} */`);
      }
      lines.push(`  ${child.name}${optional}: ${type}${nullable};`);
    }

    lines.push('}');

    return lines.join('\n');
  }
}
```

### Pydantic Exporter

```typescript
class PydanticExporter implements Exporter<string> {
  export(schema: Schema, options?: PydanticExportOptions): string {
    const lines: string[] = [];

    // Imports
    lines.push('from pydantic import BaseModel, Field');
    lines.push(this.generateTypeImports(schema));
    lines.push('');

    // Export definitions as classes
    for (const def of schema.definitions) {
      lines.push(this.exportClass(def.name, def.field, options));
    }

    return lines.join('\n');
  }

  private mapType(field: Field): string {
    // Smart type mapping based on format
    if (field.type === 'string' && field.format === 'email') {
      return 'EmailStr';
    }
    // ... more mappings
  }
}
```

---

## Test Specifications

### TypeScript Export Tests

```typescript
describe('TypeScript Exporter', () => {
  it('exports interface', () => {
    const schema = parse(`$defs:
  User: object: User profile
    name: string.required: Full name`);

    const output = exportTypeScript(schema);

    expect(output).toContain('export interface User');
    expect(output).toContain('name: string;');
  });

  it('handles optional fields', () => {
    const schema = parse('age: number: Age');
    const output = exportTypeScript(schema);

    expect(output).toContain('age?: number');
  });

  it('handles nullable fields', () => {
    const schema = parse('name: string.nullable: Name');
    const output = exportTypeScript(schema);

    expect(output).toContain('string | null');
  });
});
```

### Pydantic Export Tests

```typescript
describe('Pydantic Exporter', () => {
  it('exports BaseModel class', () => {
    const schema = parse(`$defs:
  User: object: User
    name: string.required: Name
      ^ minLength: 2`);

    const output = exportPydantic(schema);

    expect(output).toContain('class User(BaseModel):');
    expect(output).toContain('name: str = Field(..., min_length=2');
  });

  it('uses EmailStr for email format', () => {
    const schema = parse(`email: string: Email
  ^ format: email`);

    const output = exportPydantic(schema);

    expect(output).toContain('EmailStr');
  });

  it('handles optional fields', () => {
    const schema = parse('age: number: Age');
    const output = exportPydantic(schema);

    expect(output).toContain('Optional[float]');
    expect(output).toContain('= None');
  });
});
```

---

## Acceptance Criteria

- [ ] TypeScript export produces valid TypeScript
- [ ] Pydantic export produces valid Python
- [ ] Smart type mapping works (format → specialized types)
- [ ] Optional/required fields handled correctly
- [ ] Nullable fields handled correctly
- [ ] Nested objects export as separate interfaces/classes
- [ ] References export as type references
- [ ] All tests pass with 100% coverage

---

## Future Considerations

- Zod schema export
- Go struct export
- Rust struct export
- GraphQL type export
