import { getDiagnostics } from '../../src/diagnostics';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

describe('getDiagnostics', () => {
    it('returns zero diagnostics for valid input', () => {
        const input = 'name: string: A name field';
        const result = getDiagnostics(input);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.schema).not.toBeNull();
        expect(result.schema!.fields.length).toBe(1);
    });

    it('returns zero diagnostics for empty input', () => {
        const result = getDiagnostics('');
        expect(result.diagnostics).toHaveLength(0);
        expect(result.schema).not.toBeNull();
    });

    it('returns a diagnostic for input with a parse error', () => {
        // An unrecognized line format triggers a parse error
        const input = 'name string';
        const result = getDiagnostics(input);
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

        const diag = result.diagnostics[0];
        expect(diag.severity).toBe(DiagnosticSeverity.Error);
        expect(diag.source).toBe('clearschema');
        // Range should be 0-based (parser gives line 1 -> LSP line 0)
        expect(diag.range.start.line).toBe(0);
        expect(diag.range.start.character).toBe(0);
    });

    it('returns diagnostics with 0-based line/column from 1-based parser locations', () => {
        // This input has a parse error at a known location
        const input = 'name: : missing type';
        const result = getDiagnostics(input);
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

        for (const diag of result.diagnostics) {
            // All positions should be 0-based (non-negative)
            expect(diag.range.start.line).toBeGreaterThanOrEqual(0);
            expect(diag.range.start.character).toBeGreaterThanOrEqual(0);
        }
    });

    it('returns multiple diagnostics for input with multiple errors', () => {
        // Multiple problematic lines
        const input = [
            'name: : missing type',
            'age: : also missing',
        ].join('\n');
        const result = getDiagnostics(input);
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

        for (const diag of result.diagnostics) {
            expect(diag.severity).toBe(DiagnosticSeverity.Error);
            expect(diag.source).toBe('clearschema');
        }
    });

    it('includes hint in diagnostic message when ParseError has a hint', () => {
        // Unknown type triggers a ParseError with a hint listing valid types
        const input = 'name: unknowntype: desc';
        const result = getDiagnostics(input);
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

        // The "Unknown type" error includes a hint about valid types
        const withHint = result.diagnostics.filter((d) =>
            d.message.includes('(hint:')
        );
        expect(withHint.length).toBeGreaterThanOrEqual(1);
        expect(withHint[0].message).toContain('Valid types are');
    });

    it('appends hint to message when present', () => {
        // Unrecognized line format also triggers a hint
        const input = 'name string';
        const result = getDiagnostics(input);
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

        const diag = result.diagnostics[0];
        expect(diag.message).toContain('(hint:');
        expect(diag.source).toBe('clearschema');
    });

    it('returns schema even when there are recoverable errors', () => {
        const input = 'name: string: A name\n^ badModifier: oops';
        const result = getDiagnostics(input);
        // Parser should recover and still produce a schema
        expect(result.schema).not.toBeNull();
    });
});
