import { parse } from '../../../src/parser/parser';
import { exportZod } from '../../../src/exporters/zod';
import { Schema, MapField, ArrayField, RefField, ObjectField, CompositionField } from '../../../src/ast/types';

describe('Zod Exporter', () => {
    describe('import statement', () => {
        it('starts with zod import', () => {
            const schema = parse('name: string: Name');
            const output = exportZod(schema);

            expect(output).toMatch(/^import \{ z \} from 'zod';/);
        });
    });

    describe('primitive types', () => {
        it('exports string field', () => {
            const schema = parse('name: string: Name');
            const output = exportZod(schema);

            expect(output).toContain('name: z.string()');
        });

        it('exports number field', () => {
            const schema = parse('age: number: Age');
            const output = exportZod(schema);

            expect(output).toContain('age: z.number()');
        });

        it('exports integer field', () => {
            const schema = parse('count: integer: Count');
            const output = exportZod(schema);

            expect(output).toContain('count: z.number().int()');
        });

        it('exports boolean field', () => {
            const schema = parse('active: boolean: Active');
            const output = exportZod(schema);

            expect(output).toContain('active: z.boolean()');
        });

        it('exports null field', () => {
            const schema = parse('nothing: null: Nothing');
            const output = exportZod(schema);

            expect(output).toContain('nothing: z.null()');
        });
    });

    describe('string modifiers', () => {
        it('exports minLength/maxLength', () => {
            const schema = parse(`name: string: Name
  ^ minLength: 1
  ^ maxLength: 100`);
            const output = exportZod(schema);

            expect(output).toContain('z.string().min(1).max(100)');
        });

        it('exports pattern as regex', () => {
            const schema = parse(`code: string: Code
  ^ pattern: ^[A-Z]+$`);
            const output = exportZod(schema);

            expect(output).toContain('z.string().regex(/^[A-Z]+$/)');
        });

        it('exports format email', () => {
            const schema = parse(`email: string: Email
  ^ format: email`);
            const output = exportZod(schema);

            expect(output).toContain('z.string().email()');
        });

        it('exports format uri as url', () => {
            const schema = parse(`website: string: Website
  ^ format: uri`);
            const output = exportZod(schema);

            expect(output).toContain('z.string().url()');
        });

        it('exports format uuid', () => {
            const schema = parse(`id: string: ID
  ^ format: uuid`);
            const output = exportZod(schema);

            expect(output).toContain('z.string().uuid()');
        });

        it('exports format datetime', () => {
            const schema = parse(`created: string: Created
  ^ format: date-time`);
            const output = exportZod(schema);

            expect(output).toContain('z.string().datetime()');
        });

        it('exports pattern with forward slashes escaped', () => {
            const loc = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
            const schema: Schema = {
                location: loc,
                imports: [],
                definitions: [],
                fields: [{
                    name: 'url',
                    type: 'string',
                    description: '',
                    required: true,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                    pattern: '^https?://[^/]+$',
                } as any],
            };
            const output = exportZod(schema);

            expect(output).toContain('.regex(/^https?:\\/\\/[^\\/]+$/)');
            expect(output).not.toContain('.regex(/^https?://');
        });

        it('falls back to plain z.string() for unsupported format', () => {
            const schema = parse(`host: string: Host
  ^ format: hostname`);
            const output = exportZod(schema);

            expect(output).toContain('z.string()');
            expect(output).not.toContain('.hostname()');
        });
    });

    describe('number modifiers', () => {
        it('exports min/max', () => {
            const schema = parse(`age: number: Age
  ^ min: 0
  ^ max: 150`);
            const output = exportZod(schema);

            expect(output).toContain('z.number().min(0).max(150)');
        });

        it('exports multipleOf', () => {
            const schema = parse(`step: number: Step
  ^ multipleOf: 0.5`);
            const output = exportZod(schema);

            expect(output).toContain('z.number().multipleOf(0.5)');
        });

        it('exports exclusiveMin/exclusiveMax as gt/lt', () => {
            const schema = parse(`score: integer: Score
  ^ exclusiveMin: 0
  ^ exclusiveMax: 100`);
            const output = exportZod(schema);

            expect(output).toContain('z.number().int().gt(0).lt(100)');
        });
    });

    describe('universal modifiers', () => {
        it('exports nullable', () => {
            const schema = parse('name: string.nullable: Name');
            const output = exportZod(schema);

            expect(output).toContain('.nullable()');
        });

        it('exports optional (required: false)', () => {
            const schema = parse('name: string: Name');
            const output = exportZod(schema);

            expect(output).toContain('.optional()');
        });

        it('does not add optional for required fields', () => {
            const schema = parse('name: string.required: Name');
            const output = exportZod(schema);

            expect(output).not.toContain('.optional()');
        });

        it('exports default value', () => {
            const schema = parse(`active: boolean: Active
  ^ default: true`);
            const output = exportZod(schema);

            expect(output).toContain('.default(true)');
        });

        it('exports description', () => {
            const schema = parse('name: string: User name');
            const output = exportZod(schema);

            expect(output).toContain('.describe("User name")');
        });

        it('excludes description when option is false', () => {
            const schema = parse('name: string: User name');
            const output = exportZod(schema, { includeDescriptions: false });

            expect(output).not.toContain('.describe(');
        });

        it('chains modifiers in correct order: type → constraints → nullable → optional → default → describe', () => {
            const schema = parse(`name: string.nullable: User name
  ^ minLength: 1
  ^ maxLength: 50
  ^ default: anonymous`);
            const output = exportZod(schema);

            // Verify order: string constraints, then nullable, then optional, then default, then describe
            const fieldMatch = output.match(/z\.string\(\).*?(?=,|\n)/);
            expect(fieldMatch).not.toBeNull();
            const chain = fieldMatch![0];

            const nullablePos = chain.indexOf('.nullable()');
            const optionalPos = chain.indexOf('.optional()');
            const defaultPos = chain.indexOf('.default(');
            const describePos = chain.indexOf('.describe(');
            const minPos = chain.indexOf('.min(');

            expect(minPos).toBeLessThan(nullablePos);
            expect(nullablePos).toBeLessThan(optionalPos);
            expect(optionalPos).toBeLessThan(defaultPos);
            expect(defaultPos).toBeLessThan(describePos);
        });
    });

    describe('const and enum', () => {
        it('exports const as z.literal()', () => {
            const schema = parse(`type: string: Type
  ^ const: active`);
            const output = exportZod(schema);

            expect(output).toContain('z.literal("active")');
        });

        it('exports const with nullable', () => {
            const schema = parse(`type: string.nullable: Type
  ^ const: active`);
            const output = exportZod(schema);

            expect(output).toContain('z.literal("active").nullable()');
        });

        it('exports const with description', () => {
            const schema = parse(`type: string: The type
  ^ const: active`);
            const output = exportZod(schema);

            expect(output).toContain('z.literal("active")');
            expect(output).toContain('.describe("The type")');
        });

        it('exports string enum as z.enum()', () => {
            const schema = parse(`status: string.required: Status
  ^ enum: [active, inactive, pending]`);
            const output = exportZod(schema);

            expect(output).toContain('z.enum(["active", "inactive", "pending"])');
        });

        it('exports enum with optional', () => {
            const schema = parse(`status: string: Status
  ^ enum: [a, b]`);
            const output = exportZod(schema);

            expect(output).toContain('z.enum(["a", "b"]).optional()');
        });

        it('exports number enum as union of literals', () => {
            const loc = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
            const schema: Schema = {
                location: loc,
                imports: [],
                definitions: [],
                fields: [{
                    name: 'priority',
                    type: 'number',
                    description: 'Priority',
                    required: true,
                    nullable: false,
                    enum: [1, 2, 3],
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                } as any],
            };
            const output = exportZod(schema);

            expect(output).toContain('z.union([z.literal(1), z.literal(2), z.literal(3)])');
        });

        it('const takes precedence over enum', () => {
            const loc = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
            const schema: Schema = {
                location: loc,
                imports: [],
                definitions: [],
                fields: [{
                    name: 'status',
                    type: 'string',
                    description: '',
                    required: true,
                    nullable: false,
                    const: 'active',
                    enum: ['active', 'inactive'],
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                } as any],
            };
            const output = exportZod(schema);

            expect(output).toContain('z.literal("active")');
            expect(output).not.toContain('z.enum(');
        });
    });

    describe('definitions and root schema', () => {
        it('exports $defs as named consts with Schema suffix', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string.required: Name
    email: string: Email`);
            const output = exportZod(schema);

            expect(output).toContain('export const UserSchema = z.object(');
            expect(output).toContain('name: z.string()');
            expect(output).toContain('email: z.string()');
        });

        it('exports root fields as Schema const', () => {
            const schema = parse('name: string.required: Name');
            const output = exportZod(schema);

            expect(output).toContain('export const Schema = z.object(');
        });

        it('exports non-object definition correctly', () => {
            const schema = parse(`$defs:
  Status: string: Status
    ^ enum: [active, inactive]`);
            const output = exportZod(schema);

            expect(output).toContain('export const StatusSchema = z.enum(["active", "inactive"])');
        });
    });

    describe('complex types', () => {
        it('exports object with fields', () => {
            const schema = parse(`user: object: User
  name: string.required: Name
  age: number: Age`);
            const output = exportZod(schema);

            expect(output).toContain('z.object(');
            expect(output).toContain('name: z.string()');
            expect(output).toContain('age: z.number()');
        });

        it('exports nested objects', () => {
            const schema = parse(`user: object: User
  address: object: Address
    city: string.required: City`);
            const output = exportZod(schema);

            expect(output).toContain('z.object(');
            expect(output).toContain('city: z.string()');
        });

        it('exports empty object', () => {
            const schema = parse('data: object: Data');
            const output = exportZod(schema);

            expect(output).toContain('z.object({})');
        });

        it('exports array with primitive item', () => {
            const schema = parse(`tags: array: Tags
  - string`);
            const output = exportZod(schema);

            expect(output).toContain('z.array(z.string())');
        });

        it('exports array with object item', () => {
            const schema = parse(`items: array: Items
  - object:
    name: string.required: Name`);
            const output = exportZod(schema);

            expect(output).toContain('z.array(z.object(');
        });

        it('exports array with minItems/maxItems', () => {
            const schema = parse(`items: array: Items
  - string
  ^ minItems: 1
  ^ maxItems: 10`);
            const output = exportZod(schema);

            expect(output).toContain('z.array(z.string()).min(1).max(10)');
        });

        it('exports tuple', () => {
            const schema = parse(`coords: array.tuple: Coordinates
  - number
  - number`);
            const output = exportZod(schema);

            expect(output).toContain('z.tuple([');
        });

        it('exports map with string values', () => {
            const schema = parse(`metadata: map: Metadata
  - string`);
            const output = exportZod(schema);

            expect(output).toContain('z.record(z.string(), z.string())');
        });

        it('exports map with object values', () => {
            const schema = parse(`users: map: Users
  - object:
    name: string.required: Name`);
            const output = exportZod(schema);

            expect(output).toContain('z.record(z.string(), z.object(');
        });

        it('exports nullable map', () => {
            const schema = parse(`metadata: map.nullable: Metadata
  - string`);
            const output = exportZod(schema);

            expect(output).toContain('z.record(z.string(), z.string()).nullable()');
        });

        it('exports map with FieldTypeName string value type', () => {
            const loc = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
            const schema: Schema = {
                location: loc,
                imports: [],
                definitions: [],
                fields: [{
                    name: 'data',
                    type: 'map',
                    description: '',
                    required: false,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                    valueType: 'number',
                } as MapField],
            };
            const output = exportZod(schema);

            expect(output).toContain('z.record(z.string(), z.number())');
        });

        it('exports array with FieldTypeName string item type', () => {
            const loc = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
            const schema: Schema = {
                location: loc,
                imports: [],
                definitions: [],
                fields: [{
                    name: 'items',
                    type: 'array',
                    description: '',
                    required: false,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                    itemType: 'boolean',
                } as ArrayField],
            };
            const output = exportZod(schema);

            expect(output).toContain('z.array(z.boolean())');
        });

        it('exports deeply nested: array of objects with map fields', () => {
            const schema = parse(`items: array: Items
  - object:
    meta: map: Meta
      - string`);
            const output = exportZod(schema);

            expect(output).toContain('z.array(z.object(');
            expect(output).toContain('z.record(z.string(), z.string())');
        });
    });

    describe('references', () => {
        it('exports ref as schema const name', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name

user: $ref: #/$defs/User`);
            const output = exportZod(schema);

            expect(output).toContain('export const UserSchema = z.object(');
            expect(output).toContain('user: UserSchema');
        });

        it('exports ref in nested position', () => {
            const schema = parse(`$defs:
  Address: object: Address
    city: string: City

user: object: User
  address: $ref: #/$defs/Address`);
            const output = exportZod(schema);

            expect(output).toContain('address: AddressSchema');
        });
    });

    describe('union types', () => {
        it('exports union of two types', () => {
            const schema = parse('id: string|number: ID');
            const output = exportZod(schema);

            expect(output).toContain('z.union([z.string(), z.number()])');
        });

        it('exports union of three+ types', () => {
            const schema = parse('value: string|number|boolean: Value');
            const output = exportZod(schema);

            expect(output).toContain('z.union([z.string(), z.number(), z.boolean()])');
        });
    });

    describe('composition types', () => {
        it('exports allOf with two schemas as intersection', () => {
            const loc = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
            const makeRef = (name: string): RefField => ({
                name: '',
                type: 'ref',
                ref: `#/$defs/${name}`,
                description: '',
                required: true,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            });
            const schema: Schema = {
                location: loc,
                imports: [],
                definitions: [],
                fields: [{
                    name: 'admin',
                    type: 'allOf',
                    description: '',
                    required: true,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                    schemas: [
                        makeRef('User'),
                        {
                            name: '',
                            type: 'object',
                            description: '',
                            required: true,
                            nullable: false,
                            rawModifiers: {},
                            modifiers: [],
                            location: loc,
                            fields: [{
                                name: 'role',
                                type: 'string',
                                description: 'Role',
                                required: true,
                                nullable: false,
                                rawModifiers: {},
                                modifiers: [],
                                location: loc,
                            } as any],
                        } as ObjectField,
                    ],
                } as CompositionField],
            };
            const output = exportZod(schema);

            expect(output).toContain('z.intersection(UserSchema, z.object(');
        });

        it('exports allOf with three schemas using .and() chaining', () => {
            const loc = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
            const makeRef = (name: string): RefField => ({
                name: '',
                type: 'ref',
                ref: `#/$defs/${name}`,
                description: '',
                required: true,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            });
            const schema: Schema = {
                location: loc,
                imports: [],
                definitions: [],
                fields: [{
                    name: 'combined',
                    type: 'allOf',
                    description: '',
                    required: true,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                    schemas: [makeRef('A'), makeRef('B'), makeRef('C')],
                } as CompositionField],
            };
            const output = exportZod(schema);

            expect(output).toContain('z.intersection(ASchema, BSchema).and(CSchema)');
        });

        it('exports anyOf as union', () => {
            const schema = parse(`value: anyOf: Value
  - string
  - number`);
            const output = exportZod(schema);

            expect(output).toContain('z.union([');
        });

        it('exports oneOf as union', () => {
            const schema = parse(`payment: oneOf: Payment
  - object:
    type: string: Type
  - object:
    amount: number: Amount`);
            const output = exportZod(schema);

            expect(output).toContain('z.union([');
        });

        it('exports composition with ref members', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name

admin: allOf: Admin
  - $ref: #/$defs/User
  - object:
    role: string: Role`);
            const output = exportZod(schema);

            expect(output).toContain('UserSchema');
            expect(output).toContain('z.intersection(');
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
    ^ minLength: 1
    ^ maxLength: 100
  email: string.required: Email
    ^ format: email
  age: integer: Age
    ^ min: 0
  address: $ref: #/$defs/Address`);
            const output = exportZod(schema);

            expect(output).toContain("import { z } from 'zod';");
            expect(output).toContain('export const AddressSchema = z.object(');
            expect(output).toContain('export const Schema = z.object(');
            expect(output).toContain('z.string().min(1).max(100)');
            expect(output).toContain('z.string().email()');
            expect(output).toContain('z.number().int().min(0)');
            expect(output).toContain('AddressSchema');
        });

        it('exports number with min + max + description in correct order', () => {
            const schema = parse(`score: number.required: The score
  ^ min: 0
  ^ max: 100`);
            const output = exportZod(schema);

            const match = output.match(/z\.number\(\).*?(?=,|\n)/);
            expect(match).not.toBeNull();
            const chain = match![0];

            expect(chain).toContain('.min(0)');
            expect(chain).toContain('.max(100)');
            expect(chain).toContain('.describe("The score")');

            const maxPos = chain.indexOf('.max(100)');
            const describePos = chain.indexOf('.describe(');
            expect(maxPos).toBeLessThan(describePos);
        });
    });
});
