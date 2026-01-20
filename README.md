# ClearSchema

**A human-readable schema definition language. Write once, export everywhere.**

Your schema is a contract. Write it in a format humans can read and review. Generate the boring, repetitive code.

---

## Quick Example

**ClearSchema (9 lines):**
```yaml
name: string.required: User's full name
  ^ range: [2, 128]

email: string.required: Email address
  ^ format: email

age: integer: Age in years
  ^ range: [0, 150]
```

**Exports to JSON Schema, TypeScript, Pydantic, and more.**

<details>
<summary>JSON Schema Output (click to expand)</summary>

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
</details>

<details>
<summary>TypeScript Output</summary>

```typescript
export interface User {
  /** User's full name */
  name: string;
  /** Email address */
  email: string;
  /** Age in years */
  age?: number;
}
```
</details>

<details>
<summary>Pydantic Output</summary>

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class User(BaseModel):
    name: str = Field(..., min_length=2, max_length=128, description="User's full name")
    email: EmailStr = Field(..., description="Email address")
    age: Optional[int] = Field(None, ge=0, le=150, description="Age in years")
```
</details>

---

## Why ClearSchema?

| Feature | ClearSchema | JSON Schema | Zod |
|---------|-------------|-------------|-----|
| Human-readable | Yes | No (verbose JSON) | Code-based |
| Language-agnostic | Yes | Yes | No (JS/TS only) |
| Multiple exports | Yes | N/A | No |
| Zero dependencies | Yes | N/A | No |
| Schema reuse ($ref) | Yes | Yes | Partial |

**ClearSchema is best for:**
- Teams that need schemas in multiple languages
- API documentation that stays in sync with code
- Schemas that humans actually read and review

---

## Features

- **Primitive types:** `string`, `number`, `integer`, `boolean`, `null`
- **Complex types:** `object`, `array`, `array.tuple`
- **Union types:** `string|number` with type-specific modifiers
- **References:** `$defs` and `$ref` for schema reuse
- **Composition:** `allOf`, `anyOf`, `oneOf`
- **Imports:** Split schemas across files
- **Smart modifiers:** `range`, `format`, `pattern`, `enum`, and more

---

## Syntax Highlights

### Objects and Arrays

```yaml
user: object.required: User profile
  name: string.required: Full name
    ^ minLength: 2
  email: string.required: Email
    ^ format: email
  tags: array: User tags
    - string
    ^ maxItems: 10
```

### Schema References

```yaml
$defs:
  Address: object: Reusable address
    street: string.required: Street
    city: string.required: City

user: object: User
  home: $ref: #/$defs/Address
  work: $ref: #/$defs/Address
```

### Union Types

```yaml
id: string|number.required: Flexible ID
  ^ string.minLength: 3
  ^ string.pattern: ^[A-Z0-9]+$
  ^ number.min: 1000
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Roadmap](ROADMAP.md) | Phase overview and project status |
| [Architecture](docs/ARCHITECTURE.md) | Design decisions and type system |
| [Grammar](docs/GRAMMAR.md) | EBNF specification and syntax reference |
| [Testing](docs/TESTING.md) | TDD approach and test specifications |

### Phase Documentation

| Phase | Focus | Status |
|-------|-------|--------|
| [1. Core Parser](docs/phases/PHASE1_CORE_PARSER.md) | Lexer, parser, primitives | Not Started |
| [2. Complex Types](docs/phases/PHASE2_COMPLEX_TYPES.md) | Objects, arrays, nesting | Not Started |
| [3. References](docs/phases/PHASE3_REFERENCES.md) | $defs, $ref, imports, unions | Not Started |
| [4. JSON Schema](docs/phases/PHASE4_JSON_SCHEMA.md) | First working export | Not Started |
| [5. Exporters](docs/phases/PHASE5_EXPORTERS.md) | TypeScript, Pydantic, OpenAPI | Not Started |
| [6. CLI](docs/phases/PHASE6_CLI.md) | Command-line tooling | Not Started |
| [7. VS Code](docs/phases/PHASE7_VSCODE_LSP.md) | Editor integration | Not Started |
| [8. Adoption](docs/phases/PHASE8_ADOPTION.md) | Docs, playground, community | Not Started |

---

## Design Principles

1. **Human-readable first** - Schemas should read like documentation
2. **Universal export** - One source of truth, multiple outputs
3. **Target-agnostic core** - Parser produces universal AST; exporters handle mapping
4. **Zero dependencies** - Hand-written parser, no runtime deps
5. **Excellent errors** - Clear messages with line/column info

---

## License

MIT
