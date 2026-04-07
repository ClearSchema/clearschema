import { parse } from '@clearschema/core';
import { inspectSchema } from '../../src/inspect';

describe('inspectSchema', () => {
    it('returns type summaries for schema with 2 definitions', () => {
        const schema = parse(`$defs:
  User: object: A user
    name: string.required
    age: integer

  Address: object: An address
    street: string.required
    city: string.required
`);
        expect(schema.errors).toBeUndefined();
        const result = inspectSchema(schema);
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('User');
        expect(result[0].type).toBe('object');
        expect(result[0].fields).toHaveLength(2);
        expect(result[0].fields![0].name).toBe('name');
        expect(result[0].fields![0].type).toBe('string');
        expect(result[0].fields![0].required).toBe(true);
        expect(result[1].name).toBe('Address');
        expect(result[1].fields).toHaveLength(2);
    });

    it('handles nested object types with full recursive structure', () => {
        const schema = parse(`$defs:
  User: object: A user
    name: string.required
    profile: object: Profile
      bio: string
      avatar: string
`);
        expect(schema.errors).toBeUndefined();
        const result = inspectSchema(schema);
        expect(result).toHaveLength(1);
        const userType = result[0];
        expect(userType.fields).toBeDefined();
        const profileField = userType.fields!.find((f) => f.name === 'profile');
        expect(profileField).toBeDefined();
        expect(profileField!.type).toBe('object');
        // Verify nested fields are captured (not just name/type/required)
        expect(profileField!.fields).toBeDefined();
        expect(profileField!.fields).toHaveLength(2);
        expect(profileField!.fields![0].name).toBe('bio');
        expect(profileField!.fields![0].type).toBe('string');
        expect(profileField!.fields![1].name).toBe('avatar');
    });

    it('handles array fields with itemType', () => {
        const schema = parse(`$defs:
  User: object: A user
    tags: array: Tags
      - string
`);
        expect(schema.errors).toBeUndefined();
        const result = inspectSchema(schema);
        const tagsField = result[0].fields!.find((f) => f.name === 'tags');
        expect(tagsField).toBeDefined();
        expect(tagsField!.type).toBe('array');
        expect(tagsField!.itemType).toBe('string');
    });

    it('handles map fields with valueType', () => {
        const schema = parse(`$defs:
  Config: object: Config
    metadata: map: Metadata
      - string
`);
        expect(schema.errors).toBeUndefined();
        const result = inspectSchema(schema);
        const metaField = result[0].fields!.find((f) => f.name === 'metadata');
        expect(metaField).toBeDefined();
        expect(metaField!.type).toBe('map');
        expect(metaField!.valueType).toBe('string');
    });

    it('handles match type (discriminated union)', () => {
        const schema = parse(`$defs:
  Payment: object: Payment method
    payment: match(type): Payment type
      credit:
        card: string.required
      bank:
        account: string.required
`);
        expect(schema.errors).toBeUndefined();
        const result = inspectSchema(schema);
        expect(result).toHaveLength(1);
        // The top-level definition is an object containing a match field
        expect(result[0].name).toBe('Payment');
        expect(result[0].type).toBe('object');
        // The match field should be inside
        const paymentField = result[0].fields!.find((f) => f.name === 'payment');
        expect(paymentField).toBeDefined();
        expect(paymentField!.type).toBe('match');
    });

    it('handles $ref references', () => {
        const schema = parse(`$defs:
  Address: object: An address
    city: string.required

  User: object: A user
    address: $ref: #/$defs/Address
`);
        expect(schema.errors).toBeUndefined();
        const result = inspectSchema(schema);
        const userType = result.find((t) => t.name === 'User');
        expect(userType).toBeDefined();
        const addressField = userType!.fields!.find((f) => f.name === 'address');
        expect(addressField).toBeDefined();
        expect(addressField!.type).toBe('ref');
    });

    it('returns empty array for empty schema', () => {
        const schema = parse('');
        const result = inspectSchema(schema);
        expect(result).toEqual([]);
    });
});
