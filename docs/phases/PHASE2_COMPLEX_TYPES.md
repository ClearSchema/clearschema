# Phase 2: Complex Types

**Goal:** Support objects, arrays, and nesting.

**Portfolio Value:** Shows recursion handling

---

## Deliverables

- [ ] Object field parsing with nested fields
- [ ] Basic array parsing with item types
- [ ] Tuple array support (`array.tuple`)
- [ ] Object array support (inline objects)
- [ ] Deep nesting support
- [ ] Indentation handling for complex structures
- [ ] Integration tests for nested structures

---

## Syntax Supported

### Object with Nested Fields

```yaml
user: object.required: User profile
  name: string.required: Name
  addresses: array: Address list
    - object:
        street: string.required: Street
        city: string.required: City
```

### Array with Item Type

```yaml
tags: array: List of tags
  - string
  ^ minItems: 1
  ^ maxItems: 10
```

### Tuple Array

```yaml
coordinates: array.tuple: GPS coordinates
  - number: latitude
  - number: longitude
  - number: altitude
```

### Deeply Nested Structures

```yaml
company: object: Company info
  name: string.required: Company name
  headquarters: object.required: Main office
    address: object.required: Address
      street: string.required: Street
      city: string.required: City
      country: string.required: Country
    contact: object: Contact info
      phone: string: Phone number
      email: string: Email
        ^ format: email
```

---

## Implementation Guidance

### Object Field Parsing

Extend the parser to recursively parse child fields:

```typescript
parseObjectField(token: Token, base: any): ObjectField {
  const children: Field[] = [];

  if (this.stream.match('INDENT')) {
    while (!this.stream.match('DEDENT') && !this.stream.isAtEnd()) {
      const current = this.stream.current();

      if (current.type === 'MODIFIER_LINE') {
        this.parseModifierLine(current, base);
        this.stream.advance();
      } else if (current.type === 'FIELD_LINE') {
        children.push(this.parseField()); // Recursive call
      } else {
        this.stream.advance();
      }
    }
  }

  return { ...base, type: 'object', fields: children };
}
```

### Array Field Parsing

Handle the `- itemType` syntax:

```typescript
parseArrayField(token: Token, base: any): ArrayField {
  let itemType: Field | FieldTypeName = 'string'; // Default

  if (this.stream.match('INDENT')) {
    while (!this.stream.match('DEDENT') && !this.stream.isAtEnd()) {
      const current = this.stream.current();

      if (current.type === 'ARRAY_ITEM') {
        itemType = this.parseArrayItem(current);
        this.stream.advance();
      } else if (current.type === 'MODIFIER_LINE') {
        this.parseModifierLine(current, base);
        this.stream.advance();
      } else {
        this.stream.advance();
      }
    }
  }

  return { ...base, type: 'array', itemType };
}
```

### Tuple Array Parsing

Handle multiple `- type: description` items:

```typescript
parseTupleArrayField(token: Token, base: any): TupleArrayField {
  const items: Field[] = [];

  if (this.stream.match('INDENT')) {
    while (!this.stream.match('DEDENT') && !this.stream.isAtEnd()) {
      const current = this.stream.current();

      if (current.type === 'ARRAY_ITEM') {
        items.push(this.parseTupleItem(current));
        this.stream.advance();
      } else {
        this.stream.advance();
      }
    }
  }

  return { ...base, type: 'array.tuple', items };
}
```

---

## Test Specifications

### Object Tests (`tests/unit/parser/objects.test.ts`)

```typescript
describe('Parser - Object Fields', () => {
  it('parses object with child fields', () => {
    const input = `user: object: User
  name: string: Name
  age: number: Age`;

    const field = parseField(input) as ObjectField;

    expect(field.type).toBe('object');
    expect(field.fields).toHaveLength(2);
    expect(field.fields[0].name).toBe('name');
    expect(field.fields[1].name).toBe('age');
  });

  it('parses deeply nested objects', () => {
    const input = `outer: object: Outer
  inner: object: Inner
    deep: string: Deep field`;

    const field = parseField(input) as ObjectField;
    const inner = field.fields[0] as ObjectField;
    const deep = inner.fields[0];

    expect(deep.name).toBe('deep');
    expect(deep.type).toBe('string');
  });

  it('parses object with modifiers on children', () => {
    const input = `user: object: User
  name: string.required: Name
    ^ minLength: 2`;

    const field = parseField(input) as ObjectField;
    const nameField = field.fields[0] as StringField;

    expect(nameField.required).toBe(true);
    expect(nameField.minLength).toBe(2);
  });
});
```

### Array Tests (`tests/unit/parser/arrays.test.ts`)

```typescript
describe('Parser - Array Fields', () => {
  it('parses array with string items', () => {
    const input = `tags: array: Tags
  - string`;

    const field = parseField(input) as ArrayField;

    expect(field.type).toBe('array');
    expect(field.itemType).toBe('string');
  });

  it('parses array with modifiers', () => {
    const input = `tags: array: Tags
  - string
  ^ minItems: 1
  ^ maxItems: 10`;

    const field = parseField(input) as ArrayField;

    expect(field.minItems).toBe(1);
    expect(field.maxItems).toBe(10);
  });

  it('parses array with inline object', () => {
    const input = `users: array: Users
  - object:
      name: string.required: Name
      email: string: Email`;

    const field = parseField(input) as ArrayField;
    const itemType = field.itemType as ObjectField;

    expect(itemType.type).toBe('object');
    expect(itemType.fields).toHaveLength(2);
  });

  it('parses tuple array', () => {
    const input = `point: array.tuple: Point
  - number: x
  - number: y`;

    const field = parseField(input) as TupleArrayField;

    expect(field.type).toBe('array.tuple');
    expect(field.items).toHaveLength(2);
  });
});
```

---

## Acceptance Criteria

- [ ] Object fields parse with arbitrary nesting depth
- [ ] Array fields parse with item types
- [ ] Tuple arrays parse with positional types
- [ ] Inline object arrays parse correctly
- [ ] Modifiers work on nested fields
- [ ] Indentation errors are reported clearly
- [ ] All tests pass with 100% coverage

---

## Edge Cases to Handle

1. Empty objects: `user: object: User` (no children)
2. Empty arrays: `tags: array: Tags` (no item specified - default to `any`?)
3. Mixed modifiers and children in same block
4. Inconsistent indentation within nested structures
