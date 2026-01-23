import { parseField } from '../../../src/parser/parser';
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

    it('parses union with modifiers', () => {
        const input = `id: string|number: Flexible ID
  ^ minLength: 3
  ^ min: 1000`;

        const field = parseField(input) as UnionField;

        expect(field.type).toBe('union');
        expect(field.rawModifiers['minLength']).toBe(3);
        expect(field.rawModifiers['min']).toBe(1000);
    });
});
