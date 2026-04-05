import { getDocumentSymbols } from '../../src/symbols';
import { SymbolKind } from 'vscode-languageserver/node';
import { Schema, SourceLocation, Field, SchemaDefinition } from '@clearschema/core';

function loc(line: number, col: number, endLine: number, endCol: number): SourceLocation {
    return {
        start: { line, column: col, offset: 0 },
        end: { line: endLine, column: endCol, offset: 0 },
    };
}

const baseProps = {
    description: '',
    required: false,
    nullable: false,
    rawModifiers: {},
    modifiers: [],
};

function makeField(name: string, type: string, location: SourceLocation, extra?: Partial<Field>): Field {
    return { name, type, ...baseProps, location, ...extra } as Field;
}

function makeSchema(definitions: SchemaDefinition[], fields: Field[]): Schema {
    return {
        definitions,
        fields,
        imports: [],
        location: loc(1, 1, 20, 1),
    };
}

describe('getDocumentSymbols', () => {
    it('returns empty array when schema is null', () => {
        expect(getDocumentSymbols(null)).toEqual([]);
    });

    it('returns empty array for empty schema', () => {
        const schema = makeSchema([], []);
        expect(getDocumentSymbols(schema)).toEqual([]);
    });

    it('returns Class symbols for definitions', () => {
        const defLoc = loc(2, 1, 5, 1);
        const def: SchemaDefinition = {
            name: 'Address',
            field: makeField('Address', 'object', defLoc, { fields: [] }),
            location: defLoc,
        };
        const schema = makeSchema([def], []);
        const symbols = getDocumentSymbols(schema);

        expect(symbols).toHaveLength(1);
        expect(symbols[0].name).toBe('Address');
        expect(symbols[0].kind).toBe(SymbolKind.Class);
        expect(symbols[0].detail).toBe('object');
        // 0-based: line 2 → 1
        expect(symbols[0].range.start.line).toBe(1);
    });

    it('maps different field types to appropriate SymbolKinds', () => {
        const fields: Field[] = [
            makeField('name', 'string', loc(2, 1, 2, 20)),
            makeField('age', 'number', loc(3, 1, 3, 20)),
            makeField('active', 'boolean', loc(4, 1, 4, 20)),
            makeField('tags', 'array', loc(5, 1, 5, 20), { itemType: 'string' }),
            makeField('addr', 'ref', loc(6, 1, 6, 20), { ref: 'Address' }),
        ];
        const schema = makeSchema([], fields);
        const symbols = getDocumentSymbols(schema);

        expect(symbols).toHaveLength(5);
        expect(symbols[0].kind).toBe(SymbolKind.String);
        expect(symbols[1].kind).toBe(SymbolKind.Number);
        expect(symbols[2].kind).toBe(SymbolKind.Boolean);
        expect(symbols[3].kind).toBe(SymbolKind.Array);
        expect(symbols[4].kind).toBe(SymbolKind.Variable);
    });

    it('nests children for object fields', () => {
        const childField = makeField('street', 'string', loc(4, 3, 4, 30));
        const objField = makeField('address', 'object', loc(3, 1, 5, 1), {
            fields: [childField],
        });
        const schema = makeSchema([], [objField]);
        const symbols = getDocumentSymbols(schema);

        expect(symbols).toHaveLength(1);
        expect(symbols[0].name).toBe('address');
        expect(symbols[0].kind).toBe(SymbolKind.Object);
        expect(symbols[0].children).toHaveLength(1);
        expect(symbols[0].children![0].name).toBe('street');
        expect(symbols[0].children![0].kind).toBe(SymbolKind.String);
    });

    it('nests children under definitions with object fields', () => {
        const childField = makeField('street', 'string', loc(4, 3, 4, 30));
        const defLoc = loc(2, 1, 6, 1);
        const def: SchemaDefinition = {
            name: 'Address',
            field: makeField('Address', 'object', defLoc, { fields: [childField] }),
            location: defLoc,
        };
        const schema = makeSchema([def], []);
        const symbols = getDocumentSymbols(schema);

        expect(symbols).toHaveLength(1);
        expect(symbols[0].children).toHaveLength(1);
        expect(symbols[0].children![0].name).toBe('street');
    });
});
