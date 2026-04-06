import { parse } from '../../../src/parser/parser';
import { exportOpenAPI } from '../../../src/exporters/openapi';
import { Schema, MatchField, ObjectField, RefField } from '../../../src/ast/types';

describe('OpenAPI Exporter', () => {
    it('exports basic OpenAPI structure', () => {
        const schema = parse('name: string.required: Name');
        const output = exportOpenAPI(schema);

        expect(output.openapi).toBe('3.1.0');
        expect(output.info.title).toBe('Generated API');
        expect(output.info.version).toBe('1.0.0');
        expect(output.components.schemas).toBeDefined();
    });

    it('includes custom title and version', () => {
        const schema = parse('name: string: Name');
        const output = exportOpenAPI(schema, {
            title: 'My API',
            version: '2.0.0',
            description: 'API description',
        });

        expect(output.info.title).toBe('My API');
        expect(output.info.version).toBe('2.0.0');
        expect(output.info.description).toBe('API description');
    });

    it('includes server URL when provided', () => {
        const schema = parse('name: string: Name');
        const output = exportOpenAPI(schema, {
            serverUrl: 'https://api.example.com',
        });

        expect(output.servers).toBeDefined();
        expect(output.servers![0].url).toBe('https://api.example.com');
    });

    it('exports definitions to components/schemas', () => {
        const schema = parse(`$defs:
  User: object: User
    name: string.required: Name
    email: string.required: Email
      ^ format: email`);
        const output = exportOpenAPI(schema);

        expect(output.components.schemas.User).toBeDefined();
        expect(output.components.schemas.User.type).toBe('object');
        expect(output.components.schemas.User.properties.name).toBeDefined();
        expect(output.components.schemas.User.properties.email.format).toBe('email');
    });

    it('exports root schema', () => {
        const schema = parse(`user: object.required: User
  name: string: Name`);
        const output = exportOpenAPI(schema);

        expect(output.components.schemas.RootSchema).toBeDefined();
        expect(output.components.schemas.RootSchema.type).toBe('object');
    });

    it('exports with all features', () => {
        const schema = parse(`$defs:
  Address: object: Address
    street: string.required: Street
    city: string.required: City

  User: object: User
    name: string.required: Name
    email: string.required: Email
      ^ format: email
    address: $ref: #/$defs/Address

users: array.required: Users
  - $ref: #/$defs/User`);

        const output = exportOpenAPI(schema, {
            title: 'User API',
            version: '1.0.0',
            serverUrl: 'https://api.example.com',
        });

        expect(output.components.schemas.User).toBeDefined();
        expect(output.components.schemas.Address).toBeDefined();
        expect(output.servers).toBeDefined();
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
                required: true,
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
            } as any;
        }

        it('injects discriminator annotation alongside oneOf for match field', () => {
            const matchField = makeMatchField('type', {
                created: makeObjectVariant([
                    { name: 'createdAt', type: 'string', required: false, description: 'Timestamp' },
                ]),
                deleted: makeObjectVariant([
                    { name: 'deletedAt', type: 'string', required: false, description: 'Timestamp' },
                ]),
            });

            const output = exportOpenAPI(makeSchema(matchField));
            const rootSchema = output.components.schemas.RootSchema;

            expect(rootSchema).toBeDefined();
            expect(rootSchema.properties.event.oneOf).toHaveLength(2);
            expect(rootSchema.properties.event.discriminator).toEqual({
                propertyName: 'type',
            });
        });

        it('injects discriminator for match field with $ref variant', () => {
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

            const matchField = makeMatchField('kind', {
                inline: makeObjectVariant([
                    { name: 'data', type: 'string', required: true, description: 'Data' },
                ]),
                external: refVariant,
            });

            const output = exportOpenAPI(makeSchema(matchField));
            const rootSchema = output.components.schemas.RootSchema;

            expect(rootSchema.properties.event.oneOf).toHaveLength(2);
            expect(rootSchema.properties.event.discriminator).toEqual({
                propertyName: 'kind',
            });
        });
    });
});
