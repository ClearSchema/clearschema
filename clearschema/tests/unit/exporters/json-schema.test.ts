import { parse } from '../../../src/parser/parser';
import { exportJsonSchema } from '../../../src/exporters/json-schema';
import { Schema, MapField, RefField, MatchField, ObjectField } from '../../../src/ast/types';

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
  ^ min: 5`);
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
  ^ min: 1
  ^ max: 10
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

    describe('map types', () => {
        it('exports map with string values', () => {
            const schema = parse(`metadata: map: Metadata
  - string`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.metadata).toEqual({
                type: 'object',
                description: 'Metadata',
                additionalProperties: { type: 'string' },
            });
        });

        it('exports map with object values', () => {
            const schema = parse(`users: map: Users by ID
  - object:
      name: string.required: Name
      email: string: Email`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.users).toEqual({
                type: 'object',
                description: 'Users by ID',
                additionalProperties: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Name' },
                        email: { type: 'string', description: 'Email' },
                    },
                    required: ['name'],
                },
            });
        });

        it('exports map with $ref values', () => {
            // Construct AST directly since parser doesn't yet produce RefField for map items
            const loc = { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } };
            const refField: RefField = {
                name: '',
                type: 'ref',
                ref: '#/$defs/User',
                description: '',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            };
            const mapField: MapField = {
                name: 'users',
                type: 'map',
                valueType: refField,
                description: 'Users',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            };
            const schema: Schema = {
                fields: [mapField],
                definitions: [],
                imports: [],
                location: loc,
            };
            const output = exportJsonSchema(schema);

            expect(output.properties?.users).toEqual({
                type: 'object',
                description: 'Users',
                additionalProperties: { $ref: '#/$defs/User' },
            });
        });

        it('exports nullable map', () => {
            const schema = parse(`metadata: map.nullable: Metadata
  - string`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.metadata).toEqual({
                anyOf: [
                    {
                        type: 'object',
                        description: 'Metadata',
                        additionalProperties: { type: 'string' },
                    },
                    { type: 'null' },
                ],
            });
        });

        it('exports map with description', () => {
            const schema = parse(`headers: map: HTTP headers
  - string`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.headers?.description).toBe('HTTP headers');
        });

        it('exports map with default modifier', () => {
            const schema = parse(`metadata: map: Metadata
  - string
  ^ default: empty`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.metadata?.default).toBe('empty');
        });

        it('exports map of maps (nested additionalProperties)', () => {
            const schema = parse(`matrix: map: Matrix
  - map:
      - number`);
            const output = exportJsonSchema(schema);

            expect(output.properties?.matrix).toEqual({
                type: 'object',
                description: 'Matrix',
                additionalProperties: {
                    type: 'object',
                    additionalProperties: { type: 'number' },
                },
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

    describe('match (discriminated union)', () => {
        const loc = { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } };

        function makeObjectVariant(fields: { name: string; type: string; required: boolean; description: string }[]): ObjectField {
            return {
                name: '',
                type: 'object',
                fields: fields.map(f => ({
                    name: f.name,
                    type: f.type as any,
                    description: f.description,
                    required: f.required,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                })),
                description: '',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            };
        }

        function makeMatchField(discriminator: string, variants: Record<string, ObjectField | RefField>, description = ''): MatchField {
            return {
                name: 'event',
                type: 'match',
                discriminator,
                variants,
                description,
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            };
        }

        function makeSchema(field: MatchField): Schema {
            return {
                fields: [field],
                definitions: [],
                imports: [],
                location: loc,
            };
        }

        it('exports 2 inline variants as oneOf with discriminator const in each', () => {
            const matchField = makeMatchField('kind', {
                created: makeObjectVariant([
                    { name: 'createdAt', type: 'string', required: false, description: 'Timestamp' },
                ]),
                deleted: makeObjectVariant([
                    { name: 'deletedAt', type: 'string', required: false, description: 'Timestamp' },
                ]),
            });

            const output = exportJsonSchema(makeSchema(matchField));
            const result = output.properties?.event;

            expect(result?.oneOf).toHaveLength(2);
            expect(result?.oneOf?.[0]).toEqual({
                type: 'object',
                properties: {
                    createdAt: { type: 'string', description: 'Timestamp' },
                    kind: { const: 'created' },
                },
                required: ['kind'],
            });
            expect(result?.oneOf?.[1]).toEqual({
                type: 'object',
                properties: {
                    deletedAt: { type: 'string', description: 'Timestamp' },
                    kind: { const: 'deleted' },
                },
                required: ['kind'],
            });
        });

        it('exports $ref variant as bare $ref pointer in oneOf', () => {
            const refVariant: RefField = {
                name: '',
                type: 'ref',
                ref: '#/$defs/ExternalEvent',
                description: '',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            };

            const matchField = makeMatchField('type', {
                inline: makeObjectVariant([
                    { name: 'data', type: 'string', required: false, description: 'Data' },
                ]),
                external: refVariant,
            });

            const output = exportJsonSchema(makeSchema(matchField));
            const result = output.properties?.event;

            expect(result?.oneOf).toHaveLength(2);
            expect(result?.oneOf?.[0]?.properties?.type).toEqual({ const: 'inline' });
            expect(result?.oneOf?.[1]).toEqual({ $ref: '#/$defs/ExternalEvent' });
        });

        it('includes discriminator in required array alongside existing required fields', () => {
            const matchField = makeMatchField('kind', {
                created: makeObjectVariant([
                    { name: 'createdAt', type: 'string', required: true, description: 'Timestamp' },
                ]),
            });

            const output = exportJsonSchema(makeSchema(matchField));
            const variant = output.properties?.event?.oneOf?.[0];

            expect(variant?.required).toContain('createdAt');
            expect(variant?.required).toContain('kind');
        });

        it('exports variant with no additional fields as valid minimal object', () => {
            const matchField = makeMatchField('status', {
                empty: makeObjectVariant([]),
            });

            const output = exportJsonSchema(makeSchema(matchField));
            const variant = output.properties?.event?.oneOf?.[0];

            expect(variant).toEqual({
                type: 'object',
                properties: {
                    status: { const: 'empty' },
                },
                required: ['status'],
            });
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
    ^ min: 2
  email: string.required: Email
    ^ format: email
  age: integer: Age
    ^ min: 0
    ^ max: 150
  address: $ref: #/$defs/Address
  tags: array: Tags
    - string
    ^ min: 0
    ^ max: 10`);

            const output = exportJsonSchema(schema);

            expect(output.$defs?.Address).toBeDefined();
            expect(output.properties?.user?.type).toBe('object');
            expect(output.required).toContain('user');
        });
    });
});
