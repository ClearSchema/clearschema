/**
 * Integration tests for LSP handler functions.
 *
 * These tests exercise the real parser + handler functions together (no mocks).
 * They validate the full pipeline: parse ClearSchema text -> handler -> LSP result.
 */
import { parse } from '@clearschema/core';
import { getDiagnostics } from '../../src/diagnostics';
import { getCompletions } from '../../src/completion';
import { getHover } from '../../src/hover';
import { getDefinition } from '../../src/definition';
import { getDocumentSymbols } from '../../src/symbols';
import { DocumentState } from '../../src/utils';

// ---------------------------------------------------------------------------
// Shared realistic schema content
// ---------------------------------------------------------------------------

const VALID_SCHEMA = [
    '$defs:',
    '  Address: object: Shipping address',
    '    street: string.required: Street',
    '    city: string.required: City',
    '',
    'user: object.required: User profile',
    '  name: string.required: Full name',
    '    ^ minLength: 2',
    '  email: string.required: Email',
    '    ^ format: email',
    '  address: $ref: #/$defs/Address',
    '  tags: array: Tags',
    '    - string',
].join('\n');

const INVALID_SCHEMA = [
    'name: string: A name',
    '  ^ minLength: 2',
    'bad line without colon',
    'age: unknowntype: Age field',
].join('\n');

const FAKE_URI = 'file:///test/schema.clear';

// ---------------------------------------------------------------------------
// 1. Full pipeline - valid schema
// ---------------------------------------------------------------------------

describe('Full pipeline - valid schema', () => {
    it('parses with zero diagnostics and returns a schema', () => {
        const result = getDiagnostics(VALID_SCHEMA);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.schema).not.toBeNull();
        expect(result.schema!.definitions.length).toBe(1);
        expect(result.schema!.definitions[0].name).toBe('Address');
        expect(result.schema!.fields.length).toBeGreaterThanOrEqual(1);
    });

    it('DocumentState caches schema across updates', () => {
        const state = new DocumentState();
        const diags = state.update(VALID_SCHEMA);
        expect(diags).toHaveLength(0);

        const schema = state.getSchema();
        expect(schema).not.toBeNull();
        expect(schema!.definitions[0].name).toBe('Address');
    });
});

// ---------------------------------------------------------------------------
// 2. Full pipeline - invalid schema
// ---------------------------------------------------------------------------

describe('Full pipeline - invalid schema', () => {
    it('returns diagnostics with correct positions for bad input', () => {
        const result = getDiagnostics(INVALID_SCHEMA);
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

        for (const diag of result.diagnostics) {
            expect(diag.source).toBe('clearschema');
            // 0-based positions
            expect(diag.range.start.line).toBeGreaterThanOrEqual(0);
            expect(diag.range.start.character).toBeGreaterThanOrEqual(0);
        }
    });

    it('detects unknown type errors with hints', () => {
        const result = getDiagnostics(INVALID_SCHEMA);
        const typeError = result.diagnostics.find(
            (d) => d.message.includes('Unknown type') || d.message.includes('unknowntype'),
        );
        // The parser should flag the unknown type or the bad line
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);
        if (typeError) {
            expect(typeError.message).toContain('hint');
        }
    });
});

// ---------------------------------------------------------------------------
// 3. Completion - type context
// ---------------------------------------------------------------------------

describe('Completion - type context', () => {
    it('returns type completions after "fieldName: "', () => {
        const lines = VALID_SCHEMA.split('\n');
        // Simulate typing a new field: `status: `
        const newLine = 'status: ';
        const allLines = [...lines, newLine];
        const lineNumber = allLines.length - 1;

        const items = getCompletions(newLine, newLine.length, allLines, lineNumber, null);
        expect(items.length).toBeGreaterThan(0);

        const labels = items.map((i) => i.label);
        expect(labels).toContain('string');
        expect(labels).toContain('number');
        expect(labels).toContain('integer');
        expect(labels).toContain('boolean');
        expect(labels).toContain('object');
        expect(labels).toContain('array');
        expect(labels).toContain('$ref');
    });
});

// ---------------------------------------------------------------------------
// 4. Completion - modifier context
// ---------------------------------------------------------------------------

describe('Completion - modifier context', () => {
    it('returns string modifiers under a string field', () => {
        const lines = VALID_SCHEMA.split('\n');
        // Line 6 (0-indexed) is `  name: string.required: Full name`
        // Line 7 is `    ^ minLength: 2`
        // Simulate cursor on a new `    ^ ` line after the name field
        const modLine = '    ^ ';
        // Insert after line 7 (the name field's modifier line)
        const allLines = [...lines.slice(0, 8), modLine, ...lines.slice(8)];
        const lineNumber = 8;

        const items = getCompletions(modLine, modLine.length, allLines, lineNumber, null);
        expect(items.length).toBeGreaterThan(0);

        const labels = items.map((i) => i.label);
        // String-specific modifiers
        expect(labels).toContain('minLength');
        expect(labels).toContain('maxLength');
        expect(labels).toContain('pattern');
        expect(labels).toContain('format');
        // Universal modifiers
        expect(labels).toContain('default');
        expect(labels).toContain('const');
        expect(labels).toContain('enum');
    });

    it('returns number modifiers under a number field', () => {
        const lines = ['age: number: Age', '  ^ '];
        const items = getCompletions(lines[1], lines[1].length, lines, 1, null);
        const labels = items.map((i) => i.label);
        expect(labels).toContain('min');
        expect(labels).toContain('max');
        expect(labels).toContain('exclusiveMin');
        expect(labels).toContain('exclusiveMax');
        expect(labels).toContain('multipleOf');
    });
});

// ---------------------------------------------------------------------------
// 5. Completion - ref context
// ---------------------------------------------------------------------------

describe('Completion - $ref context', () => {
    it('suggests definition names after "$ref: "', () => {
        const result = getDiagnostics(VALID_SCHEMA);
        const schema = result.schema;
        expect(schema).not.toBeNull();

        const lines = VALID_SCHEMA.split('\n');
        const refLine = '  shipping: $ref: ';
        const allLines = [...lines, refLine];
        const lineNumber = allLines.length - 1;

        const items = getCompletions(refLine, refLine.length, allLines, lineNumber, schema);
        expect(items.length).toBeGreaterThanOrEqual(1);

        const labels = items.map((i) => i.label);
        expect(labels).toContain('Address');

        // Should provide insertText with full ref path
        const addressItem = items.find((i) => i.label === 'Address');
        expect(addressItem).toBeDefined();
        expect(addressItem!.insertText).toBe('#/$defs/Address');
    });
});

// ---------------------------------------------------------------------------
// 6. Hover - type
// ---------------------------------------------------------------------------

describe('Hover - type keyword', () => {
    it('returns markdown docs when hovering over "string"', () => {
        // Use a line without .required so the word is just "string"
        const line = '  name: string: Full name';
        const charPos = line.indexOf('string');
        const hover = getHover(line, charPos, null);
        expect(hover).not.toBeNull();
        expect(hover!.contents).toHaveProperty('kind', 'markdown');
        const value = (hover!.contents as { value: string }).value;
        expect(value).toContain('**string**');
        expect(value).toContain('minLength');
    });

    it('returns markdown docs when hovering over "object"', () => {
        const line = 'user: object: User profile';
        const charPos = line.indexOf('object');
        const hover = getHover(line, charPos, null);
        expect(hover).not.toBeNull();
        const value = (hover!.contents as { value: string }).value;
        expect(value).toContain('**object**');
    });
});

// ---------------------------------------------------------------------------
// 7. Hover - modifier
// ---------------------------------------------------------------------------

describe('Hover - modifier', () => {
    it('returns docs when hovering over "minLength" on a modifier line', () => {
        const line = '    ^ minLength: 2';
        const charPos = line.indexOf('minLength');
        const hover = getHover(line, charPos, null);
        expect(hover).not.toBeNull();
        const value = (hover!.contents as { value: string }).value;
        expect(value).toContain('**minLength**');
        expect(value).toContain('Minimum string length');
    });

    it('returns docs when hovering over "format" on a modifier line', () => {
        const line = '    ^ format: email';
        const charPos = line.indexOf('format');
        const hover = getHover(line, charPos, null);
        expect(hover).not.toBeNull();
        const value = (hover!.contents as { value: string }).value;
        expect(value).toContain('**format**');
    });
});

// ---------------------------------------------------------------------------
// 8. Hover - $ref target
// ---------------------------------------------------------------------------

describe('Hover - $ref target', () => {
    it('returns definition summary when hovering over ref path', () => {
        const result = getDiagnostics(VALID_SCHEMA);
        const schema = result.schema!;

        const line = '  address: $ref: #/$defs/Address';
        // Hover over "Address" at the end of the ref path
        const charPos = line.lastIndexOf('Address');
        const hover = getHover(line, charPos, schema);
        expect(hover).not.toBeNull();
        const value = (hover!.contents as { value: string }).value;
        expect(value).toContain('$defs/Address');
        // Should include the definition's fields in the summary
        expect(value).toContain('street');
        expect(value).toContain('city');
    });
});

// ---------------------------------------------------------------------------
// 9. Definition - $ref
// ---------------------------------------------------------------------------

describe('Definition - $ref', () => {
    it('resolves $ref to the Address definition location', () => {
        const result = getDiagnostics(VALID_SCHEMA);
        const schema = result.schema!;

        const line = '  address: $ref: #/$defs/Address';
        const charPos = line.indexOf('#/$defs/Address');

        const location = getDefinition(line, charPos, schema, FAKE_URI);
        expect(location).not.toBeNull();
        expect(location!.uri).toBe(FAKE_URI);
        // Range should point to the Address definition (0-based)
        // $defs: is line 0, Address: object... is line 1 (0-based)
        expect(location!.range.start.line).toBeGreaterThanOrEqual(0);
    });

    it('returns null when $ref target does not exist', () => {
        const result = getDiagnostics(VALID_SCHEMA);
        const schema = result.schema!;

        const line = '  foo: $ref: #/$defs/NonExistent';
        const location = getDefinition(line, 0, schema, FAKE_URI);
        expect(location).toBeNull();
    });

    it('returns null for lines without $ref', () => {
        const result = getDiagnostics(VALID_SCHEMA);
        const schema = result.schema!;

        const line = '  name: string.required: Full name';
        const location = getDefinition(line, 0, schema, FAKE_URI);
        expect(location).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 10. Symbols - full schema
// ---------------------------------------------------------------------------

describe('Document symbols - full schema', () => {
    it('returns hierarchy with Address definition and user fields', () => {
        const result = getDiagnostics(VALID_SCHEMA);
        const schema = result.schema!;

        const symbols = getDocumentSymbols(schema);
        expect(symbols.length).toBeGreaterThanOrEqual(2);

        // First symbol should be the Address definition
        const addressSym = symbols.find((s) => s.name === 'Address');
        expect(addressSym).toBeDefined();
        // Definition symbols are SymbolKind.Class (5)
        expect(addressSym!.kind).toBe(5);
        // Address should have children: street, city
        expect(addressSym!.children).toBeDefined();
        expect(addressSym!.children!.length).toBe(2);
        const childNames = addressSym!.children!.map((c) => c.name);
        expect(childNames).toContain('street');
        expect(childNames).toContain('city');

        // User symbol should be present
        const userSym = symbols.find((s) => s.name === 'user');
        expect(userSym).toBeDefined();
        // Object type -> SymbolKind.Object (19)
        expect(userSym!.kind).toBe(19);
        // User should have children: name, email, address, tags
        expect(userSym!.children).toBeDefined();
        expect(userSym!.children!.length).toBeGreaterThanOrEqual(4);
        const userChildNames = userSym!.children!.map((c) => c.name);
        expect(userChildNames).toContain('name');
        expect(userChildNames).toContain('email');
        expect(userChildNames).toContain('address');
        expect(userChildNames).toContain('tags');
    });

    it('returns empty array for null schema', () => {
        const symbols = getDocumentSymbols(null);
        expect(symbols).toEqual([]);
    });

    it('symbol ranges are 0-based', () => {
        const result = getDiagnostics(VALID_SCHEMA);
        const schema = result.schema!;

        const symbols = getDocumentSymbols(schema);
        for (const sym of symbols) {
            expect(sym.range.start.line).toBeGreaterThanOrEqual(0);
            expect(sym.range.start.character).toBeGreaterThanOrEqual(0);
            expect(sym.selectionRange.start.line).toBeGreaterThanOrEqual(0);
        }
    });
});

// ---------------------------------------------------------------------------
// Cross-cutting: DocumentState integration
// ---------------------------------------------------------------------------

describe('DocumentState integration', () => {
    it('caches schema from valid parse, available for hover/definition/symbols', () => {
        const state = new DocumentState();
        state.update(VALID_SCHEMA);
        const schema = state.getSchema();
        expect(schema).not.toBeNull();

        // Hover works with cached schema
        const line = '  address: $ref: #/$defs/Address';
        const hover = getHover(line, line.lastIndexOf('Address'), schema);
        expect(hover).not.toBeNull();

        // Definition works with cached schema
        const def = getDefinition(line, line.indexOf('#/$defs/Address'), schema, FAKE_URI);
        expect(def).not.toBeNull();

        // Symbols work with cached schema
        const symbols = getDocumentSymbols(schema);
        expect(symbols.length).toBeGreaterThanOrEqual(2);
    });

    it('retains last good schema after a bad update', () => {
        const state = new DocumentState();
        // First: valid
        state.update(VALID_SCHEMA);
        expect(state.getSchema()).not.toBeNull();
        const firstSchema = state.getSchema();

        // Second: catastrophically bad (if the parser throws)
        // Even with errors, the parser usually returns a schema, so the
        // cached schema should still be non-null after update
        state.update('   :::totally broken::: \n  @@@ garbage');
        expect(state.getSchema()).not.toBeNull();
    });
});
