import { parse, ParseError } from '@clearschema/core';

// Test the safeParse pattern used by validate_schema
function safeParse(source: string): { valid: boolean; error: string | null } {
    try {
        const schema = parse(source);
        if (schema.errors && schema.errors.length > 0) {
            const msgs = schema.errors.map((err) => {
                if (err instanceof ParseError) {
                    const loc = err.location;
                    let msg = `Line ${loc.start.line}, Col ${loc.start.column}: ${err.message}`;
                    if (err.hint) msg += ` (hint: ${err.hint})`;
                    return msg;
                }
                return err.message;
            });
            return { valid: false, error: msgs.join('\n') };
        }
        return { valid: true, error: null };
    } catch (err) {
        if (err instanceof ParseError) {
            const loc = err.location;
            let msg = `Parse error at line ${loc.start.line}, column ${loc.start.column}: ${err.message}`;
            if (err.hint) msg += ` (hint: ${err.hint})`;
            return { valid: false, error: msg };
        }
        return { valid: false, error: `Parse error: ${err instanceof Error ? err.message : String(err)}` };
    }
}

describe('validate_schema logic', () => {
    it('returns valid for correct schema', () => {
        const result = safeParse(`$defs:
  User: object: A user
    name: string.required
    age: integer
`);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
    });

    it('returns error with info for syntax error', () => {
        const result = safeParse('this is not valid clearschema syntax!!!');
        expect(result.valid).toBe(false);
        expect(result.error).toBeTruthy();
    });

    it('handles empty string without crashing', () => {
        const result = safeParse('');
        expect(typeof result.valid).toBe('boolean');
    });

    it('returns valid for schema with discriminated unions', () => {
        const result = safeParse(`$defs:
  Payment: object: Payment method
    payment: match(type): Payment type
      credit:
        card: string.required
      bank:
        account: string.required
`);
        expect(result.valid).toBe(true);
    });

    it('returns valid for schema with $ref references', () => {
        const result = safeParse(`$defs:
  Address: object: An address
    city: string.required

  User: object: A user
    address: $ref: #/$defs/Address
`);
        expect(result.valid).toBe(true);
    });
});
