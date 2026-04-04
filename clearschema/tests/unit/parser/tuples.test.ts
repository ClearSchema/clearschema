import { parse, parseField } from '../../../src';
import { TupleArrayField } from '../../../src/ast/types';

describe('Parser - Tuple Array Fields', () => {
    describe('basic tuple parsing', () => {
        it('parses empty tuple array', () => {
            const field = parseField('point: array.tuple: Point coordinates') as TupleArrayField;

            expect(field.type).toBe('array.tuple');
            expect(field.name).toBe('point');
            expect(field.description).toBe('Point coordinates');
            expect(field.items).toEqual([]);
        });

        it('parses required tuple array', () => {
            const field = parseField('point: array.tuple.required: Point') as TupleArrayField;

            expect(field.type).toBe('array.tuple');
            expect(field.required).toBe(true);
        });

        it('parses nullable tuple array', () => {
            const field = parseField('point: array.tuple.nullable: Point') as TupleArrayField;

            expect(field.type).toBe('array.tuple');
            expect(field.nullable).toBe(true);
        });
    });

    describe('tuple with positional items', () => {
        it('parses tuple with two items', () => {
            const input = `point: array.tuple: 2D Point
  - number: x coordinate
  - number: y coordinate`;

            const field = parseField(input) as TupleArrayField;

            expect(field.type).toBe('array.tuple');
            expect(field.items).toHaveLength(2);
            expect(field.items[0].type).toBe('number');
            expect(field.items[0].description).toBe('x coordinate');
            expect(field.items[1].type).toBe('number');
            expect(field.items[1].description).toBe('y coordinate');
        });

        it('parses tuple with three items', () => {
            const input = `point: array.tuple: 3D Point
  - number: x
  - number: y
  - number: z`;

            const field = parseField(input) as TupleArrayField;

            expect(field.items).toHaveLength(3);
            expect(field.items[0].description).toBe('x');
            expect(field.items[1].description).toBe('y');
            expect(field.items[2].description).toBe('z');
        });

        it('parses tuple with mixed types', () => {
            const input = `record: array.tuple: Name and age
  - string: name
  - number: age
  - boolean: active`;

            const field = parseField(input) as TupleArrayField;

            expect(field.items).toHaveLength(3);
            expect(field.items[0].type).toBe('string');
            expect(field.items[1].type).toBe('number');
            expect(field.items[2].type).toBe('boolean');
        });

        it('parses tuple items without descriptions', () => {
            const input = `coord: array.tuple: Coordinates
  - number
  - number`;

            const field = parseField(input) as TupleArrayField;

            expect(field.items).toHaveLength(2);
            expect(field.items[0].type).toBe('number');
            expect(field.items[0].description).toBe('');
            expect(field.items[1].type).toBe('number');
        });
    });

    describe('tuple in schema context', () => {
        it('parses schema with tuple field', () => {
            const input = `location: array.tuple: GPS location
  - number: latitude
  - number: longitude`;

            const schema = parse(input);

            expect(schema.fields).toHaveLength(1);
            const locationField = schema.fields[0] as TupleArrayField;
            expect(locationField.type).toBe('array.tuple');
            expect(locationField.items).toHaveLength(2);
        });
    });

    describe('tuple in object context', () => {
        it('parses object with tuple field', () => {
            const input = `place: object: Place
  name: string: Name
  coordinates: array.tuple: GPS
    - number: lat
    - number: lon`;

            const field = parseField(input);

            expect(field.type).toBe('object');
            const objectField = field as any;
            expect(objectField.fields).toHaveLength(2);

            const coordField = objectField.fields[1] as TupleArrayField;
            expect(coordField.type).toBe('array.tuple');
            expect(coordField.items).toHaveLength(2);
        });
    });
});
