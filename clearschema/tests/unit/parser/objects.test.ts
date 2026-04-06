import { parse, parseField } from '../../../src';
import { ObjectField, StringField, NumberField } from '../../../src/ast/types';

describe('Parser - Object Fields', () => {
    describe('basic object parsing', () => {
        it('parses empty object field', () => {
            const field = parseField('user: object: User profile') as ObjectField;

            expect(field.type).toBe('object');
            expect(field.name).toBe('user');
            expect(field.description).toBe('User profile');
            expect(field.fields).toEqual([]);
        });

        it('parses required object field', () => {
            const field = parseField('user: object.required: User profile') as ObjectField;

            expect(field.type).toBe('object');
            expect(field.required).toBe(true);
            expect(field.fields).toEqual([]);
        });

        it('parses nullable object field', () => {
            const field = parseField('user: object.nullable: User profile') as ObjectField;

            expect(field.type).toBe('object');
            expect(field.nullable).toBe(true);
        });

        it('parses required nullable object field', () => {
            const field = parseField('user: object.required.nullable: User profile') as ObjectField;

            expect(field.type).toBe('object');
            expect(field.required).toBe(true);
            expect(field.nullable).toBe(true);
        });
    });

    describe('object with child fields', () => {
        it('parses object with single child field', () => {
            const input = `user: object: User
  name: string: Name`;

            const field = parseField(input) as ObjectField;

            expect(field.type).toBe('object');
            expect(field.fields).toHaveLength(1);
            expect(field.fields[0].name).toBe('name');
            expect(field.fields[0].type).toBe('string');
        });

        it('parses object with multiple child fields', () => {
            const input = `user: object: User
  name: string: Name
  age: number: Age
  active: boolean: Is active`;

            const field = parseField(input) as ObjectField;

            expect(field.type).toBe('object');
            expect(field.fields).toHaveLength(3);
            expect(field.fields[0].name).toBe('name');
            expect(field.fields[0].type).toBe('string');
            expect(field.fields[1].name).toBe('age');
            expect(field.fields[1].type).toBe('number');
            expect(field.fields[2].name).toBe('active');
            expect(field.fields[2].type).toBe('boolean');
        });

        it('parses object with required child fields', () => {
            const input = `user: object: User
  name: string.required: Name
  email: string.required: Email`;

            const field = parseField(input) as ObjectField;

            expect(field.fields).toHaveLength(2);
            expect(field.fields[0].required).toBe(true);
            expect(field.fields[1].required).toBe(true);
        });

        it('parses object with modifiers on child fields', () => {
            const input = `user: object: User
  name: string.required: Name
    ^ min: 2
    ^ max: 50
  age: number: Age
    ^ min: 0
    ^ max: 150`;

            const field = parseField(input) as ObjectField;

            expect(field.fields).toHaveLength(2);

            const nameField = field.fields[0] as StringField;
            expect(nameField.minLength).toBe(2);
            expect(nameField.maxLength).toBe(50);

            const ageField = field.fields[1] as NumberField;
            expect(ageField.min).toBe(0);
            expect(ageField.max).toBe(150);
        });
    });

    describe('nested objects', () => {
        it('parses two levels of nested objects', () => {
            const input = `company: object: Company
  address: object: Address
    street: string: Street
    city: string: City`;

            const field = parseField(input) as ObjectField;

            expect(field.type).toBe('object');
            expect(field.fields).toHaveLength(1);

            const addressField = field.fields[0] as ObjectField;
            expect(addressField.type).toBe('object');
            expect(addressField.name).toBe('address');
            expect(addressField.fields).toHaveLength(2);
            expect(addressField.fields[0].name).toBe('street');
            expect(addressField.fields[1].name).toBe('city');
        });

        it('parses three levels of nested objects', () => {
            const input = `company: object: Company
  headquarters: object: HQ
    location: object: Location
      city: string: City
      country: string: Country`;

            const field = parseField(input) as ObjectField;

            const hq = field.fields[0] as ObjectField;
            expect(hq.type).toBe('object');

            const location = hq.fields[0] as ObjectField;
            expect(location.type).toBe('object');
            expect(location.fields).toHaveLength(2);
            expect(location.fields[0].name).toBe('city');
            expect(location.fields[1].name).toBe('country');
        });

        it('parses deeply nested objects (4 levels)', () => {
            const input = `root: object: Root
  level1: object: L1
    level2: object: L2
      level3: object: L3
        value: string: Deep value`;

            const field = parseField(input) as ObjectField;
            const l1 = field.fields[0] as ObjectField;
            const l2 = l1.fields[0] as ObjectField;
            const l3 = l2.fields[0] as ObjectField;
            const value = l3.fields[0];

            expect(value.name).toBe('value');
            expect(value.type).toBe('string');
        });
    });

    describe('mixed content in objects', () => {
        it('parses object with both nested objects and primitives', () => {
            const input = `user: object: User
  name: string.required: Name
  address: object: Address
    street: string: Street
  active: boolean: Is active`;

            const field = parseField(input) as ObjectField;

            expect(field.fields).toHaveLength(3);
            expect(field.fields[0].type).toBe('string');
            expect(field.fields[1].type).toBe('object');
            expect(field.fields[2].type).toBe('boolean');
        });

        it('parses object with sibling nested objects', () => {
            const input = `user: object: User
  homeAddress: object: Home
    street: string: Street
  workAddress: object: Work
    street: string: Street`;

            const field = parseField(input) as ObjectField;

            expect(field.fields).toHaveLength(2);
            expect(field.fields[0].name).toBe('homeAddress');
            expect(field.fields[1].name).toBe('workAddress');

            const home = field.fields[0] as ObjectField;
            const work = field.fields[1] as ObjectField;
            expect(home.fields).toHaveLength(1);
            expect(work.fields).toHaveLength(1);
        });
    });

    describe('object in schema context', () => {
        it('parses schema with object field', () => {
            const input = `user: object.required: User profile
  name: string.required: Name`;

            const schema = parse(input);

            expect(schema.fields).toHaveLength(1);
            const userField = schema.fields[0] as ObjectField;
            expect(userField.type).toBe('object');
            expect(userField.fields).toHaveLength(1);
        });

        it('parses schema with multiple object fields', () => {
            const input = `user: object: User
  name: string: Name
settings: object: Settings
  theme: string: Theme`;

            const schema = parse(input);

            expect(schema.fields).toHaveLength(2);
            expect(schema.fields[0].name).toBe('user');
            expect(schema.fields[1].name).toBe('settings');
        });
    });
});
