import { parse } from '@clearschema/core';
import { EXPORTER_MAP } from '../../src/index';

const SIMPLE_SCHEMA = `$defs:
  User: object: A user
    name: string.required: The user's name
    age: integer: Age
`;

describe('EXPORTER_MAP', () => {
    it('contains all 7 export formats', () => {
        const formats = Object.keys(EXPORTER_MAP);
        expect(formats).toEqual(expect.arrayContaining([
            'json-schema', 'typescript', 'pydantic', 'openapi',
            'zod', 'llm-schema', 'clearschema',
        ]));
        expect(formats).toHaveLength(7);
    });

    it('each entry has a description', () => {
        for (const [_name, entry] of Object.entries(EXPORTER_MAP)) {
            expect(entry.description).toBeTruthy();
            expect(typeof entry.description).toBe('string');
        }
    });

    it('each exporter produces a non-empty string output from a simple schema', () => {
        const schema = parse(SIMPLE_SCHEMA);
        expect(schema.errors).toBeUndefined();
        for (const [_name, entry] of Object.entries(EXPORTER_MAP)) {
            const result = entry.fn(schema);
            expect(typeof result.output).toBe('string');
            expect(result.output.length).toBeGreaterThan(0);
        }
    });

    it('llm-schema exporter returns warnings when constraints are stripped', () => {
        // LLM exporter works on root-level fields, not $defs types
        const schemaWithConstraints = `name: string.required: Name
  ^ pattern: ^[a-z]+$
age: integer: Age
  ^ min: 0
`;
        const schema = parse(schemaWithConstraints);
        expect(schema.errors).toBeUndefined();
        const result = EXPORTER_MAP['llm-schema'].fn(schema);
        expect(result.output).toBeTruthy();
        // LLM exporter strips pattern and min/max constraints
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.length).toBeGreaterThan(0);
    });
});
