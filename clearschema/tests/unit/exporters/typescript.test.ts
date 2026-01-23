import { parse } from '../../../src/parser/parser';
import { exportTypeScript } from '../../../src/exporters/typescript';

describe('TypeScript Exporter', () => {
    describe('primitive types', () => {
        it('exports string field', () => {
            const schema = parse('name: string: User name');
            const output = exportTypeScript(schema);

            expect(output).toContain('name?: string;');
            expect(output).toContain('/** User name */');
        });

        it('exports required field without question mark', () => {
            const schema = parse('name: string.required: Name');
            const output = exportTypeScript(schema);

            expect(output).toContain('name: string;');
            expect(output).not.toContain('name?:');
        });

        it('exports number field', () => {
            const schema = parse('age: number: Age');
            const output = exportTypeScript(schema);

            expect(output).toContain('age?: number;');
        });

        it('exports integer as number', () => {
            const schema = parse('count: integer: Count');
            const output = exportTypeScript(schema);

            expect(output).toContain('count?: number;');
        });

        it('exports boolean field', () => {
            const schema = parse('active: boolean: Active');
            const output = exportTypeScript(schema);

            expect(output).toContain('active?: boolean;');
        });
    });

    describe('nullable fields', () => {
        it('exports nullable string', () => {
            const schema = parse('name: string.nullable: Name');
            const output = exportTypeScript(schema);

            expect(output).toContain('name?: string | null;');
        });

        it('exports nullable required field', () => {
            const schema = parse('name: string.required.nullable: Name');
            const output = exportTypeScript(schema);

            expect(output).toContain('name: string | null;');
        });
    });

    describe('complex types', () => {
        it('exports nested object', () => {
            const schema = parse(`user: object: User
  name: string.required: Name
  email: string.required: Email`);
            const output = exportTypeScript(schema);

            expect(output).toContain('user?: { name: string; email: string };');
        });

        it('exports array', () => {
            const schema = parse(`tags: array: Tags
  - string`);
            const output = exportTypeScript(schema);

            expect(output).toContain('tags?: string[];');
        });

        it('exports tuple', () => {
            const schema = parse(`coordinates: array.tuple: Coordinates
  - number
  - number`);
            const output = exportTypeScript(schema);

            expect(output).toContain('coordinates?: [number, number];');
        });
    });

    describe('union types', () => {
        it('exports union type', () => {
            const schema = parse('id: string|number: ID');
            const output = exportTypeScript(schema);

            expect(output).toContain('id?: string | number;');
        });

        it('exports multi-type union', () => {
            const schema = parse('value: string|number|boolean: Value');
            const output = exportTypeScript(schema);

            expect(output).toContain('value?: string | number | boolean;');
        });
    });

    describe('definitions', () => {
        it('exports interface definition', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string.required: Name
    email: string: Email`);
            const output = exportTypeScript(schema);

            expect(output).toContain('export interface User {');
            expect(output).toContain('name: string;');
            expect(output).toContain('email?: string;');
        });

        it('exports type reference', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name

user: $ref: #/$defs/User`);
            const output = exportTypeScript(schema);

            expect(output).toContain('export interface User {');
            expect(output).toContain('user?: User;');
        });

        it('exports multiple definitions', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name
  Address: object: Address
    city: string: City`);
            const output = exportTypeScript(schema);

            expect(output).toContain('export interface User {');
            expect(output).toContain('export interface Address {');
        });
    });

    describe('composition types', () => {
        it('exports allOf as intersection', () => {
            const schema = parse(`admin: allOf: Admin
  - $ref: #/$defs/User
  - object:
      role: string: Role`);
            const output = exportTypeScript(schema);

            expect(output).toContain('& { role?: string }');
        });

        it('exports anyOf as union', () => {
            const schema = parse(`value: anyOf: Value
  - string
  - number`);
            const output = exportTypeScript(schema);

            expect(output).toContain('string | number');
        });

        it('exports oneOf as union', () => {
            const schema = parse(`$defs:
  Card: object: Card
    number: string: Card number
  Cash: object: Cash
    amount: number: Amount

payment: oneOf: Payment
  - object:
      type: string: Type
  - object:
      amount: number: Amount`);
            const output = exportTypeScript(schema);

            expect(output).toMatch(/\|/); // Has union operator
        });
    });

    describe('export options', () => {
        it('uses export keyword by default', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name`);
            const output = exportTypeScript(schema);

            expect(output).toContain('export interface User {');
        });

        it('uses declare keyword when specified', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name`);
            const output = exportTypeScript(schema, { exportKeyword: 'declare' });

            expect(output).toContain('declare interface User {');
        });

        it('omits export keyword when empty string', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name`);
            const output = exportTypeScript(schema, { exportKeyword: '' });

            expect(output).toContain('interface User {');
            expect(output).not.toContain('export');
        });

        it('excludes comments when option is false', () => {
            const schema = parse('name: string: User name');
            const output = exportTypeScript(schema, { includeComments: false });

            expect(output).not.toContain('/** User name */');
        });
    });

    describe('complete schemas', () => {
        it('exports complex user schema', () => {
            const schema = parse(`$defs:
  Address: object: Address schema
    street: string.required: Street
    city: string.required: City

user: object.required: User data
  name: string.required: Full name
  email: string.required: Email
  age: integer: Age
  address: $ref: #/$defs/Address`);

            const output = exportTypeScript(schema);

            expect(output).toContain('export interface Address {');
            expect(output).toContain('export interface Schema {');
            expect(output).toContain('user: { name: string; email: string; age?: number; address?: Address };');
        });
    });
});
