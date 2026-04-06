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
    MatchField,
} from '../ast/types';
import { Exporter, JsonSchema, JsonSchemaField, JsonSchemaExportOptions } from './types';

export class JsonSchemaExporter implements Exporter<JsonSchema> {
    export(schema: Schema, options?: JsonSchemaExportOptions): JsonSchema {
        const schemaVersion = options?.schemaVersion ?? '2020-12';

        const result: JsonSchema = {
            $schema: this.getSchemaUri(schemaVersion),
            type: 'object',
            properties: {},
            required: [],
        };

        if (options?.rootId) {
            result.$id = options.rootId;
        }

        // Export definitions
        if (schema.definitions.length > 0) {
            result.$defs = {};
            for (const def of schema.definitions) {
                result.$defs[def.name] = this.exportField(def.field, options);
            }
        }

        // Export fields
        for (const field of schema.fields) {
            result.properties![field.name] = this.exportField(field, options);
            if (field.required) {
                result.required!.push(field.name);
            }
        }

        // Clean up empty arrays
        if (result.required!.length === 0) {
            delete result.required;
        }

        return result;
    }

    private getSchemaUri(version: string): string {
        switch (version) {
            case '2020-12':
                return 'https://json-schema.org/draft/2020-12/schema';
            case '2019-09':
                return 'https://json-schema.org/draft/2019-09/schema';
            case 'draft-07':
                return 'http://json-schema.org/draft-07/schema#';
            default:
                return 'https://json-schema.org/draft/2020-12/schema';
        }
    }

    private exportField(field: Field, options?: JsonSchemaExportOptions): JsonSchemaField {
        // Handle nullable
        if (field.nullable) {
            return this.exportNullable(field, options);
        }

        switch (field.type) {
            case 'string':
                return this.exportString(field, options);
            case 'number':
            case 'integer':
                return this.exportNumber(field, options);
            case 'boolean':
                return this.exportBoolean(field, options);
            case 'null':
                return this.exportNull(field, options);
            case 'object':
                return this.exportObject(field, options);
            case 'array':
                return this.exportArray(field, options);
            case 'map':
                return this.exportMap(field, options);
            case 'array.tuple':
                return this.exportTuple(field, options);
            case 'union':
                return this.exportUnion(field, options);
            case 'ref':
                return this.exportRef(field, options);
            case 'allOf':
            case 'anyOf':
            case 'oneOf':
                return this.exportComposition(field, options);
            case 'match':
                return this.exportMatch(field, options);
            default:
                return { type: 'object' };
        }
    }

    private exportString(field: StringField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {
            type: 'string',
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        if (field.minLength !== undefined) result.minLength = field.minLength;
        if (field.maxLength !== undefined) result.maxLength = field.maxLength;
        if (field.pattern !== undefined) result.pattern = field.pattern;
        if (field.format !== undefined) result.format = field.format;

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportNumber(field: NumberField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {
            type: field.type,
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        if (field.min !== undefined) result.minimum = field.min;
        if (field.max !== undefined) result.maximum = field.max;
        if (field.exclusiveMin !== undefined) result.exclusiveMinimum = field.exclusiveMin;
        if (field.exclusiveMax !== undefined) result.exclusiveMaximum = field.exclusiveMax;
        if (field.multipleOf !== undefined) result.multipleOf = field.multipleOf;

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportBoolean(field: Field, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {
            type: 'boolean',
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportNull(field: Field, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;

        const result: JsonSchemaField = {
            type: 'null',
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        return result;
    }

    private exportObject(field: ObjectField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {
            type: 'object',
            properties: {},
            required: [],
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        for (const childField of field.fields) {
            result.properties![childField.name] = this.exportField(childField, options);
            if (childField.required) {
                result.required!.push(childField.name);
            }
        }

        if (result.required!.length === 0) {
            delete result.required;
        }

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportArray(field: ArrayField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {
            type: 'array',
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        // Export item type
        if (typeof field.itemType === 'string') {
            result.items = { type: field.itemType };
        } else {
            result.items = this.exportField(field.itemType, options);
        }

        if (field.minItems !== undefined) result.minItems = field.minItems;
        if (field.maxItems !== undefined) result.maxItems = field.maxItems;
        if (field.uniqueItems !== undefined) result.uniqueItems = field.uniqueItems;

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportMap(field: MapField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {
            type: 'object',
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        // Export value type as additionalProperties
        if (typeof field.valueType === 'string') {
            result.additionalProperties = { type: field.valueType };
        } else {
            result.additionalProperties = this.exportField(field.valueType, options);
        }

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportTuple(field: TupleArrayField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {
            type: 'array',
            prefixItems: [],
            items: false,
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        for (const item of field.items) {
            result.prefixItems!.push(this.exportField(item, options));
        }

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportUnion(field: UnionField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {
            anyOf: [],
        };

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        for (const type of field.types) {
            result.anyOf!.push({ type: type as string });
        }

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportRef(field: RefField, _options?: JsonSchemaExportOptions): JsonSchemaField {
        const result: JsonSchemaField = {
            $ref: field.ref,
        };

        return result;
    }

    private exportComposition(field: CompositionField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {};

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        const schemas: JsonSchemaField[] = [];
        for (const schema of field.schemas) {
            schemas.push(this.exportField(schema, options));
        }

        result[field.type] = schemas;

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportMatch(field: MatchField, options?: JsonSchemaExportOptions): JsonSchemaField {
        const includeDescriptions = options?.includeDescriptions ?? true;
        const includeDefaults = options?.includeDefaults ?? true;

        const result: JsonSchemaField = {};

        if (includeDescriptions && field.description) {
            result.description = field.description;
        }

        const schemas: JsonSchemaField[] = [];
        for (const [variantKey, variant] of Object.entries(field.variants)) {
            if (variant.type === 'ref') {
                schemas.push(this.exportRef(variant, options));
            } else {
                // Inline ObjectField variant: export as object and inject discriminator
                const exported = this.exportObject(variant, options);
                exported.properties = exported.properties ?? {};
                exported.properties[field.discriminator] = { const: variantKey };
                exported.required = exported.required ?? [];
                if (!exported.required.includes(field.discriminator)) {
                    exported.required.push(field.discriminator);
                }
                schemas.push(exported);
            }
        }

        result.oneOf = schemas;

        this.addUniversalModifiers(result, field, includeDefaults);

        return result;
    }

    private exportNullable(field: Field, options?: JsonSchemaExportOptions): JsonSchemaField {
        // Create a copy of the field without nullable
        const fieldCopy = { ...field, nullable: false };

        const baseField = this.exportField(fieldCopy as Field, options);

        return {
            anyOf: [
                baseField,
                { type: 'null' },
            ],
        };
    }

    private addUniversalModifiers(result: JsonSchemaField, field: Field, includeDefaults: boolean): void {
        if (field.const !== undefined) {
            result.const = field.const;
        }

        if (field.enum !== undefined) {
            result.enum = field.enum;
        }

        if (includeDefaults && field.default !== undefined) {
            result.default = field.default;
        }
    }
}

export function exportJsonSchema(schema: Schema, options?: JsonSchemaExportOptions): JsonSchema {
    const exporter = new JsonSchemaExporter();
    return exporter.export(schema, options);
}
