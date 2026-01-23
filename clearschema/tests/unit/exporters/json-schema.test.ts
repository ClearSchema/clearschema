import { parse } from '../../../src/parser/parser';
import { exportJsonSchema } from '../../../src/exporters/json-schema';

describe('JSON Schema Exporter', () => {
    describe('primitive types', () => {
        it('exports string field', () => {
            const schema = parse('name: string: User name');
            const output = exportJsonSchema(schema);

            expect(output.properties?.name).toEqual({
                type: 'string',
                description: 'User name',
            });
        });

        it('exports string with modifiers', () => {
            const schema = parse(`email: string: Email
  ^ format: email
  ^ minLength: 5`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.email).toEqual({
                type: 'string',
                description: 'Email',
                format: 'email',
                minLength: 5,
            });
        });

        it('exports required fields', () => {
            const schema = parse('name: string.required: Name');
            const output = exportJsonSchema(schema);

            expect(output.required).toContain('name');
        });

        it('exports number with constraints', () => {
            const schema = parse(`age: number: Age
  ^ min: 0
  ^ max: 150`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.age).toEqual({
                type: 'number',
                description: 'Age',
                minimum: 0,
                maximum: 150,
            });
        });

        it('exports integer', () => {
            const schema = parse('count: integer: Count');
            const output = exportJsonSchema(schema);

            expect(output.properties?.count).toEqual({
                type: 'integer',
                description: 'Count',
            });
        });

        it('exports boolean', () => {
            const schema = parse('active: boolean: Active status');
            const output = exportJsonSchema(schema);

            expect(output.properties?.active).toEqual({
                type: 'boolean',
                description: 'Active status',
            });
        });

        it('exports null type', () => {
            const schema = parse('value: null: Null value');
            const output = exportJsonSchema(schema);

            expect(output.properties?.value).toEqual({
                type: 'null',
                description: 'Null value',
            });
        });
    });

    describe('universal modifiers', () => {
        it('exports default value', () => {
            const schema = parse(`name: string: Name
  ^ default: Anonymous`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.name?.default).toBe('Anonymous');
        });

        it('exports const value', () => {
            const schema = parse(`type: string: Type
  ^ const: user`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.type?.const).toBe('user');
        });

        it('exports enum values', () => {
            const schema = parse(`status: string: Status
  ^ enum: [active, inactive, pending]`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.status?.enum).toEqual(['active', 'inactive', 'pending']);
        });
    });

    describe('complex types', () => {
        it('exports nested object', () => {
            const schema = parse(`user: object: User
  name: string.required: Name`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.user).toEqual({
                type: 'object',
                description: 'User',
                properties: {
                    name: { type: 'string', description: 'Name' },
                },
                required: ['name'],
            });
        });

        it('exports array with items', () => {
            const schema = parse(`tags: array: Tags
  - string`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.tags).toEqual({
                type: 'array',
                description: 'Tags',
                items: { type: 'string' },
            });
        });

        it('exports array with modifiers', () => {
            const schema = parse(`tags: array: Tags
  - string
  ^ minItems: 1
  ^ maxItems: 10
  ^ uniqueItems: true`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.tags).toMatchObject({
                type: 'array',
                minItems: 1,
                maxItems: 10,
                uniqueItems: true,
            });
        });

        it('exports tuple array', () => {
            const schema = parse(`coordinates: array.tuple: Coordinates
  - number
  - number`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.coordinates).toEqual({
                type: 'array',
                description: 'Coordinates',
                prefixItems: [
                    { type: 'number' },
                    { type: 'number' },
                ],
                items: false,
            });
        });
    });

    describe('nullable fields', () => {
        it('exports nullable string', () => {
            const schema = parse('name: string.nullable: Name');
            const output = exportJsonSchema(schema);

            expect(output.properties?.name).toEqual({
                anyOf: [
                    { type: 'string', description: 'Name' },
                    { type: 'null' },
                ],
            });
        });

        it('exports nullable required field', () => {
            const schema = parse('name: string.required.nullable: Name');
            const output = exportJsonSchema(schema);

            expect(output.required).toContain('name');
            expect(output.properties?.name?.anyOf).toBeDefined();
        });
    });

    describe('union types', () => {
        it('exports simple union', () => {
            const schema = parse('id: string|number: ID');
            const output = exportJsonSchema(schema);

            expect(output.properties?.id).toEqual({
                anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                ],
                description: 'ID',
            });
        });

        it('exports union with multiple types', () => {
            const schema = parse('value: string|number|boolean: Value');
            const output = exportJsonSchema(schema);

            expect(output.properties?.value?.anyOf).toHaveLength(3);
        });
    });

    describe('references', () => {
        it('exports $defs and $ref', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name

user: $ref: #/$defs/User`);
            const output = exportJsonSchema(schema);

            expect(output.$defs?.User).toBeDefined();
            expect(output.$defs?.User?.type).toBe('object');
            expect(output.properties?.user).toEqual({
                $ref: '#/$defs/User',
            });
        });

        it('exports multiple definitions', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name
  Address: object: Address
    city: string: City`);
            const output = exportJsonSchema(schema);

            expect(output.$defs?.User).toBeDefined();
            expect(output.$defs?.Address).toBeDefined();
        });
    });

    describe('composition types', () => {
        it('exports allOf', () => {
            const schema = parse(`admin: allOf: Admin
  - $ref: #/$defs/User
  - object:
      role: string: Role`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.admin?.allOf).toBeDefined();
            expect(output.properties?.admin?.allOf).toHaveLength(2);
        });

        it('exports anyOf', () => {
            const schema = parse(`value: anyOf: Value
  - string
  - number`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.value?.anyOf).toBeDefined();
            expect(output.properties?.value?.anyOf).toHaveLength(2);
        });

        it('exports oneOf', () => {
            const schema = parse(`payment: oneOf: Payment
  - $ref: #/$defs/Card
  - $ref: #/$defs/Cash`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.payment?.oneOf).toBeDefined();
            expect(output.properties?.payment?.oneOf).toHaveLength(2);
        });
    });

    describe('schema metadata', () => {
        it('includes $schema by default', () => {
            const schema = parse('name: string: Name');
            const output = exportJsonSchema(schema);

            expect(output.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        });

        it('uses specified schema version', () => {
            const schema = parse('name: string: Name');
            const output = exportJsonSchema(schema, { schemaVersion: 'draft-07' });

            expect(output.$schema).toBe('http://json-schema.org/draft-07/schema#');
        });

        it('includes root $id when provided', () => {
            const schema = parse('name: string: Name');
            const output = exportJsonSchema(schema, { rootId: 'https://example.com/schema' });

            expect(output.$id).toBe('https://example.com/schema');
        });

        it('excludes descriptions when option is false', () => {
            const schema = parse('name: string: User name');
            const output = exportJsonSchema(schema, { includeDescriptions: false });

            expect(output.properties?.name?.description).toBeUndefined();
        });

        it('excludes defaults when option is false', () => {
            const schema = parse(`name: string: Name
  ^ default: Anonymous`);
            const output = exportJsonSchema(schema, { includeDefaults: false });

            expect(output.properties?.name?.default).toBeUndefined();
        });
    });

    describe('complete schemas', () => {
        it('exports complex user schema', () => {
            const schema = parse(`$defs:
  Address: object: Address
    street: string.required: Street
    city: string.required: City
    zipCode: string: Zip code
      ^ pattern: ^\\d{5}$

user: object.required: User
  name: string.required: Full name
    ^ minLength: 2
  email: string.required: Email
    ^ format: email
  age: integer: Age
    ^ min: 0
    ^ max: 150
  address: $ref: #/$defs/Address
  tags: array: Tags
    - string
    ^ minItems: 0
    ^ maxItems: 10`);

            const output = exportJsonSchema(schema);

            expect(output.$defs?.Address).toBeDefined();
            expect(output.properties?.user?.type).toBe('object');
            expect(output.required).toContain('user');
        });
    });
});
