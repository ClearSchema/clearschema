import * as fs from 'fs';
import * as path from 'path';
import { parse } from '../../src/parser/parser';
import { exportJsonSchema } from '../../src/exporters/json-schema';
import { importJsonSchema } from '../../src/importers/json-schema';
import { exportClearSchema } from '../../src/exporters/clearschema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const examplesDir = path.join(__dirname, '../../../examples');

/**
 * Deep-clone an object and strip `location`, `modifiers`, and `rawModifiers`
 * fields so that ASTs produced by the parser and the importer can be compared
 * structurally.
 */
function stripLocationsAndModifiers(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
        return obj.map(stripLocationsAndModifiers);
    }
    if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'location' || key === 'modifiers' || key === 'rawModifiers') {
                continue;
            }
            // Skip undefined values so parsed AST (with explicit undefined props)
            // matches imported AST (with absent props)
            if (value === undefined) {
                continue;
            }
            result[key] = stripLocationsAndModifiers(value);
        }
        return result;
    }
    return obj;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration Tests - Import Round-trip', () => {
    describe('.clear -> JSON Schema -> import -> AST comparison', () => {
        it('user.clear round-trip', () => {
            const source = fs.readFileSync(path.join(examplesDir, 'user.clear'), 'utf-8');
            const originalAst = parse(source);
            expect(originalAst.errors).toBeUndefined();

            const jsonSchema = exportJsonSchema(originalAst);
            const { schema: importedAst } = importJsonSchema(jsonSchema);

            const strippedOriginal = stripLocationsAndModifiers(originalAst);
            const strippedImported = stripLocationsAndModifiers(importedAst);

            // Fields should be structurally equivalent
            expect(strippedImported.fields).toEqual(strippedOriginal.fields);
        });

        it('ecommerce.clear round-trip', () => {
            const source = fs.readFileSync(path.join(examplesDir, 'ecommerce.clear'), 'utf-8');
            const originalAst = parse(source);
            expect(originalAst.errors).toBeUndefined();

            const jsonSchema = exportJsonSchema(originalAst);
            const { schema: importedAst } = importJsonSchema(jsonSchema);

            // Definitions should round-trip (same count and same names)
            expect(importedAst.definitions.length).toBe(originalAst.definitions.length);
            for (let i = 0; i < originalAst.definitions.length; i++) {
                expect(importedAst.definitions[i].name).toBe(originalAst.definitions[i].name);
            }

            // Fields should round-trip: same count, same names, same types
            expect(importedAst.fields.length).toBe(originalAst.fields.length);
            const strippedOriginal = stripLocationsAndModifiers(originalAst);
            const strippedImported = stripLocationsAndModifiers(importedAst);

            // Walk top-level fields and verify key structural properties
            for (let i = 0; i < strippedOriginal.fields.length; i++) {
                const orig = strippedOriginal.fields[i];
                const imp = strippedImported.fields[i];
                expect(imp.name).toBe(orig.name);
                expect(imp.type).toBe(orig.type);
                expect(imp.required).toBe(orig.required);
                expect(imp.description).toBe(orig.description);

                // For objects, verify nested field names and types recursively
                if (orig.type === 'object' && orig.fields) {
                    expect(imp.fields.length).toBe(orig.fields.length);
                    for (let j = 0; j < orig.fields.length; j++) {
                        expect(imp.fields[j].name).toBe(orig.fields[j].name);
                        expect(imp.fields[j].type).toBe(orig.fields[j].type);
                    }
                }
            }
        });

        it('maps.clear round-trip', () => {
            const source = fs.readFileSync(path.join(examplesDir, 'maps.clear'), 'utf-8');
            const originalAst = parse(source);
            expect(originalAst.errors).toBeUndefined();

            const jsonSchema = exportJsonSchema(originalAst);
            const { schema: importedAst } = importJsonSchema(jsonSchema);

            const strippedOriginal = stripLocationsAndModifiers(originalAst);
            const strippedImported = stripLocationsAndModifiers(importedAst);

            // Should have the same number of top-level fields
            expect(strippedImported.fields.length).toBe(strippedOriginal.fields.length);

            // Each field should have the same name and type
            for (let i = 0; i < strippedOriginal.fields.length; i++) {
                expect(strippedImported.fields[i].name).toBe(strippedOriginal.fields[i].name);
                expect(strippedImported.fields[i].type).toBe(strippedOriginal.fields[i].type);
            }
        });
    });

    describe('JSON Schema -> import -> serialize -> parse -> AST comparison', () => {
        it('full pipeline round-trip with hand-crafted JSON Schema', () => {
            const jsonSchema = {
                type: 'object' as const,
                properties: {
                    user: {
                        type: 'object' as const,
                        description: 'A user record',
                        required: ['name', 'email'],
                        properties: {
                            name: {
                                type: 'string' as const,
                                description: 'Full name',
                                minLength: 1,
                                maxLength: 200,
                            },
                            email: {
                                type: 'string' as const,
                                description: 'Email address',
                                format: 'email',
                            },
                            age: {
                                type: 'integer' as const,
                                description: 'Age in years',
                                minimum: 0,
                                maximum: 150,
                            },
                            active: {
                                type: 'boolean' as const,
                                description: 'Is active',
                                default: true,
                            },
                            tags: {
                                type: 'array' as const,
                                description: 'User tags',
                                items: { type: 'string' as const },
                                uniqueItems: true,
                            },
                        },
                    },
                },
                required: ['user'],
            };

            // Import JSON Schema -> AST
            const { schema: importedAst } = importJsonSchema(jsonSchema);

            // Serialize AST -> ClearSchema DSL
            const clearText = exportClearSchema(importedAst);

            // Parse ClearSchema DSL -> AST
            const parsedAst = parse(clearText);
            expect(parsedAst.errors).toBeUndefined();

            // Compare stripped ASTs
            const strippedImported = stripLocationsAndModifiers(importedAst);
            const strippedParsed = stripLocationsAndModifiers(parsedAst);

            expect(strippedParsed.fields).toEqual(strippedImported.fields);
        });
    });

    describe('Discriminated union (match) round-trip', () => {
        it('.clear with match → JSON Schema → import → MatchField', () => {
            const clearSource = [
                'event: match(type): UI event',
                '  click:',
                '    x: number.required: X coordinate',
                '    y: number.required: Y coordinate',
                '  keypress:',
                '    key: string.required: Key pressed',
                '',
            ].join('\n');

            const originalAst = parse(clearSource);
            expect(originalAst.errors).toBeUndefined();

            // Export to JSON Schema
            const jsonSchema = exportJsonSchema(originalAst);

            // Import back
            const { schema: importedAst } = importJsonSchema(jsonSchema);

            // Verify the MatchField structure
            expect(importedAst.fields.length).toBe(1);
            const event = importedAst.fields[0] as any;
            expect(event.type).toBe('match');
            expect(event.discriminator).toBe('type');
            expect(Object.keys(event.variants)).toEqual(['click', 'keypress']);

            const click = event.variants['click'];
            expect(click.type).toBe('object');
            expect(click.fields.map((f: any) => f.name)).toEqual(['x', 'y']);

            const keypress = event.variants['keypress'];
            expect(keypress.type).toBe('object');
            expect(keypress.fields.map((f: any) => f.name)).toEqual(['key']);
        });
    });

    describe('Draft-07 specific handling', () => {
        it('normalizes definitions and tuple syntax from draft-07', () => {
            const draft07Schema = {
                $schema: 'http://json-schema.org/draft-07/schema#',
                definitions: {
                    Coordinate: {
                        type: 'object' as const,
                        properties: {
                            lat: { type: 'number' as const, description: 'Latitude' },
                            lng: { type: 'number' as const, description: 'Longitude' },
                        },
                        required: ['lat', 'lng'],
                    },
                },
                type: 'object' as const,
                properties: {
                    location: {
                        $ref: '#/definitions/Coordinate',
                    },
                    bounds: {
                        type: 'array' as const,
                        items: [
                            { type: 'number' as const, description: 'min' },
                            { type: 'number' as const, description: 'max' },
                        ],
                        additionalItems: false,
                    },
                },
                required: ['location'],
            };

            const { schema } = importJsonSchema(draft07Schema);

            // definitions should be normalized into schema.definitions
            expect(schema.definitions.length).toBe(1);
            expect(schema.definitions[0].name).toBe('Coordinate');

            // The $ref field should be present
            const locationField = schema.fields.find(f => f.name === 'location');
            expect(locationField).toBeDefined();
            expect(locationField!.type).toBe('ref');

            // The tuple array should be recognized
            const boundsField = schema.fields.find(f => f.name === 'bounds');
            expect(boundsField).toBeDefined();
            expect(boundsField!.type).toBe('array.tuple');
        });
    });

    describe('Unsupported keywords', () => {
        it('warns on patternProperties and if/then/else but imports supported fields', () => {
            const jsonSchema = {
                type: 'object' as const,
                properties: {
                    name: {
                        type: 'string' as const,
                        description: 'The name',
                        minLength: 1,
                    },
                    value: {
                        type: 'number' as const,
                        description: 'A value',
                    },
                },
                required: ['name'],
                patternProperties: {
                    '^x-': { type: 'string' },
                },
                if: {
                    properties: { name: { const: 'special' } },
                },
                then: {
                    required: ['value'],
                },
                else: {},
            };

            const { schema, warnings } = importJsonSchema(jsonSchema);

            // Should produce warnings about unsupported keywords
            expect(warnings.length).toBeGreaterThan(0);
            const warningText = warnings.join(' ');
            expect(warningText).toMatch(/patternProperties/);

            // Supported fields should still be imported correctly
            const nameField = schema.fields.find(f => f.name === 'name');
            expect(nameField).toBeDefined();
            expect(nameField!.type).toBe('string');
            expect(nameField!.required).toBe(true);

            const valueField = schema.fields.find(f => f.name === 'value');
            expect(valueField).toBeDefined();
            expect(valueField!.type).toBe('number');
        });
    });
});
