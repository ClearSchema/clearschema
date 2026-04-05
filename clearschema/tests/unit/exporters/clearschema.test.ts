import { parse } from '../../../src/parser/parser';
import { exportClearSchema, ClearSchemaSerializer } from '../../../src/exporters/clearschema';
import {
    Schema,
    Field,
    StringField,
    NumberField,
    ObjectField,
    ArrayField,
    MapField,
    TupleArrayField,
    UnionField,
    RefField,
    CompositionField,
    SourceLocation,
} from '../../../src/ast/types';

const loc: SourceLocation = {
    start: { line: 0, column: 0, offset: 0 },
    end: { line: 0, column: 0, offset: 0 },
};

function makeSchema(fields: Field[], definitions: { name: string; field: Field }[] = []): Schema {
    return {
        location: loc,
        imports: [],
        definitions: definitions.map(d => ({ name: d.name, field: d.field, location: loc })),
        fields,
    };
}

function makeStringField(name: string, opts: Partial<StringField> = {}): StringField {
    return {
        name,
        type: 'string',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        ...opts,
    } as StringField;
}

function makeNumberField(name: string, opts: Partial<NumberField> = {}): NumberField {
    return {
        name,
        type: opts.type ?? 'number',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        ...opts,
    } as NumberField;
}

function makeBooleanField(name: string, opts: Partial<Field> = {}): Field {
    return {
        name,
        type: 'boolean',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        ...opts,
    } as any;
}

function makeObjectField(name: string, fields: Field[], opts: Partial<ObjectField> = {}): ObjectField {
    return {
        name,
        type: 'object',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        fields,
        ...opts,
    } as ObjectField;
}

function makeArrayField(name: string, itemType: Field | string, opts: Partial<ArrayField> = {}): ArrayField {
    return {
        name,
        type: 'array',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        itemType,
        ...opts,
    } as ArrayField;
}

function makeRefField(name: string, ref: string, opts: Partial<RefField> = {}): RefField {
    return {
        name,
        type: 'ref',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        ref,
        ...opts,
    } as RefField;
}

function makeMapField(name: string, valueType: Field | string, opts: Partial<MapField> = {}): MapField {
    return {
        name,
        type: 'map',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        valueType,
        ...opts,
    } as MapField;
}

function makeUnionField(name: string, types: string[], opts: Partial<UnionField> = {}): UnionField {
    return {
        name,
        type: 'union',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        types: types as any,
        ...opts,
    } as UnionField;
}

function makeCompositionField(name: string, compositionType: 'allOf' | 'anyOf' | 'oneOf', schemas: (Field | RefField)[], opts: Partial<CompositionField> = {}): CompositionField {
    return {
        name,
        type: compositionType,
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        schemas,
        ...opts,
    } as CompositionField;
}

function makeTupleField(name: string, items: Field[], opts: Partial<TupleArrayField> = {}): TupleArrayField {
    return {
        name,
        type: 'array.tuple',
        description: opts.description ?? '',
        required: opts.required ?? false,
        nullable: opts.nullable ?? false,
        rawModifiers: {},
        modifiers: [],
        location: loc,
        items,
        ...opts,
    } as TupleArrayField;
}

describe('ClearSchema Serializer', () => {
    describe('simple fields', () => {
        it('serializes string/number/boolean fields', () => {
            const schema = makeSchema([
                makeStringField('name', { required: true, description: 'Full name' }),
                makeNumberField('age', { description: 'Age in years' }),
                makeBooleanField('active', { description: 'Account status' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('name: string.required: Full name');
            expect(output).toContain('age: number: Age in years');
            expect(output).toContain('active: boolean: Account status');
        });

        it('serializes field with no description without trailing colon', () => {
            const schema = makeSchema([
                makeStringField('name', { required: true }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toBe('name: string.required\n');
            expect(output).not.toContain('name: string.required:');
        });

        it('serializes field with description after second colon', () => {
            const schema = makeSchema([
                makeStringField('email', { description: 'Email address' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('email: string: Email address');
        });
    });

    describe('inline modifiers (required, nullable)', () => {
        it('serializes required modifier', () => {
            const schema = makeSchema([
                makeStringField('name', { required: true }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('name: string.required');
        });

        it('serializes nullable modifier', () => {
            const schema = makeSchema([
                makeStringField('name', { nullable: true }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('name: string.nullable');
        });

        it('serializes both required and nullable', () => {
            const schema = makeSchema([
                makeStringField('name', { required: true, nullable: true, description: 'Name' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('name: string.required.nullable: Name');
        });
    });

    describe('string constraints', () => {
        it('serializes minLength, maxLength, pattern, format', () => {
            const schema = makeSchema([
                makeStringField('name', {
                    required: true,
                    description: 'Full name',
                    minLength: 2,
                    maxLength: 100,
                }),
                makeStringField('email', {
                    required: true,
                    description: 'Email address',
                    format: 'email',
                }),
                makeStringField('code', {
                    description: 'Code',
                    pattern: '^[A-Z]+$',
                }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('name: string.required: Full name');
            expect(output).toContain('  ^ minLength: 2');
            expect(output).toContain('  ^ maxLength: 100');
            expect(output).toContain('  ^ format: email');
            expect(output).toContain('  ^ pattern: ^[A-Z]+$');
        });
    });

    describe('number constraints', () => {
        it('serializes min, max, multipleOf', () => {
            const schema = makeSchema([
                makeNumberField('age', {
                    description: 'Age',
                    min: 0,
                    max: 150,
                }),
                makeNumberField('step', {
                    description: 'Step',
                    multipleOf: 0.5,
                }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('  ^ min: 0');
            expect(output).toContain('  ^ max: 150');
            expect(output).toContain('  ^ multipleOf: 0.5');
        });

        it('serializes exclusiveMin, exclusiveMax', () => {
            const schema = makeSchema([
                makeNumberField('score', {
                    type: 'integer',
                    description: 'Score',
                    exclusiveMin: 0,
                    exclusiveMax: 100,
                }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('score: integer: Score');
            expect(output).toContain('  ^ exclusiveMin: 0');
            expect(output).toContain('  ^ exclusiveMax: 100');
        });
    });

    describe('nested objects', () => {
        it('serializes nested object with indented children', () => {
            const schema = makeSchema([
                makeObjectField('user', [
                    makeStringField('name', { required: true, description: 'Full name' }),
                    makeStringField('email', { required: true, description: 'Email' }),
                ], { required: true, description: 'User profile' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('user: object.required: User profile');
            expect(output).toContain('  name: string.required: Full name');
            expect(output).toContain('  email: string.required: Email');
        });

        it('serializes deeply nested objects (3+ levels)', () => {
            const schema = makeSchema([
                makeObjectField('level1', [
                    makeObjectField('level2', [
                        makeObjectField('level3', [
                            makeStringField('value', { description: 'Deep value' }),
                        ], { description: 'Third level' }),
                    ], { description: 'Second level' }),
                ], { description: 'First level' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('level1: object: First level');
            expect(output).toContain('  level2: object: Second level');
            expect(output).toContain('    level3: object: Third level');
            expect(output).toContain('      value: string: Deep value');
        });
    });

    describe('arrays', () => {
        it('serializes array with primitive item type', () => {
            const schema = makeSchema([
                makeArrayField('tags', 'string', { description: 'User tags' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('tags: array: User tags');
            expect(output).toContain('  - string');
        });

        it('serializes array with complex item type (inline object)', () => {
            const schema = makeSchema([
                makeArrayField('items', makeObjectField('', [
                    makeStringField('name', { required: true, description: 'Name' }),
                    makeNumberField('quantity', { required: true, description: 'Qty' }),
                ]), { required: true, description: 'Order items' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('items: array.required: Order items');
            expect(output).toContain('  - object:');
            expect(output).toContain('      name: string.required: Name');
            expect(output).toContain('      quantity: number.required: Qty');
        });

        it('serializes array with minItems/maxItems', () => {
            const schema = makeSchema([
                makeArrayField('tags', 'string', {
                    description: 'Tags',
                    minItems: 1,
                    maxItems: 10,
                }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('  ^ minItems: 1');
            expect(output).toContain('  ^ maxItems: 10');
        });

        it('serializes array with uniqueItems', () => {
            const schema = makeSchema([
                makeArrayField('ids', 'string', {
                    description: 'Unique IDs',
                    uniqueItems: true,
                }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('  ^ uniqueItems: true');
        });
    });

    describe('tuples', () => {
        it('serializes tuple with multiple item types', () => {
            const schema = makeSchema([
                makeTupleField('coords', [
                    makeNumberField('', { description: 'latitude' }),
                    makeNumberField('', { description: 'longitude' }),
                    makeNumberField('', { description: 'altitude' }),
                ], { description: 'GPS coordinates' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('coords: array.tuple: GPS coordinates');
            expect(output).toContain('  - number: latitude');
            expect(output).toContain('  - number: longitude');
            expect(output).toContain('  - number: altitude');
        });

        it('serializes tuple items without description', () => {
            const schema = makeSchema([
                makeTupleField('pair', [
                    makeStringField(''),
                    makeNumberField(''),
                ], { description: 'A pair' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('  - string');
            expect(output).toContain('  - number');
        });
    });

    describe('maps', () => {
        it('serializes map with primitive value type', () => {
            const schema = makeSchema([
                makeMapField('metadata', 'string', { description: 'Key-value metadata' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('metadata: map: Key-value metadata');
            expect(output).toContain('  - string');
        });

        it('serializes map with object value type', () => {
            const schema = makeSchema([
                makeMapField('headers', makeObjectField('', [
                    makeStringField('value', { required: true, description: 'Header value' }),
                ]), { description: 'HTTP headers' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('headers: map: HTTP headers');
            expect(output).toContain('  - object:');
            expect(output).toContain('      value: string.required: Header value');
        });

        it('serializes map with $ref value type', () => {
            const schema = makeSchema([
                makeMapField('configs', makeRefField('', '#/$defs/Config'), { description: 'Named configs' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('configs: map: Named configs');
            expect(output).toContain('  - $ref: #/$defs/Config');
        });
    });

    describe('$defs', () => {
        it('serializes $defs block with definitions', () => {
            const schema = makeSchema([], [
                {
                    name: 'Address',
                    field: makeObjectField('Address', [
                        makeStringField('street', { required: true, description: 'Street address' }),
                        makeStringField('city', { required: true, description: 'City' }),
                    ], { description: 'Shipping or billing address' }),
                },
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('$defs:');
            expect(output).toContain('  Address: object: Shipping or billing address');
            expect(output).toContain('    street: string.required: Street address');
            expect(output).toContain('    city: string.required: City');
        });

        it('serializes blank line between $defs and root fields', () => {
            const schema = makeSchema(
                [makeStringField('name', { required: true, description: 'Name' })],
                [{
                    name: 'Type',
                    field: makeStringField('Type', { description: 'A type' }),
                }],
            );
            const output = exportClearSchema(schema);

            const lines = output.split('\n');
            // Find the last $defs content line and the first root field line
            const defsEnd = lines.findIndex((l, i) => i > 0 && !l.startsWith('  ') && l !== '$defs:' && l !== '');
            // There should be a blank line before the first root field
            expect(lines[defsEnd - 1]).toBe('');
        });

        it('serializes multiple definitions', () => {
            const schema = makeSchema([], [
                {
                    name: 'Foo',
                    field: makeStringField('Foo', { description: 'Foo type' }),
                },
                {
                    name: 'Bar',
                    field: makeNumberField('Bar', { description: 'Bar type' }),
                },
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('$defs:');
            expect(output).toContain('  Foo: string: Foo type');
            expect(output).toContain('  Bar: number: Bar type');
        });
    });

    describe('$ref fields', () => {
        it('serializes $ref field', () => {
            const schema = makeSchema([
                makeRefField('user', '#/$defs/User'),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('user: $ref: #/$defs/User');
        });

        it('serializes $ref field — description is dropped (ref path occupies description slot)', () => {
            const schema = makeSchema([
                makeRefField('user', '#/$defs/User', { description: 'A user reference' }),
            ]);
            const output = exportClearSchema(schema);

            // Ref path should be in the description position, actual description is lost
            expect(output).toContain('user: $ref: #/$defs/User');
            expect(output).not.toContain('A user reference');
        });
    });

    describe('union types', () => {
        it('serializes union with pipe syntax', () => {
            const schema = makeSchema([
                makeUnionField('id', ['string', 'number'], { description: 'Flexible identifier' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('id: string|number: Flexible identifier');
        });

        it('serializes union with three types', () => {
            const schema = makeSchema([
                makeUnionField('value', ['string', 'number', 'boolean'], { description: 'Value' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('value: string|number|boolean: Value');
        });
    });

    describe('composition types', () => {
        it('serializes allOf with $ref items', () => {
            const schema = makeSchema([
                makeCompositionField('admin', 'allOf', [
                    makeRefField('', '#/$defs/User'),
                    makeObjectField('', [
                        makeStringField('role', { required: true, description: 'Role' }),
                    ]),
                ], { description: 'Admin user' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('admin: allOf: Admin user');
            expect(output).toContain('  - $ref: #/$defs/User');
            expect(output).toContain('  - object:');
            expect(output).toContain('      role: string.required: Role');
        });

        it('serializes anyOf composition', () => {
            const schema = makeSchema([
                makeCompositionField('value', 'anyOf', [
                    makeStringField('', { description: 'A string' }),
                    makeNumberField('', { description: 'A number' }),
                ], { description: 'Either type' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('value: anyOf: Either type');
            expect(output).toContain('  - string: A string');
            expect(output).toContain('  - number: A number');
        });

        it('serializes oneOf composition', () => {
            const schema = makeSchema([
                makeCompositionField('payment', 'oneOf', [
                    makeRefField('', '#/$defs/CreditCard'),
                    makeRefField('', '#/$defs/BankTransfer'),
                ], { description: 'Payment method' }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('payment: oneOf: Payment method');
            expect(output).toContain('  - $ref: #/$defs/CreditCard');
            expect(output).toContain('  - $ref: #/$defs/BankTransfer');
        });
    });

    describe('universal modifiers (enum, const, default)', () => {
        it('serializes enum modifier', () => {
            const schema = makeSchema([
                makeStringField('status', {
                    required: true,
                    description: 'Status',
                    enum: ['active', 'inactive', 'pending'],
                }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('  ^ enum: [active, inactive, pending]');
        });

        it('serializes const modifier', () => {
            const schema = makeSchema([
                makeStringField('type', {
                    description: 'Type',
                    const: 'fixed',
                }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('  ^ const: fixed');
        });

        it('serializes default modifier', () => {
            const schema = makeSchema([
                makeBooleanField('active', {
                    description: 'Active',
                    default: true,
                }),
            ]);
            const output = exportClearSchema(schema);

            expect(output).toContain('  ^ default: true');
        });
    });

    describe('empty schema', () => {
        it('returns empty string for schema with no fields and no defs', () => {
            const schema = makeSchema([]);
            const output = exportClearSchema(schema);

            expect(output).toBe('');
        });
    });

    describe('class interface', () => {
        it('ClearSchemaSerializer implements Exporter<string>', () => {
            const serializer = new ClearSchemaSerializer();
            const schema = makeSchema([
                makeStringField('name', { required: true, description: 'Name' }),
            ]);
            const output = serializer.export(schema);

            expect(typeof output).toBe('string');
            expect(output).toContain('name: string.required: Name');
        });
    });

    describe('round-trip with parser', () => {
        it('round-trips a simple schema through serialize -> parse', () => {
            const original = makeSchema([
                makeObjectField('user', [
                    makeStringField('name', { required: true, description: 'Full name' }),
                    makeStringField('email', { required: true, description: 'Email address' }),
                    makeNumberField('age', { description: 'Age in years' }),
                ], { required: true, description: 'User profile' }),
            ]);

            const clearText = exportClearSchema(original);
            const reparsed = parse(clearText);

            expect(reparsed.fields.length).toBe(1);
            const user = reparsed.fields[0] as ObjectField;
            expect(user.name).toBe('user');
            expect(user.type).toBe('object');
            expect(user.required).toBe(true);
            expect(user.description).toBe('User profile');
            expect(user.fields.length).toBe(3);
            expect(user.fields[0].name).toBe('name');
            expect(user.fields[1].name).toBe('email');
            expect(user.fields[2].name).toBe('age');
        });

        it('round-trips a schema with $defs and $ref', () => {
            const original = makeSchema(
                [makeRefField('user', '#/$defs/User')],
                [{
                    name: 'User',
                    field: makeObjectField('User', [
                        makeStringField('name', { required: true, description: 'Name' }),
                    ], { description: 'User schema' }),
                }],
            );

            const clearText = exportClearSchema(original);
            const reparsed = parse(clearText);

            expect(reparsed.definitions.length).toBe(1);
            expect(reparsed.definitions[0].name).toBe('User');
            expect(reparsed.fields.length).toBe(1);
            expect(reparsed.fields[0].type).toBe('ref');
            expect((reparsed.fields[0] as RefField).ref).toBe('#/$defs/User');
        });

        it('round-trips arrays with modifiers', () => {
            const original = makeSchema([
                makeArrayField('tags', 'string', {
                    description: 'User tags',
                    minItems: 0,
                    maxItems: 10,
                }),
            ]);

            const clearText = exportClearSchema(original);
            const reparsed = parse(clearText);

            const field = reparsed.fields[0] as ArrayField;
            expect(field.type).toBe('array');
            expect(field.itemType).toBe('string');
            expect(field.minItems).toBe(0);
            expect(field.maxItems).toBe(10);
        });

        it('round-trips string constraints', () => {
            const original = makeSchema([
                makeStringField('name', {
                    required: true,
                    description: 'Full name',
                    minLength: 2,
                    maxLength: 100,
                }),
            ]);

            const clearText = exportClearSchema(original);
            const reparsed = parse(clearText);

            const field = reparsed.fields[0] as StringField;
            expect(field.minLength).toBe(2);
            expect(field.maxLength).toBe(100);
        });

        it('round-trips enum modifier', () => {
            const original = makeSchema([
                makeStringField('status', {
                    required: true,
                    description: 'Order status',
                    enum: ['pending', 'processing', 'shipped'],
                }),
            ]);

            const clearText = exportClearSchema(original);
            const reparsed = parse(clearText);

            const field = reparsed.fields[0];
            expect(field.enum).toEqual(['pending', 'processing', 'shipped']);
        });

        it('round-trips the ecommerce example pattern', () => {
            const addressField = makeObjectField('Address', [
                makeStringField('street', { required: true, description: 'Street address' }),
                makeStringField('city', { required: true, description: 'City' }),
                makeStringField('zipCode', { required: true, description: 'Postal code', pattern: '^\\d{5}(-\\d{4})?$' }),
            ], { description: 'Shipping or billing address' });

            const schema = makeSchema(
                [
                    makeObjectField('order', [
                        makeStringField('orderId', { required: true, description: 'Unique order ID', format: 'uuid' }),
                        makeRefField('customer', '#/$defs/Address'),
                        makeNumberField('total', { required: true, description: 'Order total', min: 0 }),
                    ], { required: true, description: 'E-commerce order' }),
                ],
                [{ name: 'Address', field: addressField }],
            );

            const clearText = exportClearSchema(schema);
            const reparsed = parse(clearText);

            expect(reparsed.definitions.length).toBe(1);
            expect(reparsed.definitions[0].name).toBe('Address');
            expect(reparsed.fields.length).toBe(1);
            const order = reparsed.fields[0] as ObjectField;
            expect(order.name).toBe('order');
            expect(order.fields.length).toBe(3);
        });
    });
});
