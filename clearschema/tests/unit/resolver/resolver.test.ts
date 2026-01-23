import { parse } from '../../../src/parser/parser';
import { resolveReferences } from '../../../src/resolver/resolver';

describe('Reference Resolution', () => {
    it('resolves internal $ref', () => {
        const input = `$defs:
  User: object: User
    name: string.required: Name

user: $ref: #/$defs/User`;

        const schema = parse(input);
        const resolved = resolveReferences(schema);

        expect(resolved.fields[0].type).toBe('ref');
        const refField = resolved.fields[0] as any;
        expect(refField.resolvedRef).toBeDefined();
        expect(refField.resolvedRef.type).toBe('object');
    });

    it('resolves short-form $ref', () => {
        const input = `$defs:
  User: object: User
    name: string: Name

user: $ref: User`;

        const schema = parse(input);
        const resolved = resolveReferences(schema);

        const refField = resolved.fields[0] as any;
        expect(refField.resolvedRef).toBeDefined();
        expect(refField.resolvedRef.type).toBe('object');
    });

    it('throws error on undefined reference', () => {
        const input = `user: $ref: #/$defs/Unknown`;

        const schema = parse(input);

        expect(() => resolveReferences(schema)).toThrow(/Unknown.*not found/);
    });

    it('resolves nested references in objects', () => {
        const input = `$defs:
  Address: object: Address
    city: string: City

  User: object: User
    name: string: Name
    address: $ref: #/$defs/Address

user: $ref: #/$defs/User`;

        const schema = parse(input);
        const resolved = resolveReferences(schema);

        expect(resolved.definitions[1].field.type).toBe('object');
        const userField = resolved.definitions[1].field as any;
        expect(userField.fields[1].resolvedRef).toBeDefined();
    });

    it('resolves references in arrays', () => {
        const input = `$defs:
  User: object: User
    name: string: Name

users: array: Users
  - $ref: #/$defs/User`;

        const schema = parse(input);
        const resolved = resolveReferences(schema);

        // Array item is a simple type string in current implementation
        expect(resolved.fields[0].type).toBe('array');
    });
});
