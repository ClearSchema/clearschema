#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../package.json');

import * as fs from 'fs';
import { parse } from '../parser/parser';
import { exportJsonSchema } from '../exporters/json-schema';
import { exportTypeScript } from '../exporters/typescript';
import { exportPydantic } from '../exporters/pydantic';
import { exportOpenAPI } from '../exporters/openapi';
import { exportLlmSchema } from '../exporters/llm-structured-output';
import { exportZod } from '../exporters/zod';
import { importJsonSchema } from '../importers/json-schema';
import { exportClearSchema } from '../exporters/clearschema';

interface CliOptions {
    output?: string;
    format?: 'json-schema' | 'typescript' | 'pydantic' | 'openapi' | 'llm-schema' | 'zod';
    schemaVersion?: '2020-12' | '2019-09' | 'draft-07';
    help?: boolean;
    version?: boolean;
}

function printHelp(): void {
    console.log(`
ClearSchema CLI v${pkg.version}

Usage:
  clearschema <input-file> [options]
  clearschema import <json-schema-file> [options]

Subcommands:
  import    Import a JSON Schema file and convert to ClearSchema or re-export

Options:
  -o, --output <file>           Output file (default: stdout)
  -f, --format <format>         Export format: json-schema, typescript, pydantic, openapi, llm-schema, zod (default: json-schema)
  --schema-version <version>    JSON Schema version: 2020-12, 2019-09, draft-07 (default: 2020-12)
  -h, --help                    Show this help message
  -v, --version                 Show version number

Examples:
  clearschema schema.clear
  clearschema schema.clear -f typescript -o types.ts
  clearschema schema.clear -f json-schema -o schema.json
  clearschema schema.clear -f pydantic -o models.py
  clearschema schema.clear -f openapi -o openapi.json
  clearschema schema.clear -f llm-schema -o llm-output.json
  clearschema schema.clear -f zod -o validators.ts
  clearschema schema.clear --schema-version draft-07
`);
}

function printVersion(): void {
    console.log(pkg.version);
}

function parseArgs(args: string[]): { inputFile?: string; options: CliOptions } {
    const options: CliOptions = {};
    let inputFile: string | undefined;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (arg === '-v' || arg === '--version') {
            options.version = true;
        } else if (arg === '-o' || arg === '--output') {
            options.output = args[++i];
        } else if (arg === '-f' || arg === '--format') {
            const format = args[++i];
            if (format === 'json-schema' || format === 'typescript' || format === 'pydantic' || format === 'openapi' || format === 'llm-schema' || format === 'zod') {
                options.format = format;
            } else {
                console.error(`Error: Invalid format "${format}". Must be: json-schema, typescript, pydantic, openapi, llm-schema, zod`);
                process.exit(1);
            }
        } else if (arg === '--schema-version') {
            const version = args[++i];
            if (version === '2020-12' || version === '2019-09' || version === 'draft-07') {
                options.schemaVersion = version;
            } else {
                console.error(`Error: Invalid schema version "${version}". Must be: 2020-12, 2019-09, draft-07`);
                process.exit(1);
            }
        } else if (!arg.startsWith('-')) {
            inputFile = arg;
        } else {
            console.error(`Error: Unknown option "${arg}"`);
            printHelp();
            process.exit(1);
        }
    }

    return { inputFile, options };
}

type ImportFormat = 'clear' | 'json-schema' | 'typescript' | 'pydantic' | 'openapi' | 'llm-schema' | 'zod';

function printImportHelp(): void {
    console.log(`
ClearSchema CLI v${pkg.version} — import subcommand

Usage:
  clearschema import <json-schema-file> [options]

Description:
  Import a JSON Schema file and convert it to ClearSchema DSL or
  re-export it to any supported format.

Options:
  -o, --output <file>    Output file (default: stdout)
  -f, --format <format>  Output format: clear, json-schema, typescript,
                         pydantic, openapi, llm-schema, zod (default: clear)
  -h, --help             Show this help message

Examples:
  clearschema import schema.json
  clearschema import schema.json -o schema.clear
  clearschema import schema.json -f typescript -o types.ts
  clearschema import schema.json -f json-schema -o out.json
`);
}

function handleImport(args: string[]): void {
    let inputFile: string | undefined;
    let output: string | undefined;
    let format: ImportFormat = 'clear';
    let help = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-h' || arg === '--help') {
            help = true;
        } else if (arg === '-o' || arg === '--output') {
            if (i + 1 >= args.length) {
                console.error(`Error: "${arg}" requires a value`);
                process.exit(1);
            }
            output = args[++i];
        } else if (arg === '-f' || arg === '--format') {
            if (i + 1 >= args.length) {
                console.error(`Error: "${arg}" requires a value`);
                process.exit(1);
            }
            const fmt = args[++i];
            const validFormats: ImportFormat[] = ['clear', 'json-schema', 'typescript', 'pydantic', 'openapi', 'llm-schema', 'zod'];
            if (validFormats.includes(fmt as ImportFormat)) {
                format = fmt as ImportFormat;
            } else {
                console.error(`Error: Invalid format "${fmt}". Must be: ${validFormats.join(', ')}`);
                process.exit(1);
            }
        } else if (!arg.startsWith('-')) {
            inputFile = arg;
        } else {
            console.error(`Error: Unknown option "${arg}"`);
            printImportHelp();
            process.exit(1);
        }
    }

    if (help) {
        printImportHelp();
        process.exit(0);
    }

    if (!inputFile) {
        console.error('Error: No input file specified');
        printImportHelp();
        process.exit(1);
    }

    if (!fs.existsSync(inputFile)) {
        console.error(`Error: Input file "${inputFile}" not found`);
        process.exit(1);
    }

    let rawContent: string;
    try {
        rawContent = fs.readFileSync(inputFile, 'utf-8');
    } catch (err) {
        console.error(`Error: Could not read file "${inputFile}": ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    let jsonData: any;
    try {
        jsonData = JSON.parse(rawContent);
    } catch (err) {
        console.error(`Error: Invalid JSON in "${inputFile}": ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    const { schema, warnings } = importJsonSchema(jsonData);

    // Print warnings to stderr
    for (const warning of warnings) {
        console.error(`Warning: ${warning}`);
    }

    // Export based on format
    let result: string;

    if (format === 'clear') {
        result = exportClearSchema(schema);
    } else if (format === 'json-schema') {
        const jsonSchema = exportJsonSchema(schema);
        result = JSON.stringify(jsonSchema, null, 2);
    } else if (format === 'typescript') {
        result = exportTypeScript(schema);
    } else if (format === 'pydantic') {
        result = exportPydantic(schema);
    } else if (format === 'openapi') {
        const openapi = exportOpenAPI(schema, {
            title: 'Generated API',
            version: '1.0.0',
        });
        result = JSON.stringify(openapi, null, 2);
    } else if (format === 'zod') {
        result = exportZod(schema);
    } else if (format === 'llm-schema') {
        try {
            const llmResult = exportLlmSchema(schema);
            result = JSON.stringify(llmResult.schema, null, 2);
            if (llmResult.warnings.length > 0) {
                for (const w of llmResult.warnings) {
                    console.error(`Warning: ${w}`);
                }
            }
        } catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    } else {
        console.error(`Error: Unknown format "${format}"`);
        process.exit(1);
    }

    if (output) {
        fs.writeFileSync(output, result!, 'utf-8');
        console.log(`✓ Imported and exported to ${output}`);
    } else {
        console.log(result!);
    }
}

function main(): void {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printHelp();
        process.exit(0);
    }

    // Intercept 'import' subcommand before parseArgs
    if (args[0] === 'import') {
        handleImport(args.slice(1));
        return;
    }

    const { inputFile, options } = parseArgs(args);

    if (options.help) {
        printHelp();
        process.exit(0);
    }

    if (options.version) {
        printVersion();
        process.exit(0);
    }

    if (!inputFile) {
        console.error('Error: No input file specified');
        printHelp();
        process.exit(1);
    }

    // Check if input file exists
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: Input file "${inputFile}" not found`);
        process.exit(1);
    }

    // Read input file
    const input = fs.readFileSync(inputFile, 'utf-8');

    // Parse schema
    const schema = parse(input);

    // Check for parse errors
    if (schema.errors && schema.errors.length > 0) {
        console.error('Parse errors:');
        for (const error of schema.errors) {
            console.error(`  ${error.message}`);
        }
        process.exit(1);
    }

    // Export based on format
    const format = options.format || 'json-schema';
    let output: string;

    if (format === 'json-schema') {
        const jsonSchema = exportJsonSchema(schema, {
            schemaVersion: options.schemaVersion,
        });
        output = JSON.stringify(jsonSchema, null, 2);
    } else if (format === 'typescript') {
        output = exportTypeScript(schema);
    } else if (format === 'pydantic') {
        output = exportPydantic(schema);
    } else if (format === 'openapi') {
        const openapi = exportOpenAPI(schema, {
            title: 'Generated API',
            version: '1.0.0',
        });
        output = JSON.stringify(openapi, null, 2);
    } else if (format === 'zod') {
        output = exportZod(schema);
    } else if (format === 'llm-schema') {
        try {
            const result = exportLlmSchema(schema);
            output = JSON.stringify(result.schema, null, 2);
            if (result.warnings.length > 0) {
                for (const warning of result.warnings) {
                    console.error(`Warning: ${warning}`);
                }
            }
        } catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    } else {
        console.error(`Error: Unknown format "${format}"`);
        process.exit(1);
    }

    // Write output
    if (options.output) {
        fs.writeFileSync(options.output, output, 'utf-8');
        console.log(`✓ Exported to ${options.output}`);
    } else {
        console.log(output);
    }
}

// Run CLI
if (require.main === module) {
    main();
}

export { main, handleImport };
