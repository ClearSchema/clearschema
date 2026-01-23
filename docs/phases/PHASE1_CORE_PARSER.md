# Phase 1: Core Parser Foundation

**Goal:** Parse basic fields with primitive types and modifiers.

**Portfolio Value:** Shows compiler skills

---

## Deliverables

- [x] Project setup (TypeScript, Jest, ESLint, package.json)
- [x] Lexer with Indentation State Machine (INDENT/DEDENT tokens)
- [x] Resilient Parser (collects errors, recovers, continues)
- [x] Parser for primitive types (string, number, integer, boolean, null)
- [x] Modifier parsing (mapped to first-class AST properties)
- [x] AST type definitions
- [x] Error handling with line/column info
- [x] Unit tests for all primitive types (83 tests, 92%+ coverage)

---

## Syntax Supported

```yaml
name: string.required: Full name
  ^ minLength: 2
  ^ maxLength: 50
  ^ default: "Unknown"
```

---

## Implementation Guide

### Step 1: Project Setup

#### Initialize the project

```bash
mkdir clearschema && cd clearschema
npm init -y
```

#### Install dev dependencies

```bash
npm install -D typescript @types/node jest ts-jest @types/jest eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### jest.config.js

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
```

#### package.json scripts

```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src tests --ext .ts"
  }
}
```

---

### Step 2: Core Types (`src/ast/types.ts`)

Define the AST node types first - this is your contract.

```typescript
// src/ast/types.ts

/**
 * Position in source for error reporting
 */
export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

/**
 * Source location span
 */
export interface SourceLocation {
  start: SourcePosition;
  end: SourcePosition;
}

/**
 * Base for all AST nodes
 */
export interface ASTNode {
  location: SourceLocation;
}

/**
 * Primitive type names
 */
export type PrimitiveType = 'string' | 'number' | 'integer' | 'boolean' | 'null';

/**
 * Complex type names
 */
export type ComplexType = 'object' | 'array' | 'array.tuple';

/**
 * All field type names
 */
export type FieldTypeName = PrimitiveType | ComplexType | 'union' | 'ref' | 'allOf' | 'anyOf' | 'oneOf';

/**
 * Possible values for modifiers
 */
export type ModifierValue =
  | string
  | number
  | boolean
  | null
  | ModifierValue[]
  | { [key: string]: ModifierValue };

/**
 * Base field interface
 */
export interface BaseField extends ASTNode {
  name: string;
  type: FieldTypeName;
  description: string;

  // Universal modifiers (first-class)
  required: boolean;
  nullable: boolean;
  default?: any;
  const?: any;
  enum?: any[];

  // Raw modifiers for unsupported/extension lookups
  rawModifiers: Record<string, any>;
}

/**
 * String field
 */
export interface StringField extends BaseField {
  type: 'string';

  // String modifiers
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

/**
 * Number field (includes integer)
 */
export interface NumberField extends BaseField {
  type: 'number' | 'integer';

  // Number modifiers
  min?: number;
  max?: number;
  exclusiveMin?: number;
  exclusiveMax?: number;
  multipleOf?: number;
}

/**
 * Boolean field
 */
export interface BooleanField extends BaseField {
  type: 'boolean';
}

/**
 * Null field
 */
export interface NullField extends BaseField {
  type: 'null';
}

/**
 * Object field with nested fields
 */
export interface ObjectField extends BaseField {
  type: 'object';
  fields: Field[];
}

/**
 * Array field
 */
export interface ArrayField extends BaseField {
  type: 'array';
  itemType: Field | FieldTypeName;

  // Array modifiers
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

/**
 * Tuple array field
 */
export interface TupleArrayField extends BaseField {
  type: 'array.tuple';
  items: Field[];
}

/**
 * Union field
 */
export interface UnionField extends BaseField {
  type: 'union';
  types: FieldTypeName[];

  /**
   * Type-specific modifiers keyed by type name.
   * Only populated when modifiers use type prefixes (e.g., ^ string.minLength: 3)
   */
  typeModifiers?: {
    [typeName: string]: Partial<StringModifiers | NumberModifiers | ArrayModifiers>;
  };
}

/**
 * String-specific modifiers
 */
interface StringModifiers {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

/**
 * Number-specific modifiers (also applies to integer)
 */
interface NumberModifiers {
  min?: number;
  max?: number;
  exclusiveMin?: number;
  exclusiveMax?: number;
  multipleOf?: number;
}

/**
 * Array-specific modifiers
 */
interface ArrayModifiers {
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

/**
 * Reference field
 */
export interface RefField extends BaseField {
  type: 'ref';
  ref: string;  // JSON Pointer, e.g., "#/$defs/User"
}

/**
 * Union of all field types
 */
export type Field =
  | StringField
  | NumberField
  | BooleanField
  | NullField
  | ObjectField
  | ArrayField
  | TupleArrayField
  | UnionField
  | RefField;

/**
 * Schema definition in $defs
 */
export interface SchemaDefinition extends ASTNode {
  name: string;
  field: Field;
}

/**
 * Complete parsed schema document
 */
export interface Schema extends ASTNode {
  namespace?: string;
  version?: string;
  targets?: string[];
  definitions: SchemaDefinition[];
  fields: Field[];
  errors?: Error[]; // Resilient parsing errors
}
```

---

### Step 3: Error Classes (`src/parser/errors.ts`)

```typescript
// src/parser/errors.ts

import { SourcePosition, SourceLocation } from '../ast/types';

/**
 * Base parse error with location info
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public location: SourceLocation,
    public source: string,
    public hint?: string
  ) {
    super(message);
    this.name = 'ParseError';
  }

  /**
   * Format error with source context
   */
  format(): string {
    const lines = this.source.split('\n');
    const line = lines[this.location.start.line - 1] || '';
    const lineNum = this.location.start.line;
    const col = this.location.start.column;

    let output = `${this.name}: ${this.message}\n`;
    output += `  --> line ${lineNum}:${col}\n`;
    output += `   |\n`;
    output += ` ${lineNum} | ${line}\n`;
    output += `   | ${' '.repeat(col - 1)}${'~'.repeat(Math.max(1, this.location.end.column - col))}\n`;

    if (this.hint) {
      output += `   |\n`;
      output += `  help: ${this.hint}\n`;
    }

    return output;
  }
}

/**
 * Create a position from line/column
 */
export function pos(line: number, column: number, offset: number = 0): SourcePosition {
  return { line, column, offset };
}

/**
 * Create a location span
 */
export function loc(start: SourcePosition, end: SourcePosition): SourceLocation {
  return { start, end };
}
```

---

### Step 4: Lexer (`src/lexer/lexer.ts`)

The lexer tokenizes input into lines with metadata using an Indentation State Machine.

```typescript
// src/lexer/lexer.ts

/**
 * Token types
 */
export type TokenType =
  | 'FIELD_LINE'      // name: type.modifiers: description
  | 'MODIFIER_LINE'   // ^ modifier: value
  | 'ARRAY_ITEM'      // - itemType
  | 'DEFINITION'      // $defs:
  | 'NAMESPACE'       // namespace: value
  | 'VERSION'         // version: value
  | 'TARGETS'         // targets: [...]
  | 'INDENT'          // Indentation increase
  | 'DEDENT'          // Indentation decrease
  | 'EOF';            // End of file

/**
 * A token with position and content
 */
export interface Token {
  type: TokenType;
  content: string;
  line: number;
  column: number;
  indent: number; // Raw indentation level (spaces)
}

/**
 * Tokenize input using Indentation State Machine
 */
export function tokenize(input: string): Token[] {
  const lines = input.split(/\r?\n/);
  const tokens: Token[] = [];
  const indentStack: number[] = [0]; // Start with 0 indentation

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();

    // Skip empty lines (they don't affect indentation in this grammar)
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      continue;
    }

    const currentIndent = rawLine.length - rawLine.trimStart().length;
    const previousIndent = indentStack[indentStack.length - 1];
    const lineNum = i + 1;

    // Handle Indentation
    if (currentIndent > previousIndent) {
      // Indent
      indentStack.push(currentIndent);
      tokens.push({
        type: 'INDENT',
        content: '',
        line: lineNum,
        column: 1,
        indent: currentIndent
      });
    } else if (currentIndent < previousIndent) {
      // Dedent(s)
      while (indentStack.length > 1 && currentIndent < indentStack[indentStack.length - 1]) {
        indentStack.pop();
        tokens.push({
          type: 'DEDENT',
          content: '',
          line: lineNum,
          column: 1,
          indent: indentStack[indentStack.length - 1]
        });
      }

      if (currentIndent !== indentStack[indentStack.length - 1]) {
        throw new Error(`Inconsistent indentation at line ${lineNum}. Expected ${indentStack[indentStack.length - 1]} spaces but got ${currentIndent}.`);
      }
    }

    // Determine Token Type
    const type = detectTokenType(trimmedLine);
    tokens.push({
      type,
      content: trimmedLine,
      line: lineNum,
      column: currentIndent + 1,
      indent: currentIndent
    });
  }

  // EOF: Close any remaining indents
  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({
      type: 'DEDENT',
      content: '',
      line: lines.length + 1,
      column: 1,
      indent: 0
    });
  }

  tokens.push({
    type: 'EOF',
    content: '',
    line: lines.length + 1,
    column: 1,
    indent: 0
  });

  return tokens;
}

function detectTokenType(content: string): TokenType {
  if (content.startsWith('^')) return 'MODIFIER_LINE';
  if (content.startsWith('- ') || content === '-') return 'ARRAY_ITEM';
  if (content.startsWith('$defs:')) return 'DEFINITION';
  if (content.startsWith('namespace:')) return 'NAMESPACE';
  if (content.startsWith('version:')) return 'VERSION';
  if (content.startsWith('targets:')) return 'TARGETS';
  return 'FIELD_LINE';
}

/**
 * Token stream for parser consumption
 */
export class TokenStream {
  private position = 0;

  constructor(private tokens: Token[]) {}

  current(): Token {
    return this.tokens[this.position];
  }

  peek(offset: number = 1): Token {
    return this.tokens[Math.min(this.position + offset, this.tokens.length - 1)];
  }

  advance(): Token {
    if (!this.isAtEnd()) {
      this.position++;
    }
    return this.tokens[this.position - 1];
  }

  isAtEnd(): boolean {
    return this.current().type === 'EOF';
  }

  match(type: TokenType): boolean {
    if (this.current().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  expect(type: TokenType, errorMessage?: string): Token {
    if (this.current().type === type) {
      return this.advance();
    }
    throw new Error(errorMessage || `Expected ${type} but got ${this.current().type}`);
  }
}
```

---

### Step 5: Parser Core (`src/parser/parser.ts`)

```typescript
// src/parser/parser.ts

import {
  Schema, Field, StringField, NumberField, BooleanField, NullField,
  ObjectField, ArrayField, ModifierValue, SourceLocation, PrimitiveType,
  FieldTypeName, BaseField
} from '../ast/types';
import { Token, TokenStream, tokenize, TokenType } from '../lexer/lexer';
import { ParseError, pos, loc } from './errors';

/**
 * Main parse function
 */
export function parse(input: string): Schema {
  const tokens = tokenize(input);
  const stream = new TokenStream(tokens);
  const parser = new Parser(stream, input);
  return parser.parseSchema();
}

/**
 * Parse a single field (useful for testing)
 */
export function parseField(input: string): Field {
  const tokens = tokenize(input);
  const stream = new TokenStream(tokens);
  const parser = new Parser(stream, input);
  return parser.parseField();
}

/**
 * Recursive descent parser with resiliency
 */
class Parser {
  private errors: ParseError[] = [];

  constructor(
    private stream: TokenStream,
    private source: string
  ) {}

  /**
   * Recover from error by skipping to next field or dedent
   */
  private synchronize(): void {
    this.stream.advance();

    while (!this.stream.isAtEnd()) {
      if (this.stream.current().type === 'FIELD_LINE') return;
      if (this.stream.current().type === 'DEDENT') return;
      this.stream.advance();
    }
  }

  /**
   * Parse complete schema document
   */
  parseSchema(): Schema {
    const startToken = this.stream.current();
    let namespace: string | undefined;
    let version: string | undefined;
    let targets: string[] | undefined;
    const fields: Field[] = [];

    // Parse metadata
    while (!this.stream.isAtEnd()) {
      const token = this.stream.current();

      if (token.type === 'NAMESPACE') {
        const value = token.content.slice('namespace:'.length).trim();
        namespace = value;
        this.stream.advance();
      } else if (token.type === 'VERSION') {
        const value = token.content.slice('version:'.length).trim();
        version = value;
        this.stream.advance();
      } else if (token.type === 'TARGETS') {
        const value = token.content.slice('targets:'.length).trim();
        targets = this.parseTargets(value);
        this.stream.advance();
      } else {
        break;
      }
    }

    // Parse fields
    while (!this.stream.isAtEnd()) {
      if (this.stream.current().type === 'EOF') break;

      try {
        const field = this.parseField();
        if (field) {
          fields.push(field);
        } else {
          this.stream.advance();
        }
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
    }

    return {
      namespace,
      version,
      targets,
      definitions: [], // TODO: $defs in Phase 3
      fields,
      errors: this.errors.length > 0 ? this.errors : undefined,
      location: this.tokenLocation(startToken),
    };
  }

  /**
   * Parse a field and its children (modifiers, nested fields)
   */
  parseField(): Field {
    const token = this.stream.expect('FIELD_LINE');

    // 1. Parse Line Structure: name: type: description
    const content = token.content;
    const firstColon = content.indexOf(':');

    if (firstColon === -1) {
      throw this.error('Expected ":" after field name', token);
    }

    const name = content.slice(0, firstColon).trim();
    const rest = content.slice(firstColon + 1).trim();
    const secondColon = rest.indexOf(':');

    let typeString: string;
    let description: string;

    if (secondColon === -1) {
      typeString = rest;
      description = '';
    } else {
      typeString = rest.slice(0, secondColon).trim();
      description = rest.slice(secondColon + 1).trim();
    }

    // 2. Parse Type String
    const { type, required, nullable, isArray, isTuple } = this.parseTypeString(typeString);

    // Initialize Base Field Data
    const base: any = {
      name,
      description,
      required,
      nullable,
      rawModifiers: {},
      location: this.tokenLocation(token),
    };

    // 3. Handle Indented Block (Modifiers & Children)
    const children: Field[] = [];

    if (this.stream.match('INDENT')) {
      while (!this.stream.match('DEDENT') && !this.stream.isAtEnd()) {
        const current = this.stream.current();

        if (current.type === 'MODIFIER_LINE') {
           this.parseModifierLine(current, base);
           this.stream.advance();
        } else if (current.type === 'FIELD_LINE') {
           // Child field (for objects)
           children.push(this.parseField());
        } else if (current.type === 'ARRAY_ITEM') {
           // Array item - handled in Phase 2
           this.stream.advance();
        } else {
           this.stream.advance();
        }
      }
    }

    // 4. Construct Final Field Node
    if (type === 'object') {
      return { ...base, type: 'object', fields: children } as ObjectField;
    } else if (isArray) {
      return { ...base, type: 'array', itemType: 'string' } as ArrayField;
    }

    // Primitive
    return { ...base, type: type as any };
  }

  /**
   * Parse type string: type[.required][.nullable]
   */
  parseTypeString(typeString: string) {
    const parts = typeString.split('.');
    const type = parts[0];
    const required = parts.includes('required');
    const nullable = parts.includes('nullable');

    const isArray = type === 'array';
    const isTuple = typeString.startsWith('array.tuple');

    return { type, required, nullable, isArray, isTuple };
  }

  /**
   * Parse a single modifier line and apply to field object
   */
  parseModifierLine(token: Token, field: any): void {
    const content = token.content.slice(1).trim(); // Remove leading ^
    const colonIndex = content.indexOf(':');

    let name: string;
    let value: ModifierValue;

    if (colonIndex === -1) {
      name = content;
      value = true;
    } else {
      name = content.slice(0, colonIndex).trim();
      const valueStr = content.slice(colonIndex + 1).trim();
      value = this.parseModifierValue(valueStr);
    }

    // Check for type prefix (e.g., "string.minLength")
    if (name.includes('.')) {
      const parts = name.split('.');
      name = parts[1];
    }

    // Map common modifiers to first-class properties
    if (name === 'default') field.default = value;
    else if (name === 'const') field.const = value;
    else if (name === 'enum') field.enum = value as any[];
    else if (name === 'minLength') field.minLength = value;
    else if (name === 'maxLength') field.maxLength = value;
    else if (name === 'pattern') field.pattern = value;
    else if (name === 'format') field.format = value;
    else if (name === 'min') field.min = value;
    else if (name === 'max') field.max = value;
    else {
      field.rawModifiers[name] = value;
    }
  }

  /**
   * Parse modifier value
   */
  parseModifierValue(valueStr: string): ModifierValue {
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;
    if (valueStr === 'null') return null;
    const num = Number(valueStr);
    if (!isNaN(num) && valueStr !== '') return num;

    // Simple array parsing [a, b]
    if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      return valueStr.slice(1, -1).split(',').map(s => this.parseModifierValue(s.trim()));
    }

    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.slice(1, -1);
    }
    return valueStr;
  }

  /**
   * Parse targets string: [target1, target2] or target1
   */
  parseTargets(value: string): string[] {
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      return inner.split(',').map(s => s.trim()).filter(s => s !== '');
    }
    return [value];
  }

  /**
   * Create error with location
   */
  error(message: string, token: Token, hint?: string): ParseError {
    return new ParseError(
      message,
      this.tokenLocation(token),
      this.source,
      hint
    );
  }

  /**
   * Get location for a token
   */
  tokenLocation(token: Token): SourceLocation {
    return loc(
      pos(token.line, token.column, 0),
      pos(token.line, token.column + token.content.length, 0)
    );
  }
}
```

---

### Step 6: Public API (`src/index.ts`)

```typescript
// src/index.ts

export { parse, parseField } from './parser/parser';
export { ParseError } from './parser/errors';
export type {
  Schema,
  Field,
  StringField,
  NumberField,
  BooleanField,
  NullField,
  ObjectField,
  ArrayField,
  TupleArrayField,
  UnionField,
  RefField,
  ModifierValue,
  SourceLocation,
  SourcePosition,
  FieldTypeName,
  PrimitiveType,
  ComplexType,
} from './ast/types';
```

---

### Step 7: First Tests (`tests/unit/parser/primitives.test.ts`)

```typescript
// tests/unit/parser/primitives.test.ts

import { parseField, ParseError, StringField, NumberField, BooleanField } from '../../../src';

describe('Parser - Primitive Types', () => {
  describe('string fields', () => {
    it('parses basic string field', () => {
      const field = parseField('name: string: User name') as StringField;

      expect(field.type).toBe('string');
      expect(field.name).toBe('name');
      expect(field.description).toBe('User name');
      expect(field.required).toBe(false);
    });

    it('parses required string field', () => {
      const field = parseField('name: string.required: User name');

      expect(field.type).toBe('string');
      expect(field.required).toBe(true);
    });

    it('parses string with modifiers', () => {
      const input = `name: string.required: User name
  ^ minLength: 2
  ^ maxLength: 50`;

      const field = parseField(input) as StringField;

      expect(field.minLength).toBe(2);
      expect(field.maxLength).toBe(50);
    });

    it('parses string with enum', () => {
      const input = `status: string: Status
  ^ enum: [active, pending, inactive]`;

      const field = parseField(input);

      expect(field.enum).toEqual(['active', 'pending', 'inactive']);
    });

    it('parses string with default', () => {
      const input = `status: string: Status
  ^ default: pending`;

      const field = parseField(input);

      expect(field.default).toBe('pending');
    });
  });

  describe('number fields', () => {
    it('parses basic number field', () => {
      const field = parseField('age: number: Age in years');

      expect(field.type).toBe('number');
      expect(field.name).toBe('age');
    });

    it('parses number with min/max', () => {
      const input = `age: number: Age
  ^ min: 0
  ^ max: 150`;

      const field = parseField(input) as NumberField;

      expect(field.min).toBe(0);
      expect(field.max).toBe(150);
    });

    it('parses integer type', () => {
      const field = parseField('count: integer: Item count');

      expect(field.type).toBe('integer');
    });
  });

  describe('boolean fields', () => {
    it('parses basic boolean field', () => {
      const field = parseField('active: boolean: Is active');

      expect(field.type).toBe('boolean');
    });

    it('parses boolean with default', () => {
      const input = `active: boolean: Is active
  ^ default: true`;

      const field = parseField(input);

      expect(field.default).toBe(true);
    });
  });

  describe('null fields', () => {
    it('parses null field', () => {
      const field = parseField('placeholder: null: Null placeholder');

      expect(field.type).toBe('null');
    });
  });

  describe('nullable modifier', () => {
    it('parses nullable field', () => {
      const field = parseField('middleName: string.nullable: Middle name');

      expect(field.nullable).toBe(true);
    });

    it('parses required nullable field', () => {
      const field = parseField('value: string.required.nullable: Value');

      expect(field.required).toBe(true);
      expect(field.nullable).toBe(true);
    });
  });

  describe('error handling', () => {
    it('reports error for missing colon', () => {
      expect(() => parseField('name string User name')).toThrow(ParseError);
    });

    it('includes line number in error', () => {
      try {
        parseField('name string User name');
        throw new Error('Expected error');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).location.start.line).toBe(1);
      }
    });
  });
});
```

---

## Acceptance Criteria

- [x] All primitive types parse correctly (string, number, integer, boolean, null)
- [x] All universal modifiers work (required, nullable, default, const, enum)
- [x] All type-specific modifiers work (minLength, maxLength, pattern, format, min, max)
- [x] Error messages include line/column
- [x] 92%+ test coverage on parser (exceeded target)

---

## Next Steps

After Phase 1 is solid:

1. **Phase 2:** Add `parseObjectField()` and `parseArrayField()` methods
2. **Phase 3:** Add `parseDefinitions()` for `$defs` and `$ref` resolution
3. **Phase 4:** Create `exporters/json-schema.ts` with visitor pattern

The foundation you build in Phase 1 makes everything else easier. Take your time getting it right.
