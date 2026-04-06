# ClearSchema Architecture

This document covers the key architectural decisions and the core type system for ClearSchema.

---

## Vision & Goals

### What is ClearSchema?

ClearSchema is a **human-readable schema definition language** that serves as a single source of truth for data contracts. Define your schema once, export everywhere.

**The pitch:** "Your schema is a contract. Write it once in a format humans can read and review. Generate the boring, repetitive code."

### Primary Goals

1. **Human-readable syntax** - Schemas that read like documentation
2. **Universal export** - JSON Schema, TypeScript types, Python/Pydantic, OpenAPI from one source
3. **Target-agnostic core** - The parser produces a universal AST; exporters handle target-specific mapping
4. **Zero dependencies** - Hand-written parser with no external runtime dependencies
5. **Excellent error messages** - Clear, actionable errors with line/column information

### Non-Goals (for initial release)

- IDE/LSP integration (Phase 7)
- Multi-language parser implementations (future consideration)
- Conditional schemas (if/then/else)

---

## Architecture Decisions

### Decision 1: Hand-Written Recursive Descent Parser

**Rationale:**
- ClearSchema's grammar is line-oriented and indentation-based - well-suited for hand-written parsing
- Zero external dependencies (no ANTLR, no tree-sitter)
- Full control over error messages with exact line/column positions
- Easy to debug (step through with breakpoints)
- Estimated ~500-800 lines of TypeScript

**Trade-off acknowledged:** Porting to other languages requires rewriting the parser. However:
- The grammar is simple enough that ports would be ~500 lines
- A well-documented EBNF spec serves as the canonical reference
- Getting TypeScript right first is more important than multi-language day one

### Decision 2: TypeScript as Implementation Language

**Rationale:**
- Target users are primarily JavaScript/TypeScript developers
- npm is where schema tools live
- Native JSON handling
- Excellent tooling and IDE support
- Fast iteration during development

### Decision 3: Universal Core Types with Smart Exporters

**Rationale:**
- ClearSchema defines ONE canonical type system
- Each exporter maps intelligently to target format
- Schemas stay portable across all targets
- No cognitive overhead while authoring

**Example flow:**
```
ClearSchema: email: string.required ^ format: email
     ↓
JSON Schema: { "type": "string", "format": "email" }
Pydantic:    email: EmailStr
TypeScript:  email: string;
```

### Decision 4: Optional Target Hints for Linting

**Rationale:**
- Authors can declare intended targets
- Linter warns about incompatibilities
- Core parsing remains target-agnostic

```yaml
targets: [json-schema-2020-12, pydantic-v2]  # Optional declaration

user: object: User profile
  # ... fields
```

### Decision 5: Indentation State Machine Lexer

**Rationale:**
- Raw string splitting is too fragile for nested structures
- Need explicit `INDENT` and `DEDENT` tokens to handle structure reliably
- Consistency with Python/YAML parsing logic
- Enables robust error reporting for mixed tabs/spaces

---

## Core Type System

### Primitive Types

| ClearSchema Type | Description |
|------------------|-------------|
| `string` | Text values |
| `number` | Numeric values (integer or float) |
| `integer` | Whole numbers only |
| `boolean` | True/false values |
| `null` | Explicit null value |

### Complex Types

| ClearSchema Type | Description |
|------------------|-------------|
| `object` | Nested structure with named fields |
| `array` | Collection of items |
| `array.tuple` | Fixed-length array with positional types |

### Special Types

| ClearSchema Type | Description |
|------------------|-------------|
| `union` | Multiple allowed types (`string\|number`) |
| `$ref` | Reference to a defined schema |
| `allOf` | Must match ALL schemas |
| `anyOf` | Must match AT LEAST ONE schema |
| `oneOf` | Must match EXACTLY ONE schema |

---

## Modifier System

### Universal Modifiers

Available for all field types:

| Modifier | Description | Example |
|----------|-------------|---------|
| `required` | Field is mandatory | `.required` or `^ required: true` |
| `default` | Default value | `^ default: "pending"` |
| `enum` | Allowed values | `^ enum: [a, b, c]` |
| `const` | Exact constant value | `^ const: "v1"` |
| `nullable` | Allow null in addition to type | `.nullable` |

### String Modifiers

| Modifier | JSON Schema Mapping |
|----------|---------------------|
| `min` | `minLength` |
| `max` | `maxLength` |
| `pattern` | `pattern` |
| `format` | `format` |

**Supported formats:** `email`, `uri`, `url`, `uuid`, `date-time`, `date`, `time`, `ipv4`, `ipv6`, `hostname`

#### Pattern Escaping

Pattern values are passed directly to the target format's regex engine. ClearSchema does not interpret escape sequences—they pass through as-is.

```yaml
# Backslashes work naturally (no double-escaping needed)
productCode: string: Product code
  ^ pattern: ^[A-Z]{3}\d{4}$

# Complex patterns are readable
email: string: Email with specific domain
  ^ pattern: ^[\w.+-]+@example\.com$
```

### Number Modifiers

| Modifier | JSON Schema Mapping |
|----------|---------------------|
| `min` | `minimum` |
| `max` | `maximum` |
| `gt` | `exclusiveMinimum` |
| `lt` | `exclusiveMaximum` |
| `multipleOf` | `multipleOf` |

### Array Modifiers

| Modifier | JSON Schema Mapping |
|----------|---------------------|
| `min` | `minItems` |
| `max` | `maxItems` |
| `uniqueItems` | `uniqueItems` |

### Type-Specific Modifiers (for unions — not yet implemented)

Prefix modifier with type name:
```yaml
id: string|number: Flexible ID
  ^ string.min: 3       # Valid: applies to string variant
  ^ number.min: 1000    # Valid: applies to number variant
```

> **Note:** Type-prefixed modifiers are not yet implemented. Bare `min`/`max`/`gt`/`lt` on union fields is currently a parse error.

---

## Modifier Validation

### Type Compatibility Rules

Modifiers are type-specific. Applying an incompatible modifier is a **parse error**.

| Modifier | Valid Types | Error if applied to |
|----------|-------------|---------------------|
| `min`, `max` | `string`, `number`, `integer`, `array` | boolean, null, object, map, union |
| `gt`, `lt` | `number`, `integer` | string, boolean, null, object, array, map, union |
| `range` | `string`, `number`, `integer`, `array` | boolean, null, object, map, union |
| `exclusiveRange` | `number`, `integer` | string, boolean, null, object, array, map, union |
| `pattern`, `format` | `string` | number, integer, boolean, null, object, array |
| `multipleOf` | `number`, `integer` | string, boolean, null, object, array |
| `uniqueItems` | `array`, `array.tuple` | string, number, boolean, null, object |
| `required`, `nullable`, `default`, `const`, `enum` | ALL types | (universal - always valid) |

### Validation Error Format

```
ParseError: "minLength" is not a valid modifier
  --> schema.clear:3:5
   |
 3 |   ^ minLength: 10
   |     ^^^^^^^^^^
   |
  help: Use "min" instead
```

### Deprecated Modifier Names

The following modifier names are no longer accepted and produce migration hints:

| Old Name | New Name | Context |
|----------|----------|---------|
| `minLength` | `min` | string fields |
| `maxLength` | `max` | string fields |
| `minItems` | `min` | array fields |
| `maxItems` | `max` | array fields |
| `exclusiveMin` | `gt` | number/integer fields |
| `exclusiveMax` | `lt` | number/integer fields |

### Union Type Modifiers

For union types, modifiers must be prefixed with the target type (not yet implemented):

```yaml
id: string|number: Flexible ID
  ^ string.min: 3      # Valid: applies to string variant (future)
  ^ number.min: 1000   # Valid: applies to number variant (future)
  ^ min: 3             # ERROR: ambiguous on union types
```

> **Note:** Type-prefixed modifiers are deferred to a future release. Currently, bare constraint modifiers on union fields produce a parse error with a forward-looking hint.

### Modifier Conflict Validation

ClearSchema validates that modifier values are logically consistent. Conflicts are **parse errors**, not warnings.

| Conflict | Error Message |
|----------|---------------|
| `min > max` (on any type) | "min ({n}) cannot exceed max ({m})" (not yet implemented) |
| `gt >= lt` | "gt ({n}) must be less than lt ({m})" (not yet implemented) |
| `range: [a, b]` where `a > b` | "range minimum ({a}) cannot exceed maximum ({b})" |
| `exclusiveRange: [a, b]` where `a > b` | "exclusiveRange minimum ({a}) cannot exceed maximum ({b})" |
| `range` + `min` or `max` | "Cannot use both 'range' and 'min' on the same field" |
| `exclusiveRange` + `gt` or `lt` | "Cannot use both 'exclusiveRange' and 'gt' on the same field" |

> **Note:** Value-level conflict validation (e.g., `min > max`) is documented but not yet implemented. Range/explicit modifier conflicts ARE implemented.

---

## The `range` Modifier

The `range` modifier provides a shorthand for setting min/max constraints. Its meaning is **context-sensitive** based on field type:

| Field Type | `range: [a, b]` Equivalent |
|------------|---------------------------|
| `string` | `min: a`, `max: b` (resolves to AST `minLength`/`maxLength`) |
| `number` | `min: a`, `max: b` |
| `integer` | `min: a`, `max: b` |
| `array` | `min: a`, `max: b` (resolves to AST `minItems`/`maxItems`) |

### Syntax

```yaml
# String: sets minLength and maxLength
username: string.required: Username
  ^ range: [3, 20]

# Number: sets min and max
temperature: number: Temperature in Celsius
  ^ range: [-40, 60]

# Integer: sets min and max
age: integer: Age in years
  ^ range: [0, 150]
```

### Exclusive Range

Use `exclusiveRange` for exclusive bounds (numbers only):

```yaml
probability: number: Probability value
  ^ exclusiveRange: [0, 1]    # 0 < value < 1
```

### Range on Union Types (not yet implemented)

```yaml
value: string|number: Flexible value
  ^ string.range: [1, 100]    # string length 1-100 (future)
  ^ number.range: [0, 1000]   # number value 0-1000 (future)
```

> **Note:** Bare `range`/`exclusiveRange` on union fields is currently a parse error. Type-prefixed range modifiers are deferred to a future release.

### Range Expansion

The `range` modifier is syntactic sugar. During parsing, it expands to concrete AST properties:

```typescript
// Input
name: string: Name
  ^ range: [2, 50]

// AST (range is expanded, not stored)
{
  type: 'string',
  name: 'name',
  minLength: 2,    // Expanded from range
  maxLength: 50,   // Expanded from range
  // No 'range' property in AST
}
```

This ensures exporters don't need special range handling.

---

## Directory Structure

```
clearschema/
├── src/
│   ├── index.ts              # Public API exports
│   ├── lexer/
│   │   ├── lexer.ts          # Tokenization with INDENT/DEDENT
│   │   ├── tokens.ts         # Token type definitions
│   │   └── indentation.ts    # Indentation state machine
│   ├── parser/
│   │   ├── parser.ts         # Recursive descent parser
│   │   ├── errors.ts         # ParseError class
│   │   └── recovery.ts       # Error recovery/synchronization
│   ├── validator/
│   │   ├── validator.ts      # Semantic validation
│   │   ├── modifiers.ts      # Modifier compatibility rules
│   │   └── references.ts     # Reference validation
│   ├── ast/
│   │   ├── types.ts          # AST node type definitions
│   │   ├── builders.ts       # AST node factory functions
│   │   └── visitors.ts       # AST visitor base classes
│   ├── resolver/
│   │   ├── resolver.ts       # Reference resolution
│   │   ├── imports.ts        # External file loading
│   │   └── circular.ts       # Circular reference detection
│   ├── exporters/
│   │   ├── json-schema.ts    # JSON Schema exporter
│   │   ├── typescript.ts     # TypeScript type exporter
│   │   ├── pydantic.ts       # Pydantic model exporter
│   │   └── types.ts          # Exporter types and options
│   └── utils/
│       └── strings.ts        # String manipulation helpers
├── tests/
│   ├── unit/
│   │   ├── lexer/
│   │   ├── parser/
│   │   ├── validator/
│   │   ├── resolver/
│   │   ├── exporters/
│   │   └── errors/
│   ├── integration/
│   ├── snapshots/
│   └── fixtures/
├── docs/
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## Export Architecture

### Exporter Interface

```typescript
interface Exporter<T> {
  export(schema: Schema, options?: ExportOptions): T;
}

interface ExportOptions {
  includeDescriptions?: boolean;
  includeDefaults?: boolean;
  // Target-specific options in subinterfaces
}
```

### Type Mapping Strategy

Each exporter maintains a mapping table:

| ClearSchema | JSON Schema | TypeScript | Pydantic |
|-------------|-------------|------------|----------|
| `string` | `string` | `string` | `str` |
| `string` + `format: email` | `string` + `format: email` | `string` | `EmailStr` |
| `string` + `format: uri` | `string` + `format: uri` | `string` | `HttpUrl` |
| `string` + `format: date-time` | `string` + `format: date-time` | `string` | `datetime` |
| `number` | `number` | `number` | `float` |
| `integer` | `integer` | `number` | `int` |
| `integer` + `min: 1` | `integer` + `minimum: 1` | `number` | `PositiveInt` |
| `boolean` | `boolean` | `boolean` | `bool` |
| `null` | `null` | `null` | `None` |
| `array` | `array` | `T[]` | `list[T]` |
| `object` | `object` | `interface` | `BaseModel` |
| `string\|number` | `anyOf` | `string \| number` | `str \| int` |

### Modifier Mapping Strategy

| ClearSchema Modifier | Applies to | JSON Schema | Pydantic Field |
|---------------------|------------|-------------|----------------|
| `min: N` | string | `minLength: N` | `min_length=N` |
| `max: N` | string | `maxLength: N` | `max_length=N` |
| `min: N` | number/integer | `minimum: N` | `ge=N` |
| `max: N` | number/integer | `maximum: N` | `le=N` |
| `min: N` | array | `minItems: N` | (list length) |
| `max: N` | array | `maxItems: N` | (list length) |
| `gt: N` | number/integer | `exclusiveMinimum: N` | `gt=N` |
| `lt: N` | number/integer | `exclusiveMaximum: N` | `lt=N` |
| `pattern: X` | string | `pattern: X` | `pattern=X` |
| `default: X` | all | `default: X` | `default=X` |
| `enum: [...]` | all | `enum: [...]` | `Literal[...]` |

---

## References

- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
