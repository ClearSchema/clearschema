import { getDefinition } from '../../src/definition';
import { Schema, SourceLocation } from '@clearschema/core';

function loc(line: number, col: number, endLine: number, endCol: number): SourceLocation {
    return {
        start: { line, column: col, offset: 0 },
        end: { line: endLine, column: endCol, offset: 0 },
    };
}

function makeSchema(defNames: string[]): Schema {
    return {
        definitions: defNames.map((name, i) => ({
            name,
            field: {
                name,
                type: 'object' as const,
                description: '',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                fields: [],
                location: loc(i + 2, 1, i + 2, 20),
            },
            location: loc(i + 2, 1, i + 2, 20),
        })),
        fields: [],
        imports: [],
        location: loc(1, 1, 10, 1),
    };
}

const docUri = 'file:///test.clear';

describe('getDefinition', () => {
    it('resolves $ref: #/$defs/Address when definition exists', () => {
        const schema = makeSchema(['Address']);
        const result = getDefinition('  $ref: #/$defs/Address', 10, schema, docUri);
        expect(result).not.toBeNull();
        expect(result!.uri).toBe(docUri);
        // Definition is at line 2, col 1 → 0-based line 1, character 0
        expect(result!.range.start.line).toBe(1);
        expect(result!.range.start.character).toBe(0);
    });

    it('resolves bare $ref: Address', () => {
        const schema = makeSchema(['Address']);
        const result = getDefinition('  $ref: Address', 10, schema, docUri);
        expect(result).not.toBeNull();
        expect(result!.uri).toBe(docUri);
        expect(result!.range.start.line).toBe(1);
    });

    it('resolves $ref: #/definitions/Address', () => {
        const schema = makeSchema(['Address']);
        const result = getDefinition('  $ref: #/definitions/Address', 10, schema, docUri);
        expect(result).not.toBeNull();
        expect(result!.range.start.line).toBe(1);
    });

    it('returns null for undefined ref', () => {
        const schema = makeSchema(['Address']);
        const result = getDefinition('  $ref: NonExistent', 10, schema, docUri);
        expect(result).toBeNull();
    });

    it('returns null when line has no $ref:', () => {
        const schema = makeSchema(['Address']);
        const result = getDefinition('name: string: A name field', 5, schema, docUri);
        expect(result).toBeNull();
    });

    it('returns null when schema is null', () => {
        const result = getDefinition('  $ref: Address', 10, null, docUri);
        expect(result).toBeNull();
    });
});
