import { Range } from 'vscode-languageserver/node';
import { SourceLocation, Schema } from '@clearschema/core';
import { getDiagnostics } from './diagnostics';
import type { Diagnostic } from 'vscode-languageserver/node';

/**
 * Convert a 1-based SourceLocation from the parser to a 0-based LSP Range.
 */
export function locationToRange(loc: SourceLocation): Range {
    return {
        start: {
            line: loc.start.line - 1,
            character: loc.start.column - 1,
        },
        end: {
            line: loc.end.line - 1,
            character: loc.end.column - 1,
        },
    };
}

/**
 * Per-document state that caches the last successfully parsed Schema.
 * Used by hover, go-to-definition, and symbols even when the current
 * document has parse errors.
 */
export class DocumentState {
    private cachedSchema: Schema | null = null;

    /**
     * Re-parse the document text and return diagnostics.
     * If parsing succeeds (even with recoverable errors), the schema is cached.
     */
    update(text: string): Diagnostic[] {
        const result = getDiagnostics(text);
        if (result.schema) {
            this.cachedSchema = result.schema;
        }
        return result.diagnostics;
    }

    /**
     * Return the last successfully parsed schema, or null if none.
     */
    getSchema(): Schema | null {
        return this.cachedSchema;
    }
}
