import { MarkupKind } from 'vscode-languageserver/node';
import { Schema } from '@clearschema/core';
import { getHover } from '../../src/hover';

/** Helper: build a minimal Schema with definitions and fields. */
function makeSchema(overrides: Partial<Schema> = {}): Schema {
    return {
        imports: [],
        definitions: [],
        fields: [],
        location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 1, offset: 0 },
        },
        ...overrides,
    };
}

describe('getHover', () => {
    // ----- Type keywords ---------------------------------------------------

    it('returns markdown docs when hovering over "string"', () => {
        const line = 'name: string: A name';
        const result = getHover(line, 6, null);
        expect(result).not.toBeNull();
        expect(result!.contents).toEqual({
            kind: MarkupKind.Markdown,
            value: expect.stringContaining('**string**'),
        });
        expect((result!.contents as { value: string }).value).toContain(
            'minLength'
        );
    });

    it('returns markdown docs when hovering over "number"', () => {
        const line = 'age: number: Age';
        const result = getHover(line, 5, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**number**'
        );
    });

    it('returns markdown docs when hovering over "object"', () => {
        const line = 'address: object: Address';
        const result = getHover(line, 9, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**object**'
        );
    });

    it('returns markdown docs when hovering over "array"', () => {
        const line = 'tags: array: Tags';
        const result = getHover(line, 6, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**array**'
        );
    });

    it('returns markdown docs when hovering over "boolean"', () => {
        const line = 'active: boolean: Active flag';
        const result = getHover(line, 8, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**boolean**'
        );
    });

    it('returns markdown docs when hovering over "integer"', () => {
        const line = 'count: integer: Count';
        const result = getHover(line, 7, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**integer**'
        );
    });

    // ----- Modifier names on ^ lines ---------------------------------------

    it('returns modifier docs when hovering over "minLength" on a modifier line', () => {
        const line = '  ^ minLength: 2';
        // cursor on the 'm' of minLength
        const idx = line.indexOf('minLength');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        const value = (result!.contents as { value: string }).value;
        expect(value).toContain('**minLength**');
        expect(value).toContain('```');
    });

    it('returns modifier docs when hovering over "format" on a modifier line', () => {
        const line = '  ^ format: email';
        const idx = line.indexOf('format');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        const value = (result!.contents as { value: string }).value;
        expect(value).toContain('**format**');
        expect(value).toContain('email');
    });

    it('returns modifier docs for type-prefixed modifiers like "string.minLength"', () => {
        const line = '  ^ string.minLength: 3';
        const idx = line.indexOf('string.minLength');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        const value = (result!.contents as { value: string }).value;
        expect(value).toContain('**minLength**');
    });

    // ----- $ref targets ----------------------------------------------------

    it('returns definition summary for $ref target when schema has the definition', () => {
        const schema = makeSchema({
            definitions: [
                {
                    name: 'Address',
                    field: {
                        name: 'Address',
                        type: 'object',
                        description: 'Postal address',
                        required: false,
                        nullable: false,
                        rawModifiers: {},
                        modifiers: [],
                        fields: [
                            {
                                name: 'street',
                                type: 'string',
                                description: 'Street',
                                required: true,
                                nullable: false,
                                rawModifiers: {},
                                modifiers: [],
                                location: {
                                    start: { line: 3, column: 1, offset: 0 },
                                    end: { line: 3, column: 30, offset: 0 },
                                },
                            } as any,
                            {
                                name: 'city',
                                type: 'string',
                                description: 'City',
                                required: false,
                                nullable: false,
                                rawModifiers: {},
                                modifiers: [],
                                location: {
                                    start: { line: 4, column: 1, offset: 0 },
                                    end: { line: 4, column: 20, offset: 0 },
                                },
                            } as any,
                        ],
                        location: {
                            start: { line: 2, column: 1, offset: 0 },
                            end: { line: 5, column: 1, offset: 0 },
                        },
                    } as any,
                    location: {
                        start: { line: 2, column: 1, offset: 0 },
                        end: { line: 5, column: 1, offset: 0 },
                    },
                },
            ],
        });

        const line = '  home: $ref: #/$defs/Address';
        const idx = line.indexOf('Address');
        const result = getHover(line, idx, schema);
        expect(result).not.toBeNull();
        const value = (result!.contents as { value: string }).value;
        expect(value).toContain('Address');
        expect(value).toContain('street');
        expect(value).toContain('city');
        expect(value).toContain('yes'); // street is required
    });

    // ----- Whitespace / empty ----------------------------------------------

    it('returns null when hovering over whitespace', () => {
        const line = '  name: string: A name';
        const result = getHover(line, 0, null);
        expect(result).toBeNull();
    });

    it('returns null when hovering over a space between words', () => {
        const line = 'name: string: A name';
        const result = getHover(line, 4, null); // the ':' character
        expect(result).toBeNull();
    });

    // ----- Comments --------------------------------------------------------

    it('returns null when hovering over a comment line', () => {
        const line = '# This is a comment';
        const result = getHover(line, 5, null);
        expect(result).toBeNull();
    });

    it('returns null for indented comment lines', () => {
        const line = '  # indented comment';
        const result = getHover(line, 5, null);
        expect(result).toBeNull();
    });

    // ----- Inline modifiers (.required, .nullable) -------------------------

    it('returns brief description for "required" after a dot', () => {
        const line = 'name: string.required: Name';
        const idx = line.indexOf('required');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        const value = (result!.contents as { value: string }).value;
        expect(value).toContain('required');
        expect(value).toContain('mandatory');
    });

    it('returns brief description for "nullable" after a dot', () => {
        const line = 'email: string.nullable: Email';
        const idx = line.indexOf('nullable');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        const value = (result!.contents as { value: string }).value;
        expect(value).toContain('nullable');
        expect(value).toContain('null');
    });

    // ----- No cached schema → static docs still work -----------------------

    it('returns type docs with no cached schema', () => {
        const line = 'age: integer: Age';
        const result = getHover(line, 5, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**integer**'
        );
    });

    it('returns modifier docs with no cached schema', () => {
        const line = '  ^ maxLength: 50';
        const idx = line.indexOf('maxLength');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**maxLength**'
        );
    });

    // ----- Unknown word ----------------------------------------------------

    it('returns null for an unknown word', () => {
        const line = 'foobar baz qux';
        const result = getHover(line, 0, null);
        expect(result).toBeNull();
    });

    it('returns null for an unknown word with schema present', () => {
        const schema = makeSchema();
        const line = 'foobar baz qux';
        const result = getHover(line, 0, schema);
        expect(result).toBeNull();
    });

    // ----- Composition types -----------------------------------------------

    it('returns docs for allOf', () => {
        const line = '  item: allOf: Combined';
        const idx = line.indexOf('allOf');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**allOf**'
        );
    });

    it('returns docs for anyOf', () => {
        const line = '  item: anyOf: One of';
        const idx = line.indexOf('anyOf');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**anyOf**'
        );
    });

    it('returns docs for oneOf', () => {
        const line = '  item: oneOf: Exactly one';
        const idx = line.indexOf('oneOf');
        const result = getHover(line, idx, null);
        expect(result).not.toBeNull();
        expect((result!.contents as { value: string }).value).toContain(
            '**oneOf**'
        );
    });

    // ----- Field names with schema -----------------------------------------

    it('returns field summary when hovering over a field name with schema', () => {
        const schema = makeSchema({
            fields: [
                {
                    name: 'email',
                    type: 'string',
                    description: 'User email',
                    required: true,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    format: 'email',
                    location: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 30, offset: 0 },
                    },
                } as any,
            ],
        });

        const line = 'email: string: User email';
        const result = getHover(line, 0, schema);
        expect(result).not.toBeNull();
        const value = (result!.contents as { value: string }).value;
        expect(value).toContain('**email**');
        expect(value).toContain('`string`');
        expect(value).toContain('required');
    });

    // ----- Hover returns correct Hover shape --------------------------------

    it('returns Hover with MarkupKind.Markdown content', () => {
        const line = 'name: string: Name';
        const result = getHover(line, 6, null);
        expect(result).not.toBeNull();
        expect(result!.contents).toHaveProperty('kind', MarkupKind.Markdown);
        expect(result!.contents).toHaveProperty('value');
    });
});
