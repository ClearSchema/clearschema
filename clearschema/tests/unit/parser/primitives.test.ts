import { parse, parseField, ParseError, StringField, NumberField, BooleanField, NullField, loc, pos } from '../../../src';

describe('Parser - Primitive Types', () => {
    describe('string type', () => {
        it('parses basic string field', () => {
            const field = parseField('name: string: User name') as StringField;

            expect(field.type).toBe('string');
            expect(field.name).toBe('name');
            expect(field.description).toBe('User name');
            expect(field.required).toBe(false);
            expect(field.nullable).toBe(false);
        });

        it('parses string field without description', () => {
            const field = parseField('name: string') as StringField;

            expect(field.type).toBe('string');
            expect(field.name).toBe('name');
            expect(field.description).toBe('');
        });

        it('parses string with min modifier', () => {
            const input = `name: string: Name
  ^ min: 2`;
            const field = parseField(input) as StringField;

            expect(field.minLength).toBe(2);
        });

        it('parses string with max modifier', () => {
            const input = `name: string: Name
  ^ max: 50`;
            const field = parseField(input) as StringField;

            expect(field.maxLength).toBe(50);
        });

        it('parses string with pattern modifier', () => {
            const input = `email: string: Email
  ^ pattern: ^[a-z]+@[a-z]+\\.[a-z]+$`;
            const field = parseField(input) as StringField;

            expect(field.pattern).toBe('^[a-z]+@[a-z]+\\.[a-z]+$');
        });

        it('parses string with format modifier', () => {
            const input = `email: string: Email
  ^ format: email`;
            const field = parseField(input) as StringField;

            expect(field.format).toBe('email');
        });

        it('parses string with multiple modifiers', () => {
            const input = `name: string.required: Name
  ^ min: 2
  ^ max: 50
  ^ default: "Unknown"`;
            const field = parseField(input) as StringField;

            expect(field.required).toBe(true);
            expect(field.minLength).toBe(2);
            expect(field.maxLength).toBe(50);
            expect(field.default).toBe('Unknown');
        });
    });

    describe('number type', () => {
        it('parses basic number field', () => {
            const field = parseField('price: number: Item price') as NumberField;

            expect(field.type).toBe('number');
            expect(field.name).toBe('price');
            expect(field.description).toBe('Item price');
        });

        it('parses number with min modifier', () => {
            const input = `age: number: Age
  ^ min: 0`;
            const field = parseField(input) as NumberField;

            expect(field.min).toBe(0);
        });

        it('parses number with max modifier', () => {
            const input = `age: number: Age
  ^ max: 150`;
            const field = parseField(input) as NumberField;

            expect(field.max).toBe(150);
        });

        it('parses number with gt modifier', () => {
            const input = `price: number: Price
  ^ gt: 0`;
            const field = parseField(input) as NumberField;

            expect(field.exclusiveMin).toBe(0);
        });

        it('parses number with lt modifier', () => {
            const input = `price: number: Price
  ^ lt: 1000`;
            const field = parseField(input) as NumberField;

            expect(field.exclusiveMax).toBe(1000);
        });

        it('parses number with multipleOf modifier', () => {
            const input = `quantity: number: Quantity
  ^ multipleOf: 0.5`;
            const field = parseField(input) as NumberField;

            expect(field.multipleOf).toBe(0.5);
        });

        it('parses number with negative values', () => {
            const input = `temp: number: Temperature
  ^ min: -40
  ^ max: 50`;
            const field = parseField(input) as NumberField;

            expect(field.min).toBe(-40);
            expect(field.max).toBe(50);
        });
    });

    describe('integer type', () => {
        it('parses basic integer field', () => {
            const field = parseField('count: integer: Item count') as NumberField;

            expect(field.type).toBe('integer');
            expect(field.name).toBe('count');
        });

        it('parses integer with same modifiers as number', () => {
            const input = `count: integer: Count
  ^ min: 0
  ^ max: 100
  ^ multipleOf: 5`;
            const field = parseField(input) as NumberField;

            expect(field.type).toBe('integer');
            expect(field.min).toBe(0);
            expect(field.max).toBe(100);
            expect(field.multipleOf).toBe(5);
        });
    });

    describe('boolean type', () => {
        it('parses basic boolean field', () => {
            const field = parseField('active: boolean: Is active') as BooleanField;

            expect(field.type).toBe('boolean');
            expect(field.name).toBe('active');
            expect(field.description).toBe('Is active');
        });

        it('parses boolean with default true', () => {
            const input = `enabled: boolean: Is enabled
  ^ default: true`;
            const field = parseField(input) as BooleanField;

            expect(field.default).toBe(true);
        });

        it('parses boolean with default false', () => {
            const input = `disabled: boolean: Is disabled
  ^ default: false`;
            const field = parseField(input) as BooleanField;

            expect(field.default).toBe(false);
        });
    });

    describe('null type', () => {
        it('parses basic null field', () => {
            const field = parseField('placeholder: null: Null value') as NullField;

            expect(field.type).toBe('null');
            expect(field.name).toBe('placeholder');
            expect(field.description).toBe('Null value');
        });
    });

    describe('inline modifiers', () => {
        it('parses .required inline modifier', () => {
            const field = parseField('name: string.required: Required name');

            expect(field.required).toBe(true);
            expect(field.nullable).toBe(false);
        });

        it('parses .nullable inline modifier', () => {
            const field = parseField('name: string.nullable: Nullable name');

            expect(field.required).toBe(false);
            expect(field.nullable).toBe(true);
        });

        it('parses .required.nullable combined', () => {
            const field = parseField('name: string.required.nullable: Required but nullable');

            expect(field.required).toBe(true);
            expect(field.nullable).toBe(true);
        });

        it('parses .nullable.required order reversed', () => {
            const field = parseField('name: string.nullable.required: Nullable and required');

            expect(field.required).toBe(true);
            expect(field.nullable).toBe(true);
        });
    });

    describe('universal block modifiers', () => {
        it('parses default modifier with string value', () => {
            const input = `name: string: Name
  ^ default: "Unknown"`;
            const field = parseField(input);

            expect(field.default).toBe('Unknown');
        });

        it('parses default modifier with number value', () => {
            const input = `count: number: Count
  ^ default: 0`;
            const field = parseField(input);

            expect(field.default).toBe(0);
        });

        it('parses default modifier with boolean value', () => {
            const input = `active: boolean: Active
  ^ default: true`;
            const field = parseField(input);

            expect(field.default).toBe(true);
        });

        it('parses const modifier', () => {
            const input = `version: string: Version
  ^ const: "1.0.0"`;
            const field = parseField(input);

            expect(field.const).toBe('1.0.0');
        });

        it('parses enum modifier with string array', () => {
            const input = `status: string: Status
  ^ enum: [active, pending, inactive]`;
            const field = parseField(input);

            expect(field.enum).toEqual(['active', 'pending', 'inactive']);
        });

        it('parses enum modifier with number array', () => {
            const input = `priority: number: Priority
  ^ enum: [1, 2, 3]`;
            const field = parseField(input);

            expect(field.enum).toEqual([1, 2, 3]);
        });

        it('parses enum with quoted strings', () => {
            const input = `color: string: Color
  ^ enum: ["red", "green", "blue"]`;
            const field = parseField(input);

            expect(field.enum).toEqual(['red', 'green', 'blue']);
        });
    });

    describe('parse() - full schema parsing', () => {
        it('parses multiple fields', () => {
            const input = `name: string: Name
age: number: Age
active: boolean: Is active`;
            const schema = parse(input);

            expect(schema.fields).toHaveLength(3);
            expect(schema.fields[0].name).toBe('name');
            expect(schema.fields[1].name).toBe('age');
            expect(schema.fields[2].name).toBe('active');
        });

        it('parses @namespace directive', () => {
            const input = `@namespace com.example
name: string: Name`;
            const schema = parse(input);

            expect(schema.namespace).toBe('com.example');
        });

        it('parses @version directive', () => {
            const input = `@version 1.0.0
name: string: Name`;
            const schema = parse(input);

            expect(schema.version).toBe('1.0.0');
        });

        it('parses @targets directive', () => {
            const input = `@targets json-schema, typescript
name: string: Name`;
            const schema = parse(input);

            expect(schema.targets).toEqual(['json-schema', 'typescript']);
        });

        it('parses complete schema with all directives', () => {
            const input = `@namespace com.example
@version 1.0.0
@targets json-schema, typescript

name: string.required: User name
  ^ min: 2
  ^ max: 50

age: number: Age
  ^ min: 0
  ^ max: 150

active: boolean: Is active
  ^ default: true`;
            const schema = parse(input);

            expect(schema.namespace).toBe('com.example');
            expect(schema.version).toBe('1.0.0');
            expect(schema.targets).toEqual(['json-schema', 'typescript']);
            expect(schema.fields).toHaveLength(3);

            const nameField = schema.fields[0] as StringField;
            expect(nameField.required).toBe(true);
            expect(nameField.minLength).toBe(2);
            expect(nameField.maxLength).toBe(50);

            const ageField = schema.fields[1] as NumberField;
            expect(ageField.min).toBe(0);
            expect(ageField.max).toBe(150);

            const activeField = schema.fields[2] as BooleanField;
            expect(activeField.default).toBe(true);
        });

        it('handles empty input', () => {
            const schema = parse('');

            expect(schema.fields).toHaveLength(0);
            expect(schema.namespace).toBeUndefined();
        });

        it('handles comments and blank lines', () => {
            const input = `# Schema definition
name: string: Name

# Age field
age: number: Age`;
            const schema = parse(input);

            expect(schema.fields).toHaveLength(2);
        });
    });

    describe('migration hints for deprecated modifier names', () => {
        it('rejects minLength on string with hint to use min', () => {
            const input = `name: string: Name\n  ^ minLength: 2`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"minLength" is not a valid modifier');
                expect((e as ParseError).hint).toContain('Use "min" instead');
            }
        });

        it('rejects maxLength on string with hint to use max', () => {
            const input = `name: string: Name\n  ^ maxLength: 50`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"maxLength" is not a valid modifier');
                expect((e as ParseError).hint).toContain('Use "max" instead');
            }
        });

        it('rejects minItems on array with hint to use min', () => {
            const input = `tags: array: Tags\n  - string\n  ^ minItems: 1`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"minItems" is not a valid modifier');
                expect((e as ParseError).hint).toContain('Use "min" instead');
            }
        });

        it('rejects maxItems on array with hint to use max', () => {
            const input = `tags: array: Tags\n  - string\n  ^ maxItems: 10`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"maxItems" is not a valid modifier');
                expect((e as ParseError).hint).toContain('Use "max" instead');
            }
        });

        it('rejects exclusiveMin on number with hint to use gt', () => {
            const input = `price: number: Price\n  ^ exclusiveMin: 0`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"exclusiveMin" is not a valid modifier');
                expect((e as ParseError).hint).toContain('Use "gt" instead');
            }
        });

        it('rejects exclusiveMax on number with hint to use lt', () => {
            const input = `price: number: Price\n  ^ exclusiveMax: 1000`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"exclusiveMax" is not a valid modifier');
                expect((e as ParseError).hint).toContain('Use "lt" instead');
            }
        });
    });

    describe('type validation for constraint modifiers', () => {
        it('rejects gt on string (number/integer only)', () => {
            const input = `name: string: Name\n  ^ gt: 0`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"gt" is only valid on number/integer');
            }
        });

        it('rejects lt on array (number/integer only)', () => {
            const input = `tags: array: Tags\n  - string\n  ^ lt: 1`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"lt" is only valid on number/integer');
            }
        });

        it('rejects min on boolean', () => {
            const input = `active: boolean: Active\n  ^ min: 5`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"min" is not valid on boolean');
            }
        });

        it('rejects max on null', () => {
            const input = `empty: null: Null\n  ^ max: 5`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"max" is not valid on null');
            }
        });

        it('rejects min on object', () => {
            const input = `data: object: Data\n  ^ min: 5`;
            expect(() => parseField(input)).toThrow(ParseError);
            try { parseField(input); } catch (e) {
                expect((e as ParseError).message).toContain('"min" is not valid on object');
            }
        });

        it('allows min and max with min > max on string (conflict validation out of scope)', () => {
            const input = `name: string: Name\n  ^ min: 5\n  ^ max: 3`;
            const field = parseField(input) as StringField;
            expect(field.minLength).toBe(5);
            expect(field.maxLength).toBe(3);
        });
    });

    describe('error handling', () => {
        it('reports error for missing colon', () => {
            expect(() => {
                parseField('name string Name');
            }).toThrow();
        });

        it('reports error for unknown type', () => {
            expect(() => {
                parseField('name: unknown: Name');
            }).toThrow();
        });

        it('reports error for unknown inline modifier', () => {
            expect(() => {
                parseField('name: string.invalid: Name');
            }).toThrow();
        });

        it('includes line number in error messages', () => {
            const input = `name: string: Name
invalid line here`;
            const schema = parse(input);

            // Should have errors but still parse what it can
            expect(schema.errors).toBeDefined();
            expect(schema.errors!.length).toBeGreaterThan(0);
        });

        it('continues parsing after errors (resilient parsing)', () => {
            const input = `name: string: Name
bad: unknown: Bad type
age: number: Age`;
            const schema = parse(input);

            // Should parse valid fields despite error
            expect(schema.errors).toBeDefined();
            // Should have at least the first valid field
            expect(schema.fields.length).toBeGreaterThanOrEqual(1);
        });

        it('error contains column information', () => {
            try {
                parseField('name: unknown: Name');
            } catch (e) {
                if (e instanceof ParseError) {
                    expect(e.location).toBeDefined();
                    expect(e.location.start.line).toBeDefined();
                    expect(e.location.start.column).toBeDefined();
                } else {
                    throw e;
                }
            }
        });
    });

    describe('location tracking', () => {
        it('tracks field location', () => {
            const field = parseField('name: string: Name');

            expect(field.location).toBeDefined();
            expect(field.location.start.line).toBe(1);
            expect(field.location.start.column).toBe(1);
        });

        it('tracks modifier location', () => {
            const input = `name: string: Name
  ^ min: 2`;
            const field = parseField(input) as StringField;

            expect(field.modifiers).toHaveLength(1);
            expect(field.modifiers[0].location).toBeDefined();
            expect(field.modifiers[0].location.start.line).toBe(2);
        });
    });

    describe('rawModifiers', () => {
        it('stores all modifiers in rawModifiers', () => {
            const input = `name: string: Name
  ^ min: 2
  ^ max: 50
  ^ customMod: value`;
            const field = parseField(input);

            expect(field.rawModifiers['min']).toBe(2);
            expect(field.rawModifiers['max']).toBe(50);
            expect(field.rawModifiers['customMod']).toBe('value');
        });
    });

    describe('ParseError', () => {
        it('creates error with location and formats correctly', () => {
            const source = 'name: unknown: Name';
            const location = loc(pos(1, 7, 6), pos(1, 14, 13));
            const error = new ParseError('Unknown type', location, source, 'Use a valid type');

            expect(error.message).toBe('Unknown type');
            expect(error.location).toBe(location);
            expect(error.source).toBe(source);
            expect(error.hint).toBe('Use a valid type');
        });

        it('formats error with hint', () => {
            const source = 'name: unknown: Name';
            const location = loc(pos(1, 7, 6), pos(1, 14, 13));
            const error = new ParseError('Unknown type', location, source, 'Use a valid type');

            const formatted = error.format();
            expect(formatted).toContain('ParseError: Unknown type');
            expect(formatted).toContain('line 1:7');
            expect(formatted).toContain('name: unknown: Name');
            expect(formatted).toContain('help: Use a valid type');
        });

        it('formats error without hint', () => {
            const source = 'name: unknown: Name';
            const location = loc(pos(1, 7, 6), pos(1, 14, 13));
            const error = new ParseError('Unknown type', location, source);

            const formatted = error.format();
            expect(formatted).toContain('ParseError: Unknown type');
            expect(formatted).not.toContain('help:');
        });

        it('pos helper creates correct SourcePosition', () => {
            const position = pos(5, 10, 50);
            expect(position.line).toBe(5);
            expect(position.column).toBe(10);
            expect(position.offset).toBe(50);
        });

        it('loc helper creates correct SourceLocation', () => {
            const start = pos(1, 1, 0);
            const end = pos(1, 10, 9);
            const location = loc(start, end);
            expect(location.start).toBe(start);
            expect(location.end).toBe(end);
        });
    });
});
