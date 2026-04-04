import { parse, parseField } from '../../../src';
import { ArrayField, ObjectField } from '../../../src/ast/types';

describe('Parser - Array Fields', () => {
    describe('basic array parsing', () => {
        it('parses array with no item type (defaults to string)', () => {
            const field = parseField('tags: array: List of tags') as ArrayField;

            expect(field.type).toBe('array');
            expect(field.name).toBe('tags');
            expect(field.description).toBe('List of tags');
            expect(field.itemType).toBe('string'); // Default
        });

        it('parses required array field', () => {
            const field = parseField('tags: array.required: Tags') as ArrayField;

            expect(field.type).toBe('array');
            expect(field.required).toBe(true);
        });

        it('parses nullable array field', () => {
            const field = parseField('tags: array.nullable: Tags') as ArrayField;

            expect(field.type).toBe('array');
            expect(field.nullable).toBe(true);
        });
    });

    describe('array with item types', () => {
        it('parses array with string items', () => {
            const input = `tags: array: Tags
  - string`;

            const field = parseField(input) as ArrayField;

            expect(field.type).toBe('array');
            expect(field.itemType).toBe('string');
        });

        it('parses array with number items', () => {
            const input = `scores: array: Scores
  - number`;

            const field = parseField(input) as ArrayField;

            expect(field.itemType).toBe('number');
        });

        it('parses array with integer items', () => {
            const input = `counts: array: Counts
  - integer`;

            const field = parseField(input) as ArrayField;

            expect(field.itemType).toBe('integer');
        });

        it('parses array with boolean items', () => {
            const input = `flags: array: Flags
  - boolean`;

            const field = parseField(input) as ArrayField;

            expect(field.itemType).toBe('boolean');
        });
    });

    describe('array modifiers', () => {
        it('parses array with minItems', () => {
            const input = `tags: array: Tags
  - string
  ^ minItems: 1`;

            const field = parseField(input) as ArrayField;

            expect(field.minItems).toBe(1);
        });

        it('parses array with maxItems', () => {
            const input = `tags: array: Tags
  - string
  ^ maxItems: 10`;

            const field = parseField(input) as ArrayField;

            expect(field.maxItems).toBe(10);
        });

        it('parses array with uniqueItems', () => {
            const input = `tags: array: Tags
  - string
  ^ uniqueItems: true`;

            const field = parseField(input) as ArrayField;

            expect(field.uniqueItems).toBe(true);
        });

        it('parses array with all modifiers', () => {
            const input = `tags: array: Tags
  - string
  ^ minItems: 1
  ^ maxItems: 10
  ^ uniqueItems: true`;

            const field = parseField(input) as ArrayField;

            expect(field.minItems).toBe(1);
            expect(field.maxItems).toBe(10);
            expect(field.uniqueItems).toBe(true);
        });

        it('parses array with modifiers before item type', () => {
            const input = `tags: array: Tags
  ^ minItems: 1
  - string`;

            const field = parseField(input) as ArrayField;

            expect(field.minItems).toBe(1);
            expect(field.itemType).toBe('string');
        });
    });

    describe('array with inline object items', () => {
        it('parses array with inline object', () => {
            const input = `users: array: Users
  - object:
    name: string: Name
    email: string: Email`;

            const field = parseField(input) as ArrayField;

            expect(field.type).toBe('array');
            expect(typeof field.itemType).toBe('object');

            const itemType = field.itemType as ObjectField;
            expect(itemType.type).toBe('object');
            expect(itemType.fields).toHaveLength(2);
            expect(itemType.fields[0].name).toBe('name');
            expect(itemType.fields[1].name).toBe('email');
        });

        it('parses array with inline object and modifiers', () => {
            const input = `users: array: Users
  - object:
    name: string.required: Name
    email: string.required: Email
  ^ minItems: 1`;

            const field = parseField(input) as ArrayField;

            expect(field.minItems).toBe(1);
            const itemType = field.itemType as ObjectField;
            expect(itemType.fields).toHaveLength(2);
        });

        it('parses array with nested object in inline object', () => {
            const input = `users: array: Users
  - object:
    name: string: Name
    address: object: Address
      city: string: City`;

            const field = parseField(input) as ArrayField;

            const itemType = field.itemType as ObjectField;
            expect(itemType.fields).toHaveLength(2);

            const addressField = itemType.fields[1] as ObjectField;
            expect(addressField.type).toBe('object');
            expect(addressField.fields).toHaveLength(1);
            expect(addressField.fields[0].name).toBe('city');
        });
    });

    describe('array of arrays', () => {
        it('parses array containing array type', () => {
            const input = `matrix: array: Matrix
  - array`;

            const field = parseField(input) as ArrayField;

            expect(field.type).toBe('array');
            expect(field.itemType).toBe('array');
        });
    });

    describe('array in schema context', () => {
        it('parses schema with array field', () => {
            const input = `tags: array: Tags
  - string`;

            const schema = parse(input);

            expect(schema.fields).toHaveLength(1);
            const tagsField = schema.fields[0] as ArrayField;
            expect(tagsField.type).toBe('array');
            expect(tagsField.itemType).toBe('string');
        });

        it('parses schema with multiple array fields', () => {
            const input = `tags: array: Tags
  - string
categories: array: Categories
  - string`;

            const schema = parse(input);

            expect(schema.fields).toHaveLength(2);
            expect(schema.fields[0].name).toBe('tags');
            expect(schema.fields[1].name).toBe('categories');
        });
    });

    describe('array in object context', () => {
        it('parses object with array field', () => {
            const input = `user: object: User
  tags: array: User tags
    - string`;

            const field = parseField(input) as ObjectField;

            expect(field.fields).toHaveLength(1);
            const tagsField = field.fields[0] as ArrayField;
            expect(tagsField.type).toBe('array');
            expect(tagsField.itemType).toBe('string');
        });
    });
});
