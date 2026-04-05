import { locationToRange, DocumentState } from '../../src/utils';
import type { SourceLocation } from '@clearschema/core';

describe('locationToRange', () => {
    it('converts 1-based {line:1, column:1} to 0-based {line:0, character:0}', () => {
        const loc: SourceLocation = {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 5, offset: 4 },
        };
        const range = locationToRange(loc);
        expect(range.start.line).toBe(0);
        expect(range.start.character).toBe(0);
        expect(range.end.line).toBe(0);
        expect(range.end.character).toBe(4);
    });

    it('converts multi-line locations correctly', () => {
        const loc: SourceLocation = {
            start: { line: 3, column: 5, offset: 20 },
            end: { line: 3, column: 10, offset: 25 },
        };
        const range = locationToRange(loc);
        expect(range.start.line).toBe(2);
        expect(range.start.character).toBe(4);
        expect(range.end.line).toBe(2);
        expect(range.end.character).toBe(9);
    });

    it('handles span across multiple lines', () => {
        const loc: SourceLocation = {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 5, column: 3, offset: 40 },
        };
        const range = locationToRange(loc);
        expect(range.start.line).toBe(0);
        expect(range.start.character).toBe(0);
        expect(range.end.line).toBe(4);
        expect(range.end.character).toBe(2);
    });
});

describe('DocumentState', () => {
    it('caches schema from valid input', () => {
        const state = new DocumentState();
        const input = 'name: string: A name field';
        const diagnostics = state.update(input);
        expect(diagnostics).toEqual([]);
        expect(state.getSchema()).not.toBeNull();
        expect(state.getSchema()!.fields.length).toBeGreaterThanOrEqual(1);
    });

    it('returns null schema initially', () => {
        const state = new DocumentState();
        expect(state.getSchema()).toBeNull();
    });

    it('retains last good schema after parse with errors', () => {
        const state = new DocumentState();

        // First, parse valid input
        state.update('name: string: A name');

        const goodSchema = state.getSchema();
        expect(goodSchema).not.toBeNull();

        // Now parse something with errors — schema should still be cached
        // (the parser uses error recovery and still returns a schema)
        state.update('name: : missing type');

        // Schema is still available (error recovery produces a schema)
        expect(state.getSchema()).not.toBeNull();
    });
});
