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
    FieldTypeName,
} from '../ast/types';
import { Exporter, ZodExportOptions } from './types';

export class ZodExporter implements Exporter<string> {
    private indent = '  ';

    export(schema: Schema, options?: ZodExportOptions): string {
        const includeDescriptions = options?.includeDescriptions ?? true;

        const lines: string[] = [];

        // Import statement
        lines.push("import { z } from 'zod';");
        lines.push('');

        // Export definitions first
        for (const def of schema.definitions) {
            const zodType = this.exportFieldType(def.field, includeDescriptions, 0);
            lines.push(`export const ${def.name}Schema = ${zodType};`);
            lines.push('');
        }

        // Export root fields as a single Schema const
        if (schema.fields.length > 0) {
            const objectBody = this.exportObjectFields(schema.fields, includeDescriptions, 0);
            lines.push(`export const Schema = z.object(${objectBody});`);
        }

        return lines.join('\n');
    }

    private exportFieldType(field: Field, includeDescriptions: boolean, depth: number): string {
        let base: string;

        // const overrides base type entirely
        if (field.const !== undefined) {
            base = `z.literal(${JSON.stringify(field.const)})`;
            return this.applyUniversalModifiers(base, field, includeDescriptions);
        }

        // enum replaces base type
        if (field.enum !== undefined && field.enum.length > 0) {
            base = this.exportEnum(field.enum);
            return this.applyUniversalModifiers(base, field, includeDescriptions);
        }

        switch (field.type) {
            case 'string':
                base = this.exportStringType(field as StringField);
                break;
            case 'number':
                base = this.exportNumberType(field as NumberField);
                break;
            case 'integer':
                base = this.exportIntegerType(field as NumberField);
                break;
            case 'boolean':
                base = 'z.boolean()';
                break;
            case 'null':
                base = 'z.null()';
                break;
            case 'object':
                base = this.exportObjectType(field as ObjectField, includeDescriptions, depth);
                break;
            case 'array':
                base = this.exportArrayType(field as ArrayField, includeDescriptions, depth);
                break;
            case 'map':
                base = this.exportMapType(field as MapField, includeDescriptions, depth);
                break;
            case 'array.tuple':
                base = this.exportTupleType(field as TupleArrayField, includeDescriptions, depth);
                break;
            case 'union':
                base = this.exportUnionType(field as UnionField);
                break;
            case 'ref':
                base = this.exportRefType(field as RefField);
                break;
            case 'allOf':
            case 'anyOf':
            case 'oneOf':
                base = this.exportCompositionType(field as CompositionField, includeDescriptions, depth);
                break;
            default:
                base = 'z.unknown()';
        }

        return this.applyUniversalModifiers(base, field, includeDescriptions);
    }

    private applyUniversalModifiers(base: string, field: Field, includeDescriptions: boolean): string {
        let result = base;

        if (field.nullable) {
            result += '.nullable()';
        }

        if (!field.required) {
            result += '.optional()';
        }

        if (field.default !== undefined) {
            result += `.default(${JSON.stringify(field.default)})`;
        }

        if (includeDescriptions && field.description) {
            result += `.describe(${JSON.stringify(field.description)})`;
        }

        return result;
    }

    private exportEnum(values: any[]): string {
        const allStrings = values.every(v => typeof v === 'string');
        if (allStrings) {
            return `z.enum([${values.map(v => JSON.stringify(v)).join(', ')}])`;
        }
        // Mixed enum: use union of literals
        const literals = values.map(v => `z.literal(${JSON.stringify(v)})`);
        return `z.union([${literals.join(', ')}])`;
    }

    private exportStringType(field: StringField): string {
        let result = 'z.string()';

        // Format-based validators (replace generic string validators)
        if (field.format === 'email') {
            result += '.email()';
        } else if (field.format === 'uri') {
            result += '.url()';
        } else if (field.format === 'uuid') {
            result += '.uuid()';
        } else if (field.format === 'datetime' || field.format === 'date-time') {
            result += '.datetime()';
        }
        // Other formats fall back to plain z.string()

        if (field.minLength !== undefined) {
            result += `.min(${field.minLength})`;
        }

        if (field.maxLength !== undefined) {
            result += `.max(${field.maxLength})`;
        }

        if (field.pattern !== undefined) {
            const escaped = field.pattern.replace(/\//g, '\\/');
            result += `.regex(/${escaped}/)`;
        }

        return result;
    }

    private exportNumberType(field: NumberField): string {
        let result = 'z.number()';

        if (field.min !== undefined) {
            result += `.min(${field.min})`;
        }

        if (field.exclusiveMin !== undefined) {
            result += `.gt(${field.exclusiveMin})`;
        }

        if (field.max !== undefined) {
            result += `.max(${field.max})`;
        }

        if (field.exclusiveMax !== undefined) {
            result += `.lt(${field.exclusiveMax})`;
        }

        if (field.multipleOf !== undefined) {
            result += `.multipleOf(${field.multipleOf})`;
        }

        return result;
    }

    private exportIntegerType(field: NumberField): string {
        let result = 'z.number().int()';

        if (field.min !== undefined) {
            result += `.min(${field.min})`;
        }

        if (field.exclusiveMin !== undefined) {
            result += `.gt(${field.exclusiveMin})`;
        }

        if (field.max !== undefined) {
            result += `.max(${field.max})`;
        }

        if (field.exclusiveMax !== undefined) {
            result += `.lt(${field.exclusiveMax})`;
        }

        if (field.multipleOf !== undefined) {
            result += `.multipleOf(${field.multipleOf})`;
        }

        return result;
    }

    private exportObjectType(field: ObjectField, includeDescriptions: boolean, depth: number): string {
        const body = this.exportObjectFields(field.fields, includeDescriptions, depth);
        return `z.object(${body})`;
    }

    private exportObjectFields(fields: Field[], includeDescriptions: boolean, depth: number): string {
        if (fields.length === 0) {
            return '{}';
        }

        const innerIndent = this.indent.repeat(depth + 1);
        const closingIndent = depth > 0 ? this.indent.repeat(depth) : '';

        const fieldLines: string[] = [];
        for (const field of fields) {
            const zodType = this.exportFieldType(field, includeDescriptions, depth + 1);
            fieldLines.push(`${innerIndent}${field.name}: ${zodType},`);
        }

        return `{\n${fieldLines.join('\n')}\n${closingIndent}}`;
    }

    private exportArrayType(field: ArrayField, includeDescriptions: boolean, depth: number): string {
        let itemSchema: string;

        if (typeof field.itemType === 'string') {
            itemSchema = this.mapPrimitiveType(field.itemType);
        } else {
            itemSchema = this.exportFieldType(field.itemType, includeDescriptions, depth);
        }

        let result = `z.array(${itemSchema})`;

        if (field.minItems !== undefined) {
            result += `.min(${field.minItems})`;
        }

        if (field.maxItems !== undefined) {
            result += `.max(${field.maxItems})`;
        }

        return result;
    }

    private exportMapType(field: MapField, includeDescriptions: boolean, depth: number): string {
        let valueSchema: string;

        if (typeof field.valueType === 'string') {
            valueSchema = this.mapPrimitiveType(field.valueType);
        } else {
            valueSchema = this.exportFieldType(field.valueType, includeDescriptions, depth);
        }

        return `z.record(z.string(), ${valueSchema})`;
    }

    private exportTupleType(field: TupleArrayField, includeDescriptions: boolean, depth: number): string {
        const items = field.items.map(item => this.exportFieldType(item, includeDescriptions, depth));
        return `z.tuple([${items.join(', ')}])`;
    }

    private exportUnionType(field: UnionField): string {
        const types = field.types.map(t => this.mapPrimitiveType(t as string));
        return `z.union([${types.join(', ')}])`;
    }

    private exportRefType(field: RefField): string {
        const ref = field.ref;
        const match = ref.match(/#\/\$defs\/(.+)$/);
        if (match) {
            return `${match[1]}Schema`;
        }
        return `${ref}Schema`;
    }

    private exportCompositionType(field: CompositionField, includeDescriptions: boolean, depth: number): string {
        const schemas = field.schemas.map(s => this.exportFieldType(s, includeDescriptions, depth));

        switch (field.type) {
            case 'allOf': {
                if (schemas.length === 0) return 'z.unknown()';
                if (schemas.length === 1) return schemas[0];
                // Two schemas: z.intersection(a, b)
                // Three+: z.intersection(a, b).and(c).and(d)
                let result = `z.intersection(${schemas[0]}, ${schemas[1]})`;
                for (let i = 2; i < schemas.length; i++) {
                    result += `.and(${schemas[i]})`;
                }
                return result;
            }
            case 'anyOf':
            case 'oneOf':
                return `z.union([${schemas.join(', ')}])`;
            default:
                return 'z.unknown()';
        }
    }

    mapPrimitiveType(type: FieldTypeName | string): string {
        switch (type) {
            case 'string':
                return 'z.string()';
            case 'number':
                return 'z.number()';
            case 'integer':
                return 'z.number().int()';
            case 'boolean':
                return 'z.boolean()';
            case 'null':
                return 'z.null()';
            default:
                return `z.unknown()`;
        }
    }
}

export function exportZod(schema: Schema, options?: ZodExportOptions): string {
    const exporter = new ZodExporter();
    return exporter.export(schema, options);
}
