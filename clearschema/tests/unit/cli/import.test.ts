import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { importJsonSchema } from '../../../src/importers/json-schema';
import { exportClearSchema } from '../../../src/exporters/clearschema';
import { exportTypeScript } from '../../../src/exporters/typescript';
import { exportJsonSchema } from '../../../src/exporters/json-schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clearschema-cli-import-'));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmpJson(name: string, data: any): string {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
}

/** A simple JSON Schema for testing. */
function simpleJsonSchema(): any {
    return {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'The user name' },
            age: { type: 'integer', description: 'The user age' },
        },
        required: ['name'],
    };
}

// ---------------------------------------------------------------------------
// We test handleImport by exercising the pipeline directly (import + export),
// since handleImport calls process.exit and console.log/error which are
// hard to test in-process. We also test the handleImport function with mocks.
// ---------------------------------------------------------------------------

describe('CLI import subcommand — pipeline tests', () => {
    test('import JSON Schema file produces .clear output', () => {
        const jsonSchema = simpleJsonSchema();
        const { schema } = importJsonSchema(jsonSchema);
        const clearOutput = exportClearSchema(schema);

        expect(clearOutput).toContain('name:');
        expect(clearOutput).toContain('string');
        expect(clearOutput).toContain('age:');
        expect(clearOutput).toContain('integer');
    });

    test('import JSON Schema re-exports as TypeScript', () => {
        const jsonSchema = simpleJsonSchema();
        const { schema } = importJsonSchema(jsonSchema);
        const tsOutput = exportTypeScript(schema);

        expect(tsOutput).toContain('name');
        expect(tsOutput).toContain('string');
        expect(tsOutput).toContain('age');
        expect(tsOutput).toContain('number');
    });

    test('import JSON Schema re-exports as JSON Schema', () => {
        const jsonSchema = simpleJsonSchema();
        const { schema } = importJsonSchema(jsonSchema);
        const reExported = exportJsonSchema(schema);

        expect(reExported).toHaveProperty('type', 'object');
        expect(reExported.properties).toHaveProperty('name');
        expect(reExported.properties).toHaveProperty('age');
    });

    test('warnings from importer are captured', () => {
        const jsonSchema = {
            type: 'object',
            properties: {
                data: {
                    type: 'object',
                    patternProperties: { '^S_': { type: 'string' } },
                },
            },
        };

        const { warnings } = importJsonSchema(jsonSchema);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings.some(w => w.includes('patternProperties'))).toBe(true);
    });
});

describe('CLI import subcommand — handleImport with mocks', () => {
    let mockExit: jest.SpyInstance;
    let mockLog: jest.SpyInstance;
    let mockError: jest.SpyInstance;

    beforeEach(() => {
        mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('process.exit called');
        }) as any);
        mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        mockExit.mockRestore();
        mockLog.mockRestore();
        mockError.mockRestore();
    });

    // We need to import handleImport after setting up mocks wouldn't help
    // since it's statically imported. Instead, require it each time.
    function getHandleImport(): (args: string[]) => void {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cli = require('../../../src/cli/index');
        return cli.handleImport;
    }

    test('happy path: import JSON Schema to stdout as .clear format', () => {
        const filePath = writeTmpJson('schema.json', simpleJsonSchema());
        const handleImport = getHandleImport();

        handleImport([filePath]);

        expect(mockLog).toHaveBeenCalled();
        const output = mockLog.mock.calls[0][0] as string;
        expect(output).toContain('name:');
        expect(output).toContain('string');
    });

    test('happy path: import with -o writes to output file', () => {
        const filePath = writeTmpJson('schema.json', simpleJsonSchema());
        const outputPath = path.join(tmpDir, 'output.clear');
        const handleImport = getHandleImport();

        handleImport([filePath, '-o', outputPath]);

        expect(fs.existsSync(outputPath)).toBe(true);
        const content = fs.readFileSync(outputPath, 'utf-8');
        expect(content).toContain('name:');
        expect(content).toContain('string');
    });

    test('happy path: import with -f typescript re-exports as TypeScript', () => {
        const filePath = writeTmpJson('schema.json', simpleJsonSchema());
        const handleImport = getHandleImport();

        handleImport([filePath, '-f', 'typescript']);

        expect(mockLog).toHaveBeenCalled();
        const output = mockLog.mock.calls[0][0] as string;
        expect(output).toContain('name');
        expect(output).toContain('string');
    });

    test('error: missing input file', () => {
        const handleImport = getHandleImport();

        expect(() => handleImport([])).toThrow('process.exit called');
        expect(mockError).toHaveBeenCalledWith(
            expect.stringContaining('No input file specified'),
        );
    });

    test('error: file not found', () => {
        const handleImport = getHandleImport();

        expect(() => handleImport(['/nonexistent/file.json'])).toThrow('process.exit called');
        expect(mockError).toHaveBeenCalledWith(
            expect.stringContaining('not found'),
        );
    });

    test('error: invalid JSON', () => {
        const badPath = path.join(tmpDir, 'bad.json');
        fs.writeFileSync(badPath, '{ not valid json }', 'utf-8');
        const handleImport = getHandleImport();

        expect(() => handleImport([badPath])).toThrow('process.exit called');
        expect(mockError).toHaveBeenCalledWith(
            expect.stringContaining('Invalid JSON'),
        );
    });

    test('warnings from importer printed to stderr', () => {
        const jsonSchema = {
            type: 'object',
            properties: {
                data: {
                    type: 'object',
                    patternProperties: { '^S_': { type: 'string' } },
                },
            },
        };
        const filePath = writeTmpJson('warnings.json', jsonSchema);
        const handleImport = getHandleImport();

        handleImport([filePath]);

        const errorCalls = mockError.mock.calls.map(c => c[0]);
        expect(errorCalls.some((msg: string) => msg.includes('Warning:'))).toBe(true);
        expect(errorCalls.some((msg: string) => msg.includes('patternProperties'))).toBe(true);
    });

    test('--help prints import help and exits', () => {
        const handleImport = getHandleImport();

        expect(() => handleImport(['--help'])).toThrow('process.exit called');
        expect(mockLog).toHaveBeenCalledWith(
            expect.stringContaining('import'),
        );
    });
});
