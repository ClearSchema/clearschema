import { parse } from '../../../src/parser/parser';
import { exportLlmSchema } from '../../../src/exporters/llm-structured-output';

describe('LLM Structured Output Exporter', () => {
    describe('strict object enforcement', () => {
        it('sets additionalProperties: false and all props in required', () => {
            const schema = parse(`name: string: Name
age: number: Age`);
            const result = exportLlmSchema(schema);

            expect(result.schema.type).toBe('object');
            expect(result.schema.additionalProperties).toBe(false);
            expect(result.schema.required).toEqual(
                expect.arrayContaining(['name', 'age'])
            );
            expect(result.schema.required).toHaveLength(2);
        });

        it('enforces strict objects on nested objects', () => {
            const schema = parse(`address: object: Address
  street: string: Street
  city: string: City`);
            const result = exportLlmSchema(schema);

            const addr = result.schema.properties.address;
            expect(addr.type).toBe('object');
            expect(addr.additionalProperties).toBe(false);
            expect(addr.required).toEqual(
                expect.arrayContaining(['street', 'city'])
            );
        });
    });

    describe('$ref inlining', () => {
        it('inlines $ref to $defs and removes $defs block', () => {
            const schema = parse(`$defs:
  Address: object: Address
    street: string: Street
    city: string: City

home: $ref: #/$defs/Address`);
            const result = exportLlmSchema(schema);

            // No $ref should remain
            expect(JSON.stringify(result.schema)).not.toContain('$ref');
            // No $defs should remain
            expect(result.schema.$defs).toBeUndefined();
            // The inlined object should have properties
            expect(result.schema.properties.home.type).toBe('object');
            expect(result.schema.properties.home.properties.street).toBeDefined();
            expect(result.schema.properties.home.additionalProperties).toBe(false);
        });

        it('throws error on circular $ref', () => {
            const schema = parse(`$defs:
  A: object: Type A
    b: $ref: #/$defs/B

  B: object: Type B
    a: $ref: #/$defs/A

root: $ref: #/$defs/A`);
            expect(() => exportLlmSchema(schema)).toThrow(
                'Recursive schemas are not supported in LLM structured output mode'
            );
        });
    });

    describe('enum and union preservation', () => {
        it('preserves enum field', () => {
            const schema = parse(`status: string: Status
  ^ enum: ["active", "inactive"]`);
            const result = exportLlmSchema(schema);

            expect(result.schema.properties.status.enum).toEqual([
                'active',
                'inactive',
            ]);
        });

        it('preserves anyOf union', () => {
            const schema = parse('value: string | number: A value');
            const result = exportLlmSchema(schema);

            expect(result.schema.properties.value.anyOf).toBeDefined();
            expect(result.schema.properties.value.anyOf).toHaveLength(2);
        });
    });

    describe('unsupported keyword stripping', () => {
        it('strips minLength, pattern, default and populates warnings', () => {
            const schema = parse(`name: string: Name
  ^ minLength: 3
  ^ pattern: "^[a-z]+$"
  ^ default: "foo"`);
            const result = exportLlmSchema(schema);

            expect(result.schema.properties.name.minLength).toBeUndefined();
            expect(result.schema.properties.name.pattern).toBeUndefined();
            expect(result.schema.properties.name.default).toBeUndefined();

            const warningTexts = result.warnings.join('; ');
            expect(warningTexts).toContain("'minLength'");
            expect(warningTexts).toContain("'pattern'");
            expect(warningTexts).toContain("'default'");
        });
    });

    describe('nesting depth validation', () => {
        it('passes with 5 levels of object nesting', () => {
            // Level 1: root, Level 2: a, Level 3: b, Level 4: c, Level 5: d
            const schema = parse(`a: object: L2
  b: object: L3
    c: object: L4
      d: object: L5
        name: string: Name`);
            const result = exportLlmSchema(schema);

            const depthWarnings = result.warnings.filter((w) =>
                w.includes('nesting depth')
            );
            expect(depthWarnings).toHaveLength(0);
        });

        it('warns when exceeding 5 levels of object nesting', () => {
            // Level 1: root, Level 2: a, Level 3: b, Level 4: c, Level 5: d, Level 6: e
            const schema = parse(`a: object: L2
  b: object: L3
    c: object: L4
      d: object: L5
        e: object: L6
          name: string: Name`);
            const result = exportLlmSchema(schema);

            const depthWarnings = result.warnings.filter((w) =>
                w.includes('nesting depth')
            );
            expect(depthWarnings).toHaveLength(1);
            expect(depthWarnings[0]).toContain('6');
        });
    });

    describe('full pipeline', () => {
        it('parse DSL -> resolve -> export -> validate no $ref in output', () => {
            const schema = parse(`$defs:
  Address: object: Address
    street: string.required: Street
    city: string.required: City
      ^ minLength: 1

  User: object: User
    name: string.required: Name
    address: $ref: #/$defs/Address

user: $ref: #/$defs/User`);

            const result = exportLlmSchema(schema);

            // No $ref anywhere in output
            const serialized = JSON.stringify(result.schema);
            expect(serialized).not.toContain('$ref');
            expect(serialized).not.toContain('$defs');

            // Structure is correct
            expect(result.schema.properties.user.type).toBe('object');
            expect(result.schema.properties.user.properties.name).toBeDefined();
            expect(
                result.schema.properties.user.properties.address.type
            ).toBe('object');
            expect(
                result.schema.properties.user.properties.address.additionalProperties
            ).toBe(false);

            // minLength was stripped
            expect(
                result.schema.properties.user.properties.address.properties.city
                    .minLength
            ).toBeUndefined();

            // Warnings include the dropped constraint
            expect(result.warnings.some((w) => w.includes("'minLength'"))).toBe(
                true
            );
        });
    });

    describe('property count validation', () => {
        it('warns when total property count exceeds maxProperties limit', () => {
            // Build a schema with many properties using a lower limit
            const schema = parse(`a: string: A
b: string: B
c: string: C
d: string: D
e: string: E`);
            const result = exportLlmSchema(schema, { maxProperties: 3 });

            const propWarnings = result.warnings.filter((w) =>
                w.includes('property count')
            );
            expect(propWarnings).toHaveLength(1);
            expect(propWarnings[0]).toContain('5');
            expect(propWarnings[0]).toContain('3');
        });

        it('does not warn when property count is within limit', () => {
            const schema = parse(`a: string: A
b: string: B`);
            const result = exportLlmSchema(schema, { maxProperties: 10 });

            const propWarnings = result.warnings.filter((w) =>
                w.includes('property count')
            );
            expect(propWarnings).toHaveLength(0);
        });
    });

    describe('map field omission', () => {
        it('omits map field from output and emits warning', () => {
            const schema = parse(`metadata: map: Metadata
  - string`);
            const result = exportLlmSchema(schema);

            expect(result.schema.properties.metadata).toBeUndefined();
            expect(result.warnings.some((w: string) => w.includes('map') && w.includes('metadata'))).toBe(true);
        });

        it('omits only map fields, preserves non-map fields', () => {
            const schema = parse(`name: string: Name
metadata: map: Metadata
  - string
age: number: Age`);
            const result = exportLlmSchema(schema);

            expect(result.schema.properties.name).toBeDefined();
            expect(result.schema.properties.age).toBeDefined();
            expect(result.schema.properties.metadata).toBeUndefined();
            expect(result.schema.required).toContain('name');
            expect(result.schema.required).toContain('age');
            expect(result.schema.required).not.toContain('metadata');
        });

        it('omits array of map field with warning', () => {
            const schema = parse(`items: array: Items
  - map:
      - string`);
            const result = exportLlmSchema(schema);

            expect(result.schema.properties.items).toBeUndefined();
            expect(result.warnings.some((w: string) => w.includes('map') && w.includes('items'))).toBe(true);
        });

        it('omits nullable map detected through anyOf wrapper', () => {
            const schema = parse(`metadata: map.nullable: Metadata
  - string`);
            const result = exportLlmSchema(schema);

            expect(result.schema.properties.metadata).toBeUndefined();
            expect(result.warnings.some((w: string) => w.includes('map') && w.includes('metadata'))).toBe(true);
        });

        it('produces empty properties and required when map is the only field', () => {
            const schema = parse(`metadata: map: Metadata
  - string`);
            const result = exportLlmSchema(schema);

            expect(result.schema.properties).toEqual({});
            expect(result.schema.required).toEqual([]);
        });

        it('omits map field from nested object', () => {
            const schema = parse(`outer: object: Outer
  name: string: Name
  tags: map: Tags
    - string`);
            const result = exportLlmSchema(schema);

            const outer = result.schema.properties.outer;
            expect(outer.properties.name).toBeDefined();
            expect(outer.properties.tags).toBeUndefined();
            expect(outer.required).toContain('name');
            expect(outer.required).not.toContain('tags');
        });

        it('omits $ref pointing to map definition after inlining', () => {
            const schema = parse(`$defs:
  Tags: map: Tags
    - string

tags: $ref: #/$defs/Tags`);
            const result = exportLlmSchema(schema);

            expect(result.schema.properties.tags).toBeUndefined();
            expect(result.warnings.some((w: string) => w.includes('map') && w.includes('tags'))).toBe(true);
        });

        it('output after map omission is valid strict-mode JSON Schema', () => {
            const schema = parse(`name: string: Name
metadata: map: Metadata
  - string
address: object: Address
  street: string: Street
  city: string: City`);
            const result = exportLlmSchema(schema);

            // metadata should be omitted
            expect(result.schema.properties.metadata).toBeUndefined();

            // Root object should be strict
            expect(result.schema.additionalProperties).toBe(false);
            expect(result.schema.required).toEqual(expect.arrayContaining(['name', 'address']));

            // Nested object should be strict
            const addr = result.schema.properties.address;
            expect(addr.additionalProperties).toBe(false);
            expect(addr.required).toEqual(expect.arrayContaining(['street', 'city']));

            // Every object with properties should have additionalProperties: false
            const checkStrict = (node: any): void => {
                if (node && typeof node === 'object' && !Array.isArray(node)) {
                    if (node.type === 'object' && node.properties) {
                        expect(node.additionalProperties).toBe(false);
                    }
                    for (const val of Object.values(node)) {
                        checkStrict(val);
                    }
                }
            };
            checkStrict(result.schema);
        });
    });
});
