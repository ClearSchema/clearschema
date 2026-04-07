import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

const SERVER_PATH = path.resolve(__dirname, '../../dist/index.js');

const VALID_SCHEMA = `$defs:
  User: object: A user
    name: string.required: Name
    age: integer: Age
`;

const VALID_JSON_SCHEMA = JSON.stringify({
    type: 'object',
    properties: {
        name: { type: 'string', description: 'Name' },
        age: { type: 'integer', description: 'Age' },
    },
    required: ['name'],
});

describe('MCP Server Integration', () => {
    let client: Client;
    let transport: StdioClientTransport;

    beforeAll(async () => {
        transport = new StdioClientTransport({
            command: 'node',
            args: [SERVER_PATH],
        });
        client = new Client({ name: 'test-client', version: '1.0.0' });
        await client.connect(transport);
    }, 15000);

    afterAll(async () => {
        await client.close();
    });

    it('list_exporters returns 7 formats', async () => {
        const result = await client.callTool({ name: 'list_exporters', arguments: {} });
        const text = (result.content as any)[0].text;
        expect(text).toContain('json-schema');
        expect(text).toContain('typescript');
        expect(text).toContain('pydantic');
        expect(text).toContain('openapi');
        expect(text).toContain('zod');
        expect(text).toContain('llm-schema');
        expect(text).toContain('clearschema');
    });

    it('compile_schema produces valid JSON Schema output', async () => {
        const result = await client.callTool({
            name: 'compile_schema',
            arguments: { source: VALID_SCHEMA, target: 'json-schema' },
        });
        expect(result.isError).toBeFalsy();
        const text = (result.content as any)[0].text;
        expect(() => JSON.parse(text)).not.toThrow();
        const parsed = JSON.parse(text);
        expect(parsed).toHaveProperty('$defs');
    });

    it('validate_schema returns valid for correct schema', async () => {
        const result = await client.callTool({
            name: 'validate_schema',
            arguments: { source: VALID_SCHEMA },
        });
        expect(result.isError).toBeFalsy();
        const text = (result.content as any)[0].text;
        expect(text).toContain('Valid');
    });

    it('validate_schema returns error for invalid schema', async () => {
        const result = await client.callTool({
            name: 'validate_schema',
            arguments: { source: 'this is not valid!!!' },
        });
        expect(result.isError).toBe(true);
        const text = (result.content as any)[0].text;
        expect(text.length).toBeGreaterThan(0);
    });

    it('import_json_schema returns .clear syntax', async () => {
        const result = await client.callTool({
            name: 'import_json_schema',
            arguments: { jsonSchema: VALID_JSON_SCHEMA },
        });
        expect(result.isError).toBeFalsy();
        const text = (result.content as any)[0].text;
        expect(text).toContain('name');
        expect(text).toContain('string');
    });

    it('inspect_schema returns type definitions', async () => {
        const result = await client.callTool({
            name: 'inspect_schema',
            arguments: { source: VALID_SCHEMA },
        });
        expect(result.isError).toBeFalsy();
        const text = (result.content as any)[0].text;
        const parsed = JSON.parse(text);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
        expect(parsed[0].name).toBe('User');
    });
});
