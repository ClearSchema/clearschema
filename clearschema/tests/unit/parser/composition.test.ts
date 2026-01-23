import { parseField } from '../../../src/parser/parser';
import { CompositionField } from '../../../src/ast/types';

describe('Parser - Composition Types', () => {
    it('parses allOf composition', () => {
        const input = `adminUser: allOf: Admin user
  - $ref: #/$defs/User
  - object:
      permissions: array: Permissions
        - string`;

        const field = parseField(input) as CompositionField;

        expect(field.type).toBe('allOf');
        expect(field.description).toBe('Admin user');
        expect(field.schemas).toHaveLength(2);
    });

    it('parses anyOf composition', () => {
        const input = `value: anyOf: String or number
  - string
  - number`;

        const field = parseField(input) as CompositionField;

        expect(field.type).toBe('anyOf');
        expect(field.schemas).toHaveLength(2);
    });

    it('parses oneOf composition', () => {
        const input = `payment: oneOf: Payment method
  - $ref: #/$defs/CreditCard
  - $ref: #/$defs/BankTransfer`;

        const field = parseField(input) as CompositionField;

        expect(field.type).toBe('oneOf');
        expect(field.schemas).toHaveLength(2);
    });
});
