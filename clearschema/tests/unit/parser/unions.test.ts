import { parseField } from '../../../src/parser/parser';
import { ParseError } from '../../../src/parser/errors';
import { UnionField } from '../../../src/ast/types';

describe('Parser - Union Types', () => {
    it('parses union type', () => {
        const input = `id: string|number: Flexible ID`;

        const field = parseField(input) as UnionField;

        expect(field.type).toBe('union');
        expect(field.types).toEqual(['string', 'number']);
        expect(field.description).toBe('Flexible ID');
    });

    it('parses union with required modifier', () => {
        const input = `id: string|number.required: Required ID`;

        const field = parseField(input) as UnionField;

        expect(field.type).toBe('union');
        expect(field.types).toEqual(['string', 'number']);
        expect(field.required).toBe(true);
    });

    it('parses union with nullable modifier', () => {
        const input = `id: string|number.nullable: Nullable ID`;

        const field = parseField(input) as UnionField;

        expect(field.type).toBe('union');
        expect(field.types).toEqual(['string', 'number']);
        expect(field.nullable).toBe(true);
    });

    it('parses union with both modifiers', () => {
        const input = `id: string|number.required.nullable: ID`;

        const field = parseField(input) as UnionField;

        expect(field.type).toBe('union');
        expect(field.required).toBe(true);
        expect(field.nullable).toBe(true);
    });

    it('parses union with multiple types', () => {
        const input = `value: string|number|boolean: Multi-type value`;

        const field = parseField(input) as UnionField;

        expect(field.type).toBe('union');
        expect(field.types).toEqual(['string', 'number', 'boolean']);
    });

    it('parses union with non-constraint modifiers', () => {
        const input = `id: string|number: Flexible ID
  ^ default: "unknown"`;

        const field = parseField(input) as UnionField;

        expect(field.type).toBe('union');
        expect(field.rawModifiers['default']).toBe('unknown');
    });

    it('rejects min on union type as ambiguous', () => {
        const input = `id: string|number: Flexible ID
  ^ min: 5`;

        expect(() => parseField(input)).toThrow(ParseError);
        try {
            parseField(input);
        } catch (e) {
            expect((e as ParseError).message).toContain('"min" is ambiguous on union types');
            expect((e as ParseError).hint).toContain('string.min');
        }
    });

    it('rejects max on union type as ambiguous', () => {
        const input = `id: string|number: Flexible ID
  ^ max: 100`;

        expect(() => parseField(input)).toThrow(ParseError);
    });

    it('rejects gt on union type as ambiguous', () => {
        const input = `id: string|number: Flexible ID
  ^ gt: 0`;

        expect(() => parseField(input)).toThrow(ParseError);
    });

    it('rejects lt on union type as ambiguous', () => {
        const input = `id: string|number: Flexible ID
  ^ lt: 100`;

        expect(() => parseField(input)).toThrow(ParseError);
    });
});
