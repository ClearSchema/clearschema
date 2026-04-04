# Phase 3: References & Advanced Types

**Goal:** Schema references, external files, union types, and composition.

**Portfolio Value:** Shows symbol resolution

---

## Deliverables

- [ ] `$defs` section parsing
- [ ] `$ref` resolution (internal references)
- [ ] External file imports
- [ ] Union type parsing with type-prefixed modifiers
- [ ] Composition types (allOf, anyOf, oneOf)
- [ ] Circular reference detection
- [ ] Import resolution (async pass)

---

## Syntax Supported

### Schema Definitions ($defs)

```yaml
$defs:
  User: object: Reusable user schema
    name: string.required: Full name
    email: string.required: Email
      ^ format: email

  Address: object: Reusable address
    street: string.required: Street
    city: string.required: City
```

### Internal References ($ref)

```yaml
$defs:
  User: object: User schema
    name: string.required: Name

primaryUser: $ref: #/$defs/User

contacts: array: Contact list
  - $ref: #/$defs/User
```

### External Imports

```yaml
# Import specific definitions
import: ./common/types.clear
  - User
  - Address

# Import all definitions
import: ./common/types.clear
  - *

# Usage after import
primaryUser: $ref: User
address: $ref: Address
```

### Union Types

```yaml
id: string|number.required: Flexible ID
  ^ string.minLength: 3
  ^ string.pattern: ^[A-Z]+$
  ^ number.min: 1000
```

### Schema Composition

```yaml
adminUser: allOf: Admin user with extra permissions
  - $ref: #/$defs/User
  - object:
      permissions: array.required: Admin permissions
        - string
        ^ enum: [read, write, delete, admin]
```

---

## Implementation Guidance

### AST Updates

```typescript
export interface Schema extends ASTNode {
  namespace?: string;
  version?: string;
  targets?: string[];

  // Import declarations
  imports: ImportDeclaration[];

  definitions: SchemaDefinition[];
  fields: Field[];
  errors?: ParseError[];
}

export interface ImportDeclaration extends ASTNode {
  path: string;           // e.g., "./common/types.clear"
  definitions: string[];  // e.g., ["User", "Address"] or ["*"]
  resolved?: boolean;     // Set after resolution pass
}
```

### Import Resolution Architecture

Import resolution is a **separate async pass** after initial parsing. This keeps the core parser synchronous and testable.

```typescript
// Step 1: Sync parse of single file
const schema = parse(input);
// schema.imports contains unresolved ImportDeclaration nodes

// Step 2: Async resolution (involves file I/O)
const resolved = await resolveImports(schema, {
  fileLoader: async (path) => fs.readFile(path, 'utf-8'),
  basePath: './schemas/'
});
// resolved.definitions now includes imported definitions
```

### Resolution Rules

1. Imported files are parsed recursively
2. Circular imports are detected and reported as errors
3. Wildcard imports (`- *`) bring all definitions into scope
4. Name collisions between imports are errors
5. Local definitions take precedence over imports

### Union Type Parsing

```typescript
parseUnionType(typeString: string): UnionField {
  const types = typeString.split('|').map(t => t.trim());

  return {
    type: 'union',
    types,
    typeModifiers: {} // Populated by modifier parsing
  };
}
```

---

## Test Specifications

### Definition Tests (`tests/unit/parser/definitions.test.ts`)

```typescript
describe('Parser - $defs', () => {
  it('parses $defs section', () => {
    const input = `$defs:
  User: object: User schema
    name: string.required: Name`;

    const schema = parse(input);

    expect(schema.definitions).toHaveLength(1);
    expect(schema.definitions[0].name).toBe('User');
  });

  it('parses multiple definitions', () => {
    const input = `$defs:
  User: object: User
    name: string: Name
  Address: object: Address
    city: string: City`;

    const schema = parse(input);

    expect(schema.definitions).toHaveLength(2);
  });
});
```

### Reference Tests (`tests/unit/resolver/internal.test.ts`)

```typescript
describe('Reference Resolution', () => {
  it('resolves internal $ref', () => {
    const input = `$defs:
  User: object: User
    name: string: Name

user: $ref: #/$defs/User`;

    const schema = parse(input);
    const resolved = resolveReferences(schema);

    expect(resolved.fields[0].resolvedRef).toBeDefined();
  });

  it('errors on undefined reference', () => {
    const input = `user: $ref: #/$defs/Unknown`;

    expect(() => parse(input)).toThrow(/Unknown.*not defined/);
  });
});
```

### Import Tests (`tests/unit/resolver/external.test.ts`)

```typescript
describe('External Imports', () => {
  it('parses import declaration', () => {
    const input = `import: ./common/types.clear
  - User
  - Address`;

    const schema = parse(input);

    expect(schema.imports).toHaveLength(1);
    expect(schema.imports[0].path).toBe('./common/types.clear');
    expect(schema.imports[0].definitions).toEqual(['User', 'Address']);
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
```

### Union Tests (`tests/unit/parser/unions.test.ts`)

```typescript
describe('Parser - Union Types', () => {
  it('parses union type', () => {
    const input = `id: string|number: Flexible ID`;

    const field = parseField(input) as UnionField;

    expect(field.type).toBe('union');
    expect(field.types).toEqual(['string', 'number']);
  });

  it('parses prefixed modifiers on union', () => {
    const input = `id: string|number: ID
  ^ string.minLength: 3
  ^ number.min: 1000`;

    const field = parseField(input) as UnionField;

    expect(field.typeModifiers?.string?.minLength).toBe(3);
    expect(field.typeModifiers?.number?.min).toBe(1000);
  });
});
```

---

## Acceptance Criteria

- [ ] `$defs` section parses correctly
- [ ] Internal `$ref` references resolve
- [ ] External imports parse and resolve asynchronously
- [ ] Circular imports are detected with clear error messages
- [ ] Union types parse with type-prefixed modifiers
- [ ] Composition types (allOf, anyOf, oneOf) parse correctly
- [ ] All tests pass with 100% coverage
