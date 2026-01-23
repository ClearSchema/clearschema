import { parse } from '../../../src/parser/parser';
import { Schema, SchemaDefinition } from '../../../src/ast/types';

describe('Parser - $defs', () => {
    it('parses $defs section', () => {
        const input = `$defs:
  User: object: User schema
    name: string.required: Name`;

        const schema = parse(input);

        expect(schema.definitions).toHaveLength(1);
        expect(schema.definitions[0].name).toBe('User');
        expect(schema.definitions[0].field.type).toBe('object');
        expect(schema.definitions[0].field.description).toBe('User schema');
    });

    it('parses multiple definitions', () => {
        const input = `$defs:
  User: object: User
    name: string: Name
  Address: object: Address
    city: string: City`;

        const schema = parse(input);

        expect(schema.definitions).toHaveLength(2);
        expect(schema.definitions[0].name).toBe('User');
        expect(schema.definitions[1].name).toBe('Address');
    });

    it('parses definitions with nested fields', () => {
        const input = `$defs:
  User: object: User schema
    name: string.required: Full name
    email: string.required: Email
      ^ format: email
    age: integer: Age
      ^ min: 0`;

        const schema = parse(input);

        expect(schema.definitions).toHaveLength(1);
        const userDef = schema.definitions[0];
        expect(userDef.name).toBe('User');
        expect(userDef.field.type).toBe('object');

        if (userDef.field.type === 'object') {
            expect(userDef.field.fields).toHaveLength(3);
            expect(userDef.field.fields[0].name).toBe('name');
            expect(userDef.field.fields[0].required).toBe(true);
            expect(userDef.field.fields[1].name).toBe('email');
            expect(userDef.field.fields[2].name).toBe('age');
        }
    });

    it('parses schema with both $defs and fields', () => {
        const input = `$defs:
  User: object: User
    name: string: Name

primaryUser: object: Primary user
  name: string: Name`;

        const schema = parse(input);

        expect(schema.definitions).toHaveLength(1);
        expect(schema.fields).toHaveLength(1);
        expect(schema.definitions[0].name).toBe('User');
        expect(schema.fields[0].name).toBe('primaryUser');
    });
});
