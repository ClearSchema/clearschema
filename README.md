# ClearSchema

**A human-readable schema definition language. Write once, export everywhere.**

Your schema is a contract. Write it in a format humans can read and review. Generate the boring, repetitive code.

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/clearschema/clearschema)
[![Tests](https://img.shields.io/badge/tests-232%20passing-brightgreen.svg)](https://github.com/clearschema/clearschema)
[![Coverage](https://img.shields.io/badge/coverage-93%2B%25-brightgreen.svg)](https://github.com/clearschema/clearschema)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Quick Example

**ClearSchema (9 lines):**
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

**Exports to JSON Schema, TypeScript, and more.**

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
export interface Schema {
  /** User's full name */
  name: string;
  /** Email address */
  email: string;
  /** Age in years */
  age?: number;
}
```
</details>

---

## Installation

```bash
npm install clearschema
```

### CLI Usage

```bash
# Export to JSON Schema
clearschema schema.cs -f json-schema -o schema.json

# Export to TypeScript
clearschema schema.cs -f typescript -o types.ts

# Export to Pydantic (Python)
clearschema schema.cs -f pydantic -o models.py

# Export to OpenAPI 3.1
clearschema schema.cs -f openapi -o openapi.json

# Use different JSON Schema version
clearschema schema.cs --schema-version draft-07 -o schema.json
```

### API Usage

```typescript
import {
  parse,
  exportJsonSchema,
  exportTypeScript,
  exportPydantic,
  exportOpenAPI,
  resolveReferences,
  resolveImports
} from 'clearschema';

const schema = parse(`
  name: string.required: Full name
  age: integer: Age
`);

// Export to different formats
const jsonSchema = exportJsonSchema(schema);
const typescript = exportTypeScript(schema);
const pydantic = exportPydantic(schema);
const openapi = exportOpenAPI(schema, { title: 'My API', version: '1.0.0' });

// Resolve references
const resolved = resolveReferences(schema);

// Resolve imports (async)
const withImports = await resolveImports(schema, {
  basePath: './schemas'
});
```

---

## Why ClearSchema?

| Feature | ClearSchema | JSON Schema | Zod |
|---------|-------------|-------------|-----|
| Human-readable | ✅ Yes | ❌ No (verbose JSON) | ⚠️ Code-based |
| Language-agnostic | ✅ Yes | ✅ Yes | ❌ No (JS/TS only) |
| Multiple exports | ✅ Yes | ❌ N/A | ❌ No |
| Zero dependencies | ✅ Yes | ❌ N/A | ❌ No |
| Schema reuse ($ref) | ✅ Yes | ✅ Yes | ⚠️ Partial |
| VS Code support | ✅ Yes | ⚠️ Via extensions | ✅ Via TypeScript |

**ClearSchema is best for:**
- Teams that need schemas in multiple languages
- API documentation that stays in sync with code
- Schemas that humans actually read and review
- Projects requiring JSON Schema, TypeScript, and Python

---

## Features

### Type System
- **Primitives:** `string`, `number`, `integer`, `boolean`, `null`
- **Complex:** `object`, `array`, `array.tuple`
- **Union:** `string|number` with type-specific modifiers
- **References:** `$defs` and `$ref` for schema reuse
- **Composition:** `allOf`, `anyOf`, `oneOf`

### Modifiers
- **String:** `minLength`, `maxLength`, `pattern`, `format`
- **Number:** `min`, `max`, `exclusiveMin`, `exclusiveMax`, `multipleOf`
- **Array:** `minItems`, `maxItems`, `uniqueItems`
- **Universal:** `required`, `nullable`, `default`, `const`, `enum`

### Advanced Features
- **Imports:** Split schemas across files with `import:`
- **Inline modifiers:** `string.required.nullable`
- **Block modifiers:** `^ modifierName: value`
- **Type-prefixed modifiers:** `^ string.minLength: 3` for unions

---

## Syntax Examples

### Objects and Arrays

```clearschema
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

```clearschema
$defs:
  Address: object: Reusable address
    street: string.required: Street
    city: string.required: City
    zipCode: string: Postal code
      ^ pattern: ^\d{5}$

user: object: User
  home: $ref: #/$defs/Address
  work: $ref: #/$defs/Address
```

### Union Types

```clearschema
id: string|number.required: Flexible ID
  ^ string.minLength: 3
  ^ string.pattern: ^[A-Z0-9]+$
  ^ number.min: 1000
```

### Tuple Arrays

```clearschema
coordinates: array.tuple.required: GPS coordinates
  - number: Latitude
  - number: Longitude
```

### Composition Types

```clearschema
$defs:
  User: object: Base user
    name: string: Name

  Admin: allOf: Admin user
    - $ref: #/$defs/User
    - object:
        role: string.required: Role
          ^ const: admin
```

---

## Project Status

| Phase | Status | Version |
|-------|--------|---------|
| 1. Core Parser | ✅ Complete | v0.1.0 |
| 2. Complex Types | ✅ Complete | v0.2.0 |
| 3. References & Advanced Types | ✅ Complete | v0.2.0 |
| 4. JSON Schema Export | ✅ Complete | v0.2.0 |
| 5. All Exporters (TS, Pydantic, OpenAPI) | ✅ Complete | v0.2.0 |
| 6. CLI & Tooling | ✅ Complete | v0.2.0 |
| 7. VS Code Extension | ✅ Complete | v0.2.0 |
| 8. Documentation | 🚧 In Progress | - |

**Current Version:** 0.2.0
**Test Coverage:** 93%+ (232 tests passing)
**License:** MIT

---

## Documentation

### Getting Started
- [Examples](examples/) - Sample schemas demonstrating features
- [ROADMAP](ROADMAP.md) - Project phases and milestones
- [CHANGELOG](CHANGELOG.md) - Version history

### Technical Documentation
- [Architecture](docs/ARCHITECTURE.md) - Design decisions and type system
- [Grammar](docs/GRAMMAR.md) - EBNF specification and syntax reference
- [Testing](docs/TESTING.md) - TDD approach and test specifications

### Phase Documentation
1. [Core Parser](docs/phases/PHASE1_CORE_PARSER.md) - Lexer, parser, primitives, modifiers
2. [Complex Types](docs/phases/PHASE2_COMPLEX_TYPES.md) - Objects, arrays, nesting
3. [References](docs/phases/PHASE3_REFERENCES.md) - $defs, $ref, imports, unions
4. [JSON Schema](docs/phases/PHASE4_JSON_SCHEMA.md) - JSON Schema Draft 2020-12 export
5. [Exporters](docs/phases/PHASE5_EXPORTERS.md) - TypeScript, Pydantic, OpenAPI
6. [CLI](docs/phases/PHASE6_CLI.md) - Command-line tooling
7. [VS Code](docs/phases/PHASE7_VSCODE_LSP.md) - Editor integration
8. [Adoption](docs/phases/PHASE8_ADOPTION.md) - Documentation and community

---

## Design Principles

1. **Human-readable first** - Schemas should read like documentation
2. **Universal export** - One source of truth, multiple outputs
3. **Target-agnostic core** - Parser produces universal AST; exporters handle mapping
4. **Zero dependencies** - Hand-written parser, no runtime deps
5. **Excellent errors** - Clear messages with line/column info
6. **TDD approach** - 205 tests with 93.3% coverage

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/clearschema/clearschema.git
cd clearschema/clearschema

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run CLI locally
node dist/cli/index.js ../examples/user.cs
```

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with TypeScript, Jest, and no runtime dependencies.

Inspired by JSON Schema, Protocol Buffers, and the need for human-readable schemas.
