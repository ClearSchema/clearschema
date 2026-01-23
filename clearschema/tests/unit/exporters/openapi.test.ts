import { parse } from '../../../src/parser/parser';
import { exportOpenAPI } from '../../../src/exporters/openapi';

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
});
