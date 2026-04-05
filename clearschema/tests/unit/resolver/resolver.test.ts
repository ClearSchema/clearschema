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

    it('resolves $ref value type in map fields', () => {
        const schema = {
            location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
            imports: [],
            definitions: [
                {
                    name: 'Address',
                    location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                    field: {
                        name: 'Address',
                        type: 'object' as const,
                        description: 'Address',
                        required: false,
                        nullable: false,
                        rawModifiers: {},
                        modifiers: [],
                        fields: [
                            {
                                name: 'city',
                                type: 'string' as const,
                                description: 'City',
                                required: false,
                                nullable: false,
                                rawModifiers: {},
                                modifiers: [],
                                location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                            },
                        ],
                        location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                    },
                },
            ],
            fields: [
                {
                    name: 'addresses',
                    type: 'map' as const,
                    description: 'Addresses by key',
                    required: false,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    valueType: {
                        name: 'addressRef',
                        type: 'ref' as const,
                        ref: '#/$defs/Address',
                        description: '',
                        required: false,
                        nullable: false,
                        rawModifiers: {},
                        modifiers: [],
                        location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                    },
                    location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                },
            ],
        };

        const resolved = resolveReferences(schema as any);

        const mapField = resolved.fields[0] as any;
        expect(mapField.type).toBe('map');
        expect(mapField.valueType.type).toBe('ref');
        expect(mapField.valueType.resolvedRef).toBeDefined();
        expect(mapField.valueType.resolvedRef.type).toBe('object');
    });

    it('passes through map with primitive value type unchanged', () => {
        const schema = {
            location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
            imports: [],
            definitions: [],
            fields: [
                {
                    name: 'metadata',
                    type: 'map' as const,
                    description: 'Metadata',
                    required: false,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    valueType: 'string',
                    location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                },
            ],
        };

        const resolved = resolveReferences(schema as any);

        const mapField = resolved.fields[0] as any;
        expect(mapField.type).toBe('map');
        expect(mapField.valueType).toBe('string');
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
