#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
    parse,
    ParseError,
    exportJsonSchema,
    exportTypeScript,
    exportPydantic,
    exportOpenAPI,
    exportLlmSchema,
    exportZod,
    exportClearSchema,
    importJsonSchema,
} from '@clearschema/core';
import type { Schema } from '@clearschema/core';
import { inspectSchema } from './inspect';

// --- Exporter dispatch map ---

interface ExporterEntry {
    fn: (schema: Schema) => { output: string; warnings?: string[] };
    description: string;
}

export const EXPORTER_MAP: Record<string, ExporterEntry> = {
    'json-schema': {
        fn: (schema) => ({ output: JSON.stringify(exportJsonSchema(schema), null, 2) }),
        description: 'JSON Schema Draft 2020-12',
    },
    'typescript': {
        fn: (schema) => ({ output: exportTypeScript(schema) }),
        description: 'TypeScript interfaces and types',
    },
    'pydantic': {
        fn: (schema) => ({ output: exportPydantic(schema) }),
        description: 'Python Pydantic v2 models',
    },
    'openapi': {
        fn: (schema) => ({
            output: JSON.stringify(exportOpenAPI(schema, { title: 'Generated API', version: '1.0.0' }), null, 2),
        }),
        description: 'OpenAPI 3.1 schema components',
    },
    'zod': {
        fn: (schema) => ({ output: exportZod(schema) }),
        description: 'Zod validation schemas',
    },
    'llm-schema': {
        fn: (schema) => {
            const result = exportLlmSchema(schema);
            return {
                output: JSON.stringify(result.schema, null, 2),
                warnings: result.warnings.length > 0 ? result.warnings : undefined,
            };
        },
        description: 'LLM structured output schema (OpenAI/Anthropic/Google compatible)',
    },
    'clearschema': {
        fn: (schema) => ({ output: exportClearSchema(schema) }),
        description: 'ClearSchema DSL syntax (round-trip serialization)',
    },
};

// --- Error formatting helpers ---

function formatParseErrors(errors: Error[]): string {
    return errors.map((err) => {
        if (err instanceof ParseError) {
            const loc = err.location;
            let msg = `Line ${loc.start.line}, Col ${loc.start.column}: ${err.message}`;
            if (err.hint) {
                msg += ` (hint: ${err.hint})`;
            }
            return msg;
        }
        return err.message;
    }).join('\n');
}

function formatCatastrophicError(err: unknown): string {
    if (err instanceof ParseError) {
        const loc = err.location;
        let msg = `Parse error at line ${loc.start.line}, column ${loc.start.column}: ${err.message}`;
        if (err.hint) {
            msg += ` (hint: ${err.hint})`;
        }
        return msg;
    }
    return `Parse error: ${err instanceof Error ? err.message : String(err)}`;
}

// --- Parse helper with dual error handling ---

interface ParseResult {
    schema: Schema | null;
    error: string | null;
}

function safeParse(source: string): ParseResult {
    try {
        const schema = parse(source);
        if (schema.errors && schema.errors.length > 0) {
            return { schema: null, error: formatParseErrors(schema.errors) };
        }
        return { schema, error: null };
    } catch (err) {
        return { schema: null, error: formatCatastrophicError(err) };
    }
}

// --- Server setup ---

const server = new McpServer(
    { name: 'clearschema', version: '0.1.0' },
    {
        instructions: 'ClearSchema MCP server. Use list_exporters to discover available output formats. ' +
            'Use compile_schema to compile ClearSchema source into any target format. ' +
            'Use validate_schema to check syntax without producing output. ' +
            'Use import_json_schema to convert existing JSON Schema into ClearSchema syntax. ' +
            'Use inspect_schema to introspect a schema\'s type definitions without compiling.',
    },
);

// --- Tools ---

server.tool(
    'list_exporters',
    'List all available ClearSchema export formats and their descriptions. ' +
        'Call this before compile_schema to discover valid target format names.',
    { readOnlyHint: true, idempotentHint: true },
    async () => {
        const lines = Object.entries(EXPORTER_MAP).map(
            ([name, entry]) => `- ${name}: ${entry.description}`,
        );
        return {
            content: [{ type: 'text', text: `Available export formats:\n${lines.join('\n')}` }],
        };
    },
);

(server.tool as any)(
    'compile_schema',
    'Compile ClearSchema source code into a target format. ' +
        'Use list_exporters to discover valid target format names.',
    {
        source: z.string().describe('ClearSchema source code to compile'),
        target: z.string().describe('Target format name (use list_exporters to see options)'),
    },
    async ({ source, target }: { source: string; target: string }) => {
        // Validate target format
        const exporter = EXPORTER_MAP[target];
        if (!exporter) {
            const validFormats = Object.keys(EXPORTER_MAP).join(', ');
            return {
                content: [{
                    type: 'text',
                    text: `Unknown format "${target}". Valid formats: ${validFormats}. Use list_exporters to see descriptions.`,
                }],
                isError: true,
            };
        }

        // Parse
        const { schema, error } = safeParse(source);
        if (!schema) {
            return {
                content: [{ type: 'text', text: error! }],
                isError: true,
            };
        }

        // Export (wrap in try-catch for exporters that can throw, e.g. LLM on recursive schemas)
        try {
            const result = exporter.fn(schema);
            let text = result.output;
            if (result.warnings && result.warnings.length > 0) {
                text += '\n\n--- Warnings ---\n' + result.warnings.map((w) => `- ${w}`).join('\n');
            }
            return { content: [{ type: 'text', text }] };
        } catch (err) {
            return {
                content: [{
                    type: 'text',
                    text: `Export error: ${err instanceof Error ? err.message : String(err)}`,
                }],
                isError: true,
            };
        }
    },
);

(server.tool as any)(
    'validate_schema',
    'Check ClearSchema source for syntax errors without producing output. ' +
        'Returns diagnostics with line numbers if errors are found.',
    {
        source: z.string().describe('ClearSchema source code to validate'),
    },
    async ({ source }: { source: string }) => {
        const { schema, error } = safeParse(source);
        if (!schema) {
            return {
                content: [{ type: 'text', text: error! }],
                isError: true,
            };
        }
        return {
            content: [{ type: 'text', text: 'Valid. No errors found.' }],
        };
    },
);

(server.tool as any)(
    'import_json_schema',
    'Convert a JSON Schema document into ClearSchema syntax. ' +
        'Accepts a JSON Schema as a JSON string and returns the equivalent .clear source code.',
    {
        jsonSchema: z.string().describe('JSON Schema document as a JSON string'),
    },
    async ({ jsonSchema }: { jsonSchema: string }) => {
        // Parse JSON
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonSchema);
        } catch {
            return {
                content: [{ type: 'text', text: 'Invalid JSON: could not parse the input as JSON.' }],
                isError: true,
            };
        }

        // Import
        const result = importJsonSchema(parsed);
        const clearSource = exportClearSchema(result.schema);

        // Check for empty result (valid JSON but not a meaningful JSON Schema)
        const hasContent = (result.schema.definitions && result.schema.definitions.length > 0) ||
            (result.schema.fields && result.schema.fields.length > 0);

        let text = clearSource;
        if (result.warnings.length > 0) {
            text += '\n\n--- Import Warnings ---\n' + result.warnings.map((w) => `- ${w}`).join('\n');
        }
        if (!hasContent && result.warnings.length === 0) {
            text += '\n\n--- Note ---\nThe input did not produce any type definitions or fields. ' +
                'Ensure the input is a valid JSON Schema with "type", "properties", or "$defs".';
        }

        return { content: [{ type: 'text', text }] };
    },
);

(server.tool as any)(
    'inspect_schema',
    'Parse ClearSchema source and return a structured summary of defined types, ' +
        'their fields, references, and composition structure. Schema introspection without compilation.',
    {
        source: z.string().describe('ClearSchema source code to inspect'),
    },
    async ({ source }: { source: string }) => {
        const { schema, error } = safeParse(source);
        if (!schema) {
            return {
                content: [{ type: 'text', text: error! }],
                isError: true,
            };
        }

        const summary = inspectSchema(schema);
        return {
            content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
    },
);

// --- Start server (only when run directly, not when imported for testing) ---

if (require.main === module) {
    async function main() {
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }

    main().catch((err) => {
        console.error('Failed to start ClearSchema MCP server:', err);
        process.exit(1);
    });
}
