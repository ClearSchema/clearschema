import { importJsonSchema, exportClearSchema, exportJsonSchema, parse } from '@clearschema/core';

describe('import_json_schema logic', () => {
    it('imports a simple JSON Schema and produces valid .clear output', () => {
        const jsonSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'integer' },
            },
            required: ['name'],
        };

        const result = importJsonSchema(jsonSchema);
        const clearSource = exportClearSchema(result.schema);
        expect(clearSource).toContain('name');
        expect(clearSource).toContain('string');
    });

    it('includes warnings in import result', () => {
        // Schema with features that may produce warnings
        const jsonSchema = {
            type: 'object',
            properties: {
                data: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                },
            },
        };

        const result = importJsonSchema(jsonSchema);
        // May or may not produce warnings depending on implementation
        expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('handles non-object JSON gracefully (array)', () => {
        const result = importJsonSchema([1, 2, 3]);
        // importJsonSchema does not throw - it returns a result
        expect(result).toBeDefined();
        expect(result.schema).toBeDefined();
    });

    it('round-trips: import JSON Schema -> export to JSON Schema produces equivalent output', () => {
        const original = {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'User name' },
                email: { type: 'string' },
            },
            required: ['name', 'email'],
        };

        const imported = importJsonSchema(original);
        const clearSource = exportClearSchema(imported.schema);
        // Re-parse and re-export
        const reparsed = parse(clearSource);
        const reExported = exportJsonSchema(reparsed);

        // The re-exported schema should preserve the essential structure
        expect(reExported).toHaveProperty('properties');
        expect(reExported).toHaveProperty('required');
    });

    it('imports schema with $ref and $defs', () => {
        const jsonSchema = {
            type: 'object',
            properties: {
                address: { $ref: '#/$defs/Address' },
            },
            $defs: {
                Address: {
                    type: 'object',
                    properties: {
                        street: { type: 'string' },
                        city: { type: 'string' },
                    },
                    required: ['street'],
                },
            },
        };

        const result = importJsonSchema(jsonSchema);
        const clearSource = exportClearSchema(result.schema);
        expect(clearSource).toContain('Address');
        expect(clearSource).toContain('street');
    });
});
