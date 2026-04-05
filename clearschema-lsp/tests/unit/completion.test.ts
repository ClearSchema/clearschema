import { getCompletions } from '../../src/completion';
import { CompletionItemKind } from 'vscode-languageserver/node';
import type { Schema } from '@clearschema/core';

/** Helper to build a minimal Schema with definitions */
function makeSchema(defNames: string[]): Schema {
    return {
        imports: [],
        definitions: defNames.map((name) => ({
            name,
            field: {
                name,
                type: 'object' as const,
                description: `${name} definition`,
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                fields: [],
                location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
            },
            location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        })),
        fields: [],
        location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    };
}

describe('getCompletions', () => {
    describe('type completions', () => {
        it('returns type completions after field name and colon', () => {
            const line = 'name: ';
            const items = getCompletions(line, line.length, [line], 0, null);
            expect(items.length).toBeGreaterThan(0);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('string');
            expect(labels).toContain('number');
            expect(labels).toContain('object');
            expect(labels).toContain('array');
            expect(labels).toContain('$ref');
            expect(labels).toContain('allOf');
            items.forEach((i) => {
                expect(i.kind).toBe(CompletionItemKind.TypeParameter);
            });
        });

        it('returns type completions on array item line "  - "', () => {
            const lines = ['tags: array: Tags', '  - '];
            const line = lines[1];
            const items = getCompletions(line, line.length, lines, 1, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('string');
            expect(labels).toContain('object');
            expect(labels).toContain('$ref');
        });

        it('returns type completions on array item line "  -  " (extra space)', () => {
            const line = '  -  ';
            const items = getCompletions(line, line.length, [line], 0, null);
            expect(items.length).toBeGreaterThan(0);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('string');
        });
    });

    describe('modifier completions', () => {
        it('returns string modifiers under a string field', () => {
            const lines = ['name: string: A name', '  ^ '];
            const line = lines[1];
            const items = getCompletions(line, line.length, lines, 1, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('minLength');
            expect(labels).toContain('maxLength');
            expect(labels).toContain('pattern');
            expect(labels).toContain('format');
            // Universal modifiers should also be present
            expect(labels).toContain('default');
            expect(labels).toContain('const');
            expect(labels).toContain('enum');
            // Should NOT contain number modifiers
            expect(labels).not.toContain('min');
            expect(labels).not.toContain('max');
            items.forEach((i) => {
                expect(i.kind).toBe(CompletionItemKind.Property);
            });
        });

        it('returns number modifiers under a number field', () => {
            const lines = ['age: number: Age', '  ^ '];
            const line = lines[1];
            const items = getCompletions(line, line.length, lines, 1, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('min');
            expect(labels).toContain('max');
            expect(labels).toContain('exclusiveMin');
            expect(labels).toContain('exclusiveMax');
            expect(labels).toContain('multipleOf');
            expect(labels).toContain('default');
            expect(labels).not.toContain('minLength');
        });

        it('returns number modifiers under an integer field', () => {
            const lines = ['count: integer: Count', '  ^ '];
            const line = lines[1];
            const items = getCompletions(line, line.length, lines, 1, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('min');
            expect(labels).toContain('multipleOf');
        });

        it('returns array modifiers under an array field', () => {
            const lines = ['tags: array: Tags', '  - string', '  ^ '];
            const line = lines[2];
            const items = getCompletions(line, line.length, lines, 2, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('minItems');
            expect(labels).toContain('maxItems');
            expect(labels).toContain('uniqueItems');
            expect(labels).toContain('default');
        });

        it('returns only universal modifiers under unknown field type', () => {
            const lines = ['  ^ '];
            const line = lines[0];
            // No field line above — parent type is null
            const items = getCompletions(line, line.length, lines, 0, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('default');
            expect(labels).toContain('const');
            expect(labels).toContain('enum');
            expect(labels).toHaveLength(3);
        });

        it('skips comment and modifier lines when searching for parent field', () => {
            const lines = [
                'email: string: Email',
                '  # a comment',
                '  ^ format: email',
                '  ^ ',
            ];
            const line = lines[3];
            const items = getCompletions(line, line.length, lines, 3, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('minLength');
            expect(labels).toContain('format');
        });
    });

    describe('ref completions', () => {
        it('suggests definition names after $ref: ', () => {
            const schema = makeSchema(['User', 'Address']);
            const line = 'addr: $ref: ';
            const items = getCompletions(line, line.length, [line], 0, schema);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('User');
            expect(labels).toContain('Address');
            items.forEach((i) => {
                expect(i.kind).toBe(CompletionItemKind.Reference);
                expect(i.insertText).toMatch(/^#\/\$defs\//);
            });
        });

        it('returns empty ref completions when schema is null', () => {
            const line = 'addr: $ref: ';
            const items = getCompletions(line, line.length, [line], 0, null);
            expect(items).toHaveLength(0);
        });

        it('returns empty ref completions when schema has no definitions', () => {
            const schema = makeSchema([]);
            const line = 'addr: $ref: ';
            const items = getCompletions(line, line.length, [line], 0, schema);
            expect(items).toHaveLength(0);
        });
    });

    describe('dot completions', () => {
        it('suggests required and nullable after type dot', () => {
            const line = 'name: string.';
            const items = getCompletions(line, line.length, [line], 0, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('required');
            expect(labels).toContain('nullable');
            expect(items).toHaveLength(2);
        });

        it('suggests dot completions after already having one modifier', () => {
            const line = 'name: string.required.';
            const items = getCompletions(line, line.length, [line], 0, null);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('required');
            expect(labels).toContain('nullable');
        });
    });

    describe('no completions', () => {
        it('returns empty on comment line', () => {
            const line = '# this is a comment';
            const items = getCompletions(line, line.length, [line], 0, null);
            expect(items).toHaveLength(0);
        });

        it('returns empty on indented comment line', () => {
            const line = '  # indented comment';
            const items = getCompletions(line, line.length, [line], 0, null);
            expect(items).toHaveLength(0);
        });

        it('returns empty on empty line', () => {
            const line = '';
            const items = getCompletions(line, 0, [line], 0, null);
            expect(items).toHaveLength(0);
        });

        it('returns empty when no context matches', () => {
            const line = 'name: string: A description';
            const items = getCompletions(line, line.length, [line], 0, null);
            expect(items).toHaveLength(0);
        });
    });

    describe('type completions still work without schema', () => {
        it('returns type completions on field line even with null schema', () => {
            const line = 'age: ';
            const items = getCompletions(line, line.length, [line], 0, null);
            expect(items.length).toBeGreaterThan(0);
            const labels = items.map((i) => i.label);
            expect(labels).toContain('integer');
        });
    });
});
