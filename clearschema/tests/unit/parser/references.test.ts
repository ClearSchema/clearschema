import { parse, parseField } from '../../../src/parser/parser';
import { RefField } from '../../../src/ast/types';

describe('Parser - $ref', () => {
    it('parses $ref field', () => {
        const input = `user: $ref: #/$defs/User`;

        const field = parseField(input) as RefField;

        expect(field.type).toBe('ref');
        expect(field.name).toBe('user');
        expect(field.ref).toBe('#/$defs/User');
    });

    it('parses short-form $ref', () => {
        const input = `user: $ref: User`;

        const field = parseField(input) as RefField;

        expect(field.type).toBe('ref');
        expect(field.ref).toBe('User');
    });

    it('parses schema with definitions and references', () => {
        const input = `$defs:
  User: object: User schema
    name: string.required: Name

primaryUser: $ref: #/$defs/User`;

        const schema = parse(input);

        expect(schema.definitions).toHaveLength(1);
        expect(schema.fields).toHaveLength(1);

        const userRef = schema.fields[0] as RefField;
        expect(userRef.type).toBe('ref');
        expect(userRef.ref).toBe('#/$defs/User');
    });

    it('parses array of references', () => {
        const input = `contacts: array: Contact list
  - $ref`;

        const field = parseField(input);

        expect(field.type).toBe('array');
        if (field.type === 'array') {
            expect(typeof field.itemType).toBe('string');
            expect(field.itemType).toBe('$ref');
        }
    });
});
