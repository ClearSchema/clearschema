import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { parse, ParseError } from '@clearschema/core';
import type { Schema } from '@clearschema/core';
import { locationToRange } from './utils';

export interface DiagnosticsResult {
    diagnostics: Diagnostic[];
    schema: Schema | null;
}

/**
 * Parse the given text and return LSP diagnostics plus the parsed schema.
 * If the parser throws a catastrophic (unrecoverable) error, a single
 * diagnostic is produced and schema is null.
 */
export function getDiagnostics(text: string): DiagnosticsResult {
    let schema: Schema | null = null;

    try {
        schema = parse(text);
    } catch (err) {
        // Catastrophic parse failure — produce a single diagnostic
        const message = err instanceof Error ? err.message : String(err);
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
            },
            message: `Parse error: ${message}`,
            source: 'clearschema',
        };

        // If it's a ParseError with location, use that
        if (err instanceof ParseError && err.location) {
            diagnostic.range = locationToRange(err.location);
        }

        return { diagnostics: [diagnostic], schema: null };
    }

    const diagnostics: Diagnostic[] = [];

    if (schema.errors && schema.errors.length > 0) {
        for (const error of schema.errors) {
            let message = error.message;

            // Append hint if available (ParseError has a hint property)
            if (error instanceof ParseError && error.hint) {
                message += ` (hint: ${error.hint})`;
            }

            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range:
                    error instanceof ParseError && error.location
                        ? locationToRange(error.location)
                        : {
                              start: { line: 0, character: 0 },
                              end: { line: 0, character: 0 },
                          },
                message,
                source: 'clearschema',
            };

            diagnostics.push(diagnostic);
        }
    }

    return { diagnostics, schema };
}
