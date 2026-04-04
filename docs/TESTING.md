# ClearSchema Testing Strategy

ClearSchema follows a strict TDD (Test-Driven Development) methodology: **write tests first, then implement**.

---

## TDD Workflow

For each feature:

1. **Red**: Write failing tests that specify the expected behavior
2. **Green**: Write minimal code to pass the tests
3. **Refactor**: Clean up while keeping tests green

---

## Test Categories

| Category | Purpose | Location |
|----------|---------|----------|
| **Lexer Tests** | Token generation, indentation handling | `tests/unit/lexer/` |
| **Parser Tests** | AST construction, syntax validation | `tests/unit/parser/` |
| **Validator Tests** | Semantic rules, modifier compatibility | `tests/unit/validator/` |
| **Exporter Tests** | Output correctness, snapshot testing | `tests/unit/exporters/` |
| **Integration Tests** | End-to-end parse → export flows | `tests/integration/` |
| **Error Tests** | Error messages, recovery behavior | `tests/unit/errors/` |

---

## Test Coverage Goals

- **Parser:** 100% branch coverage
- **Exporters:** 100% type coverage
- **Overall:** 90%+ line coverage

---

## Test Specification Format

Each phase includes test specifications BEFORE implementation code:

```typescript
// Test specification comes FIRST
describe('Feature: String field with range modifier', () => {
  it('should set minLength and maxLength from range', () => {
    const input = `name: string: Name
  ^ range: [2, 50]`;
    const field = parseField(input) as StringField;
    expect(field.minLength).toBe(2);
    expect(field.maxLength).toBe(50);
  });
});
// Implementation follows AFTER tests are written
```

---

## Phase Structure

Each development phase follows this structure:
1. **Goal** - What this phase accomplishes
2. **Test Specifications** - Complete test cases (the "contract")
3. **Implementation Guidance** - How to make tests pass
4. **Acceptance Criteria** - All tests passing + coverage requirements

---

## Comprehensive Test Specifications

### Lexer Tests (`tests/unit/lexer/tokenization.test.ts`)

```typescript
describe('Lexer: Tokenization', () => {
  describe('basic tokens', () => {
    it('tokenizes field line', () => {
      const tokens = tokenize('name: string: Description');
      expect(tokens[0]).toMatchObject({ type: 'FIELD_LINE', content: 'name: string: Description' });
    });

    it('tokenizes modifier line', () => {
      const tokens = tokenize('  ^ minLength: 2');
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'MODIFIER_LINE' }));
    });

    it('tokenizes array item', () => {
      const tokens = tokenize('  - string');
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'ARRAY_ITEM' }));
    });

    it('tokenizes metadata lines', () => {
      expect(tokenize('namespace: myapp')[0].type).toBe('NAMESPACE');
      expect(tokenize('version: 1.0')[0].type).toBe('VERSION');
      expect(tokenize('targets: [json-schema]')[0].type).toBe('TARGETS');
    });
  });

  describe('indentation handling', () => {
    it('emits INDENT token on increased indentation', () => {
      const input = `field: string: Desc
  ^ modifier: value`;
      const tokens = tokenize(input);
      const types = tokens.map(t => t.type);
      expect(types).toContain('INDENT');
    });

    it('emits DEDENT token on decreased indentation', () => {
      const input = `parent: object: Parent
  child: string: Child
sibling: string: Sibling`;
      const tokens = tokenize(input);
      const types = tokens.map(t => t.type);
      expect(types).toContain('DEDENT');
    });

    it('emits multiple DEDENT tokens for multi-level decrease', () => {
      const input = `a: object: A
  b: object: B
    c: string: C
d: string: D`;
      const tokens = tokenize(input);
      const dedents = tokens.filter(t => t.type === 'DEDENT');
      expect(dedents.length).toBe(2);
    });

    it('errors on inconsistent indentation', () => {
      const input = `field: string: Desc
  child1: string: Child1
   child2: string: Child2`;  // 3 spaces instead of 2
      expect(() => tokenize(input)).toThrow(/inconsistent indentation/i);
    });

    it('errors on mixed tabs and spaces', () => {
      const input = `field: string: Desc
  child1: string: C1
\tchild2: string: C2`;
      expect(() => tokenize(input)).toThrow(/mixed.*tabs.*spaces/i);
    });
  });

  describe('line tracking', () => {
    it('tracks line numbers correctly', () => {
      const input = `line1: string: L1

line3: string: L3`;  // Empty line 2
      const tokens = tokenize(input);
      expect(tokens[0].line).toBe(1);
      expect(tokens.find(t => t.content.includes('line3'))?.line).toBe(3);
    });

    it('tracks column correctly', () => {
      const input = `  field: string: Desc`;
      const tokens = tokenize(input);
      expect(tokens.find(t => t.type === 'FIELD_LINE')?.column).toBe(3);
    });
  });

  describe('EOF handling', () => {
    it('emits EOF token', () => {
      const tokens = tokenize('field: string: Desc');
      expect(tokens[tokens.length - 1].type).toBe('EOF');
    });
  });
});
```

### Modifier Validation Tests (`tests/unit/validator/modifiers.test.ts`)

```typescript
describe('Validator: Modifier Type Compatibility', () => {
  describe('string modifiers', () => {
    it('accepts minLength on string field', () => {
      const input = `name: string: Name\n  ^ minLength: 2`;
      expect(() => parse(input)).not.toThrow();
    });

    it('rejects minLength on number field', () => {
      const input = `age: number: Age\n  ^ minLength: 2`;
      expect(() => parse(input)).toThrow(ParseError);
      expect(() => parse(input)).toThrow(/minLength.*only valid for string/);
    });

    it('rejects minLength on boolean field', () => {
      const input = `active: boolean: Active\n  ^ minLength: 2`;
      expect(() => parse(input)).toThrow(/minLength.*only valid for string/);
    });
  });

  describe('number modifiers', () => {
    it('accepts min on number field', () => {
      const input = `age: number: Age\n  ^ min: 0`;
      expect(() => parse(input)).not.toThrow();
    });

    it('accepts min on integer field', () => {
      const input = `count: integer: Count\n  ^ min: 1`;
      expect(() => parse(input)).not.toThrow();
    });

    it('rejects min on string field', () => {
      const input = `name: string: Name\n  ^ min: 0`;
      expect(() => parse(input)).toThrow(/min.*only valid for number/);
    });
  });

  describe('array modifiers', () => {
    it('accepts minItems on array field', () => {
      const input = `tags: array: Tags\n  - string\n  ^ minItems: 1`;
      expect(() => parse(input)).not.toThrow();
    });

    it('rejects minItems on string field', () => {
      const input = `name: string: Name\n  ^ minItems: 1`;
      expect(() => parse(input)).toThrow(/minItems.*only valid for array/);
    });
  });

  describe('universal modifiers', () => {
    it.each(['string', 'number', 'integer', 'boolean', 'null'])(
      'accepts required on %s field',
      (type) => {
        const input = `field: ${type}.required: Description`;
        expect(() => parse(input)).not.toThrow();
      }
    );

    it.each(['string', 'number', 'integer', 'boolean'])(
      'accepts default on %s field',
      (type) => {
        const defaults = { string: '"test"', number: '42', integer: '1', boolean: 'true' };
        const input = `field: ${type}: Desc\n  ^ default: ${defaults[type]}`;
        expect(() => parse(input)).not.toThrow();
      }
    );
  });

  describe('union type modifiers', () => {
    it('accepts prefixed modifier for type in union', () => {
      const input = `id: string|number: ID\n  ^ string.minLength: 3`;
      expect(() => parse(input)).not.toThrow();
    });

    it('rejects prefixed modifier for type not in union', () => {
      const input = `id: string|number: ID\n  ^ boolean.default: true`;
      expect(() => parse(input)).toThrow(/boolean.*not in union/);
    });

    it('rejects unprefixed type-specific modifier on union', () => {
      const input = `id: string|number: ID\n  ^ minLength: 3`;
      expect(() => parse(input)).toThrow(/ambiguous.*specify type prefix/);
    });

    it('accepts universal modifier without prefix on union', () => {
      const input = `id: string|number: ID\n  ^ default: "unknown"`;
      expect(() => parse(input)).not.toThrow();
    });
  });
});
```

### Range Modifier Tests (`tests/unit/parser/range.test.ts`)

```typescript
describe('Modifier: range', () => {
  describe('on string fields', () => {
    it('sets minLength and maxLength', () => {
      const input = `name: string: Name\n  ^ range: [2, 50]`;
      const field = parseField(input) as StringField;
      expect(field.minLength).toBe(2);
      expect(field.maxLength).toBe(50);
    });

    it('works with single value for exact length', () => {
      const input = `code: string: Code\n  ^ range: [5, 5]`;
      const field = parseField(input) as StringField;
      expect(field.minLength).toBe(5);
      expect(field.maxLength).toBe(5);
    });
  });

  describe('on number fields', () => {
    it('sets min and max', () => {
      const input = `temp: number: Temperature\n  ^ range: [-40, 60]`;
      const field = parseField(input) as NumberField;
      expect(field.min).toBe(-40);
      expect(field.max).toBe(60);
    });

    it('handles decimal bounds', () => {
      const input = `rate: number: Rate\n  ^ range: [0.0, 1.0]`;
      const field = parseField(input) as NumberField;
      expect(field.min).toBe(0.0);
      expect(field.max).toBe(1.0);
    });
  });

  describe('on integer fields', () => {
    it('sets min and max', () => {
      const input = `age: integer: Age\n  ^ range: [0, 150]`;
      const field = parseField(input) as NumberField;
      expect(field.type).toBe('integer');
      expect(field.min).toBe(0);
      expect(field.max).toBe(150);
    });
  });

  describe('exclusiveRange', () => {
    it('sets exclusiveMin and exclusiveMax on numbers', () => {
      const input = `prob: number: Probability\n  ^ exclusiveRange: [0, 1]`;
      const field = parseField(input) as NumberField;
      expect(field.exclusiveMin).toBe(0);
      expect(field.exclusiveMax).toBe(1);
    });

    it('rejects exclusiveRange on strings', () => {
      const input = `name: string: Name\n  ^ exclusiveRange: [1, 10]`;
      expect(() => parseField(input)).toThrow(/exclusiveRange.*not valid for string/);
    });
  });

  describe('validation', () => {
    it('rejects range on boolean', () => {
      const input = `active: boolean: Active\n  ^ range: [0, 1]`;
      expect(() => parseField(input)).toThrow(/range.*not valid for boolean/);
    });

    it('rejects range on object', () => {
      const input = `user: object: User\n  ^ range: [0, 10]`;
      expect(() => parseField(input)).toThrow(/range.*not valid for object/);
    });

    it('rejects range where min > max', () => {
      const input = `age: number: Age\n  ^ range: [100, 0]`;
      expect(() => parseField(input)).toThrow(/range.*min.*greater.*max/);
    });
  });

  describe('union types', () => {
    it('applies prefixed range to correct type', () => {
      const input = `id: string|number: ID
  ^ string.range: [3, 20]
  ^ number.range: [1000, 9999]`;
      const field = parseField(input) as UnionField;
      expect(field.typeModifiers?.string?.minLength).toBe(3);
      expect(field.typeModifiers?.string?.maxLength).toBe(20);
      expect(field.typeModifiers?.number?.min).toBe(1000);
      expect(field.typeModifiers?.number?.max).toBe(9999);
    });
  });
});
```

### Union Field Tests (`tests/unit/parser/unions.test.ts`)

```typescript
describe('Union Field: Type-Specific Modifiers', () => {
  it('stores prefixed modifiers in typeModifiers', () => {
    const input = `id: string|number: ID
  ^ string.minLength: 3
  ^ string.pattern: ^[A-Z]+$
  ^ number.min: 1000`;

    const field = parseField(input) as UnionField;

    expect(field.typeModifiers).toBeDefined();
    expect(field.typeModifiers?.string).toEqual({
      minLength: 3,
      pattern: '^[A-Z]+$'
    });
    expect(field.typeModifiers?.number).toEqual({
      min: 1000
    });
  });

  it('stores universal modifiers on base field, not typeModifiers', () => {
    const input = `id: string|number: ID
  ^ default: "unknown"
  ^ string.minLength: 3`;

    const field = parseField(input) as UnionField;

    expect(field.default).toBe('unknown');
    expect(field.typeModifiers?.string?.minLength).toBe(3);
  });

  it('validates prefix type exists in union', () => {
    const input = `id: string|number: ID
  ^ boolean.default: true`;

    expect(() => parseField(input)).toThrow(/boolean.*not a member of union/);
  });
});
```

### External File Reference Tests (`tests/unit/resolver/external.test.ts`)

```typescript
describe('External File References', () => {
  describe('import syntax parsing', () => {
    it('parses import with specific definitions', () => {
      const input = `import: ./common/types.clear
  - User
  - Address

user: $ref: User`;

      const schema = parse(input);
      expect(schema.imports).toHaveLength(1);
      expect(schema.imports[0].path).toBe('./common/types.clear');
      expect(schema.imports[0].definitions).toEqual(['User', 'Address']);
    });

    it('parses wildcard import', () => {
      const input = `import: ./common/types.clear
  - *`;

      const schema = parse(input);
      expect(schema.imports[0].definitions).toEqual(['*']);
    });

    it('parses multiple imports', () => {
      const input = `import: ./common/user.clear
  - User
import: ./common/address.clear
  - Address`;

      const schema = parse(input);
      expect(schema.imports).toHaveLength(2);
    });
  });

  describe('reference resolution', () => {
    it('resolves reference to imported definition', async () => {
      const schema = await parseWithImports('schema.clear', {
        fileLoader: mockFileLoader({
          './common/types.clear': `User: object:
  name: string.required: Name`
        })
      });

      expect(schema.resolvedDefinitions.User).toBeDefined();
    });

    it('errors on reference to non-imported definition', () => {
      const input = `import: ./common/types.clear
  - User

address: $ref: Address`;

      expect(() => parse(input)).toThrow(/Address.*not imported/);
    });

    it('detects circular imports', async () => {
      const loader = mockFileLoader({
        'a.clear': `import: ./b.clear\n  - *`,
        'b.clear': `import: ./a.clear\n  - *`
      });

      await expect(parseWithImports('a.clear', { fileLoader: loader }))
        .rejects.toThrow(/circular import/i);
    });
  });
});
```

### Error Formatting Tests (`tests/unit/errors/formatting.test.ts`)

```typescript
describe('Error Formatting', () => {
  it('includes line and column in message', () => {
    try {
      parse('bad syntax here');
    } catch (e) {
      const formatted = (e as ParseError).format();
      expect(formatted).toMatch(/line \d+:\d+/);
    }
  });

  it('shows source line with pointer', () => {
    try {
      parseField('name string: Missing colon after name');
    } catch (e) {
      const formatted = (e as ParseError).format();
      expect(formatted).toContain('name string');
      expect(formatted).toMatch(/[~^]+/);  // Pointer characters
    }
  });

  it('includes hint when available', () => {
    try {
      parseField('age: number: Age\n  ^ minLength: 5');
    } catch (e) {
      const formatted = (e as ParseError).format();
      expect(formatted).toContain('help:');
      expect(formatted).toMatch(/did you mean.*min/i);
    }
  });
});
```

---

## Test File Organization

```
tests/
├── unit/
│   ├── lexer/
│   │   └── tokenization.test.ts
│   ├── parser/
│   │   ├── primitives.test.ts
│   │   ├── modifiers.test.ts
│   │   ├── objects.test.ts
│   │   ├── arrays.test.ts
│   │   ├── unions.test.ts
│   │   └── range.test.ts
│   ├── validator/
│   │   ├── modifiers.test.ts
│   │   └── references.test.ts
│   ├── resolver/
│   │   ├── internal.test.ts
│   │   └── external.test.ts
│   ├── exporters/
│   │   ├── json-schema.test.ts
│   │   └── typescript.test.ts
│   └── errors/
│       └── formatting.test.ts
├── integration/
│   ├── parse-export.test.ts
│   └── real-schemas.test.ts
├── snapshots/
│   └── exports/
└── fixtures/
    ├── valid/
    └── invalid/
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/parser/primitives.test.ts
```
