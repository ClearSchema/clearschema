import { parse, parseField } from '../../../src';
import { ArrayField, MapField, ObjectField } from '../../../src/ast/types';

describe('Parser - Map Fields', () => {
    describe('basic map parsing', () => {
        it('parses map with string value type', () => {
            const input = `metadata: map: Tags
  - string`;

            const field = parseField(input) as MapField;

            expect(field.type).toBe('map');
            expect(field.name).toBe('metadata');
            expect(field.description).toBe('Tags');
            expect(field.valueType).toBe('string');
        });

        it('parses map with object value type', () => {
            const input = `configs: map: Configs
  - object:
    host: string: Hostname
    port: integer: Port number`;

            const field = parseField(input) as MapField;

            expect(field.type).toBe('map');
            const valueType = field.valueType as ObjectField;
            expect(valueType.type).toBe('object');
            expect(valueType.fields).toHaveLength(2);
            expect(valueType.fields[0].name).toBe('host');
            expect(valueType.fields[1].name).toBe('port');
        });

        it('parses map with $ref value type', () => {
            const input = `users: map: Users by ID
  - $ref: User`;

            const field = parseField(input) as MapField;

            expect(field.type).toBe('map');
            expect(field.valueType).toBe('$ref');
        });
    });

    describe('map modifiers', () => {
        it('parses map with required modifier', () => {
            const input = `metadata: map.required: Tags
  - string`;

            const field = parseField(input) as MapField;

            expect(field.type).toBe('map');
            expect(field.required).toBe(true);
            expect(field.valueType).toBe('string');
        });

        it('parses map with nullable modifier', () => {
            const input = `metadata: map.nullable: Tags
  - string`;

            const field = parseField(input) as MapField;

            expect(field.type).toBe('map');
            expect(field.nullable).toBe(true);
            expect(field.valueType).toBe('string');
        });

        it('parses map with default modifier', () => {
            const input = `metadata: map: Tags
  - string
  ^ default: null`;

            const field = parseField(input) as MapField;

            expect(field.type).toBe('map');
            expect(field.default).toBeNull();
        });
    });

    describe('map in schema context', () => {
        it('parses map inside a schema with other fields', () => {
            const input = `name: string: Name
metadata: map: Tags
  - string
age: integer: Age`;

            const schema = parse(input);

            expect(schema.fields).toHaveLength(3);
            expect(schema.fields[0].name).toBe('name');
            expect(schema.fields[0].type).toBe('string');

            const mapField = schema.fields[1] as MapField;
            expect(mapField.type).toBe('map');
            expect(mapField.valueType).toBe('string');

            expect(schema.fields[2].name).toBe('age');
            expect(schema.fields[2].type).toBe('integer');
        });

        it('parses map inside $defs', () => {
            const input = `$defs:
  headers: map: HTTP headers
    - string`;

            const schema = parse(input);

            expect(schema.definitions).toHaveLength(1);
            expect(schema.definitions[0].name).toBe('headers');

            const defField = schema.definitions[0].field as MapField;
            expect(defField.type).toBe('map');
            expect(defField.valueType).toBe('string');
        });
    });

    describe('map error cases', () => {
        it('throws ParseError when map has no child items', () => {
            const input = `metadata: map: Tags`;

            const schema = parse(input);

            // The parser collects errors
            expect(schema.errors).toBeDefined();
            expect(schema.errors!.length).toBeGreaterThan(0);
            expect(schema.errors![0].message).toContain(
                'map type requires exactly one child item defining the value type'
            );
        });

        it('throws ParseError when map has multiple child items', () => {
            const input = `metadata: map: Tags
  - string
  - number`;

            const schema = parse(input);

            expect(schema.errors).toBeDefined();
            expect(schema.errors!.length).toBeGreaterThan(0);
            expect(schema.errors![0].message).toContain(
                'map type accepts exactly one child item defining the value type, but 2 were provided'
            );
        });
    });

    describe('map as array item', () => {
        it('parses map as array item', () => {
            const input = `items: array: List of maps
  - map:
    - string`;

            const field = parseField(input) as ArrayField;

            expect(field.type).toBe('array');
            const itemType = field.itemType as MapField;
            expect(itemType.type).toBe('map');
            expect(itemType.valueType).toBe('string');
        });
    });

    describe('nested maps', () => {
        it('parses map with map value type (nested maps)', () => {
            const input = `nested: map: Nested map
  - map:
    - string`;

            const field = parseField(input) as MapField;

            expect(field.type).toBe('map');
            const innerMap = field.valueType as MapField;
            expect(innerMap.type).toBe('map');
            expect(innerMap.valueType).toBe('string');
        });
    });
});
