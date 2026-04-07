import { parse, exportJsonSchema, exportTypeScript } from '@clearschema/core';
import { EXPORTER_MAP } from '../../src/index';

const SIMPLE_SCHEMA = `$defs:
  User: object: A user
    name: string.required: The user's name
    age: integer: Age
`;

const MATCH_SCHEMA = `$defs:
  Payment: object: Payment method
    payment: match(type): Payment type
      credit:
        cardNumber: string.required
      bank:
        accountNumber: string.required
`;

const REF_SCHEMA = `$defs:
  Address: object: An address
    street: string.required
    city: string.required

  User: object: A user
    name: string.required
    address: $ref: #/$defs/Address
`;

describe('compile_schema logic', () => {
    describe('happy paths', () => {
        it('compiles to json-schema and produces valid JSON', () => {
            const schema = parse(SIMPLE_SCHEMA);
            expect(schema.errors).toBeUndefined();
            const result = EXPORTER_MAP['json-schema'].fn(schema);
            expect(() => JSON.parse(result.output)).not.toThrow();
        });

        it('compiles to all 7 formats producing non-empty output', () => {
            const schema = parse(SIMPLE_SCHEMA);
            expect(schema.errors).toBeUndefined();
            for (const [_format, entry] of Object.entries(EXPORTER_MAP)) {
                const result = entry.fn(schema);
                expect(result.output.length).toBeGreaterThan(0);
            }
        });

        it('produces identical output to calling core API directly for json-schema', () => {
            const schema = parse(SIMPLE_SCHEMA);
            const direct = JSON.stringify(exportJsonSchema(schema), null, 2);
            const viaMcp = EXPORTER_MAP['json-schema'].fn(schema).output;
            expect(viaMcp).toBe(direct);
        });

        it('produces identical output to calling core API directly for typescript', () => {
            const schema = parse(SIMPLE_SCHEMA);
            const direct = exportTypeScript(schema);
            const viaMcp = EXPORTER_MAP['typescript'].fn(schema).output;
            expect(viaMcp).toBe(direct);
        });
    });

    describe('edge cases', () => {
        it('compiles schema with discriminated unions (match type)', () => {
            const schema = parse(MATCH_SCHEMA);
            expect(schema.errors).toBeUndefined();
            for (const [_format, entry] of Object.entries(EXPORTER_MAP)) {
                expect(() => entry.fn(schema)).not.toThrow();
            }
        });

        it('compiles schema with $ref references', () => {
            const schema = parse(REF_SCHEMA);
            expect(schema.errors).toBeUndefined();
            const result = EXPORTER_MAP['json-schema'].fn(schema);
            expect(result.output).toContain('Address');
        });

        it('llm-schema includes warnings for stripped constraints', () => {
            // LLM exporter works on root-level fields
            const schemaWithConstraints = `name: string.required: Name
  ^ pattern: ^[a-z]+$
`;
            const schema = parse(schemaWithConstraints);
            expect(schema.errors).toBeUndefined();
            const result = EXPORTER_MAP['llm-schema'].fn(schema);
            expect(result.warnings).toBeDefined();
            expect(result.warnings!.length).toBeGreaterThan(0);
        });
    });
});
