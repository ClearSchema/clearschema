import { parseField } from '../../../src/parser/parser';
import { MatchField, ObjectField, RefField } from '../../../src/ast/types';
import { ParseError } from '../../../src/parser/errors';

describe('Match (Discriminated Union) Parser', () => {
    it('parses match(type) with two inline variants', () => {
        const input = `payment: match(type): Payment method
  credit_card:
    cardNumber: string.required
    expiry: string.required
  bank_transfer:
    accountNumber: string.required
    routingNumber: string.required`;

        const field = parseField(input) as MatchField;

        expect(field.type).toBe('match');
        expect(field.name).toBe('payment');
        expect(field.discriminator).toBe('type');
        expect(field.description).toBe('Payment method');
        expect(Object.keys(field.variants)).toEqual(['credit_card', 'bank_transfer']);

        const cc = field.variants['credit_card'] as ObjectField;
        expect(cc.type).toBe('object');
        expect(cc.fields).toHaveLength(2);
        expect(cc.fields[0].name).toBe('cardNumber');
        expect(cc.fields[1].name).toBe('expiry');

        const bt = field.variants['bank_transfer'] as ObjectField;
        expect(bt.type).toBe('object');
        expect(bt.fields).toHaveLength(2);
        expect(bt.fields[0].name).toBe('accountNumber');
    });

    it('parses match(kind) with a $ref variant (indented)', () => {
        const input = `result: match(kind)
  success:
    data: string
  error:
    $ref: #/$defs/ErrorResponse`;

        const field = parseField(input) as MatchField;

        expect(field.type).toBe('match');
        expect(field.discriminator).toBe('kind');
        expect(Object.keys(field.variants)).toEqual(['success', 'error']);

        const success = field.variants['success'] as ObjectField;
        expect(success.type).toBe('object');
        expect(success.fields[0].name).toBe('data');

        const error = field.variants['error'] as RefField;
        expect(error.type).toBe('ref');
        expect(error.ref).toBe('#/$defs/ErrorResponse');
    });

    it('parses match with mixed inline and $ref variants', () => {
        const input = `payment: match(type): Payment method
  credit_card:
    cardNumber: string.required
    expiry: string.required
  paypal: $ref: #/$defs/PayPalPayment`;

        const field = parseField(input) as MatchField;

        expect(field.type).toBe('match');
        expect(Object.keys(field.variants)).toEqual(['credit_card', 'paypal']);

        const cc = field.variants['credit_card'] as ObjectField;
        expect(cc.type).toBe('object');
        expect(cc.fields).toHaveLength(2);

        const paypal = field.variants['paypal'] as RefField;
        expect(paypal.type).toBe('ref');
        expect(paypal.ref).toBe('#/$defs/PayPalPayment');
    });

    it('preserves description on MatchField', () => {
        const input = `event: match(type): Event payload
  click:
    x: number
    y: number`;

        const field = parseField(input) as MatchField;
        expect(field.description).toBe('Event payload');
    });

    it('parses match with single variant', () => {
        const input = `item: match(kind)
  product:
    name: string`;

        const field = parseField(input) as MatchField;
        expect(field.type).toBe('match');
        expect(Object.keys(field.variants)).toEqual(['product']);
    });

    it('accepts variant keys with hyphens', () => {
        const input = `payment: match(type)
  credit-card:
    number: string
  bank-transfer:
    account: string`;

        const field = parseField(input) as MatchField;
        expect(Object.keys(field.variants)).toEqual(['credit-card', 'bank-transfer']);
    });

    it('parses match with required modifier', () => {
        const input = `payment: match(type).required: Payment
  card:
    number: string`;

        const field = parseField(input) as MatchField;
        expect(field.required).toBe(true);
    });

    it('rejects duplicate variant keys', () => {
        const input = `payment: match(type)
  card:
    number: string
  card:
    account: string`;

        expect(() => parseField(input)).toThrow(ParseError);
        try {
            parseField(input);
        } catch (e) {
            expect((e as ParseError).message).toContain('Duplicate variant key');
        }
    });

    it('rejects match without parentheses', () => {
        const input = `payment: match: Payment`;

        // 'match' is not in ALL_TYPES and doesn't start with 'match('
        expect(() => parseField(input)).toThrow(ParseError);
    });

    it('rejects match() with empty discriminator', () => {
        const input = `payment: match()
  card:
    number: string`;

        expect(() => parseField(input)).toThrow(ParseError);
        try {
            parseField(input);
        } catch (e) {
            expect((e as ParseError).message).toContain('match requires a discriminator');
        }
    });

    it('rejects match with no variants', () => {
        const input = `payment: match(type)`;

        expect(() => parseField(input)).toThrow(ParseError);
        try {
            parseField(input);
        } catch (e) {
            expect((e as ParseError).message).toContain('match requires at least one variant');
        }
    });

    it('handles variant with nested object fields', () => {
        const input = `event: match(type)
  order:
    customer: object
      name: string
      email: string`;

        const field = parseField(input) as MatchField;
        const order = field.variants['order'] as ObjectField;
        expect(order.fields).toHaveLength(1);
        expect(order.fields[0].name).toBe('customer');
        expect(order.fields[0].type).toBe('object');
    });
});
