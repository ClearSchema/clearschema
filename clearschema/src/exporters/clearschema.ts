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
    SchemaDefinition,
    FieldTypeName,
} from '../ast/types';
import { Exporter } from './types';

export class ClearSchemaSerializer implements Exporter<string> {
    private indent = '  ';

    export(schema: Schema): string {
        const lines: string[] = [];

        // Serialize $defs block
        if (schema.definitions.length > 0) {
            lines.push('$defs:');
            for (const def of schema.definitions) {
                const defLines = this.serializeDefinition(def, 1);
                lines.push(...defLines);
            }
        }

        // Blank line between $defs and root fields
        if (schema.definitions.length > 0 && schema.fields.length > 0) {
            lines.push('');
        }

        // Serialize root fields
        for (const field of schema.fields) {
            const fieldLines = this.serializeField(field, 0);
            lines.push(...fieldLines);
        }

        const result = lines.join('\n');
        return result ? result + '\n' : '';
    }

    private serializeDefinition(def: SchemaDefinition, depth: number): string[] {
        const prefix = this.indent.repeat(depth);
        const lines: string[] = [];

        // Definition header: "DefName: type[.required][.nullable]: description"
        const fieldLine = this.buildFieldLine(def.name, def.field);
        lines.push(`${prefix}${fieldLine}`);

        // Modifiers and children
        lines.push(...this.serializeModifiers(def.field, depth + 1));
        lines.push(...this.serializeChildren(def.field, depth + 1));

        return lines;
    }

    private serializeField(field: Field, depth: number): string[] {
        const prefix = this.indent.repeat(depth);
        const lines: string[] = [];

        const fieldLine = this.buildFieldLine(field.name, field);
        lines.push(`${prefix}${fieldLine}`);

        // Modifiers
        lines.push(...this.serializeModifiers(field, depth + 1));

        // Children (object fields, array items, composition items, etc.)
        lines.push(...this.serializeChildren(field, depth + 1));

        return lines;
    }

    private buildFieldLine(name: string, field: Field): string {
        const typePart = this.buildTypePart(field);
        const descPart = this.buildDescriptionPart(field);

        if (descPart) {
            return `${name}: ${typePart}: ${descPart}`;
        }
        return `${name}: ${typePart}`;
    }

    private buildTypePart(field: Field): string {
        let typeName: string;

        switch (field.type) {
            case 'ref':
                typeName = '$ref';
                break;
            case 'union':
                typeName = (field as UnionField).types.join('|');
                break;
            case 'allOf':
                typeName = 'allOf';
                break;
            case 'anyOf':
                typeName = 'anyOf';
                break;
            case 'oneOf':
                typeName = 'oneOf';
                break;
            default:
                typeName = field.type;
        }

        let result = typeName;
        if (field.required) {
            result += '.required';
        }
        if (field.nullable) {
            result += '.nullable';
        }
        return result;
    }

    private buildDescriptionPart(field: Field): string {
        // For $ref fields, the ref path goes in the description slot
        if (field.type === 'ref') {
            return (field as RefField).ref;
        }
        return field.description || '';
    }

    private serializeModifiers(field: Field, depth: number): string[] {
        const prefix = this.indent.repeat(depth);
        const lines: string[] = [];

        // Type-specific modifiers
        switch (field.type) {
            case 'string':
                this.addStringModifiers(field as StringField, prefix, lines);
                break;
            case 'number':
            case 'integer':
                this.addNumberModifiers(field as NumberField, prefix, lines);
                break;
            case 'array':
                this.addArrayModifiers(field as ArrayField, prefix, lines);
                break;
        }

        // Universal modifiers
        if (field.default !== undefined) {
            lines.push(`${prefix}^ default: ${this.formatModifierValue(field.default)}`);
        }
        if (field.const !== undefined) {
            lines.push(`${prefix}^ const: ${this.formatModifierValue(field.const)}`);
        }
        if (field.enum !== undefined && field.enum.length > 0) {
            lines.push(`${prefix}^ enum: [${field.enum.map(v => this.formatEnumValue(v)).join(', ')}]`);
        }

        return lines;
    }

    private addStringModifiers(field: StringField, prefix: string, lines: string[]): void {
        if (field.minLength !== undefined) {
            lines.push(`${prefix}^ minLength: ${field.minLength}`);
        }
        if (field.maxLength !== undefined) {
            lines.push(`${prefix}^ maxLength: ${field.maxLength}`);
        }
        if (field.pattern !== undefined) {
            lines.push(`${prefix}^ pattern: ${field.pattern}`);
        }
        if (field.format !== undefined) {
            lines.push(`${prefix}^ format: ${field.format}`);
        }
    }

    private addNumberModifiers(field: NumberField, prefix: string, lines: string[]): void {
        if (field.min !== undefined) {
            lines.push(`${prefix}^ min: ${field.min}`);
        }
        if (field.max !== undefined) {
            lines.push(`${prefix}^ max: ${field.max}`);
        }
        if (field.exclusiveMin !== undefined) {
            lines.push(`${prefix}^ exclusiveMin: ${field.exclusiveMin}`);
        }
        if (field.exclusiveMax !== undefined) {
            lines.push(`${prefix}^ exclusiveMax: ${field.exclusiveMax}`);
        }
        if (field.multipleOf !== undefined) {
            lines.push(`${prefix}^ multipleOf: ${field.multipleOf}`);
        }
    }

    private addArrayModifiers(field: ArrayField, prefix: string, lines: string[]): void {
        if (field.minItems !== undefined) {
            lines.push(`${prefix}^ minItems: ${field.minItems}`);
        }
        if (field.maxItems !== undefined) {
            lines.push(`${prefix}^ maxItems: ${field.maxItems}`);
        }
        if (field.uniqueItems === true) {
            lines.push(`${prefix}^ uniqueItems: true`);
        }
    }

    private serializeChildren(field: Field, depth: number): string[] {
        const lines: string[] = [];

        switch (field.type) {
            case 'object':
                for (const child of (field as ObjectField).fields) {
                    lines.push(...this.serializeField(child, depth));
                }
                break;

            case 'array':
                lines.push(...this.serializeArrayItem((field as ArrayField).itemType, depth));
                break;

            case 'array.tuple':
                for (const item of (field as TupleArrayField).items) {
                    lines.push(...this.serializeTupleItem(item, depth));
                }
                break;

            case 'map':
                lines.push(...this.serializeMapItem((field as MapField).valueType, depth));
                break;

            case 'allOf':
            case 'anyOf':
            case 'oneOf':
                for (const schema of (field as CompositionField).schemas) {
                    lines.push(...this.serializeCompositionItem(schema, depth));
                }
                break;
        }

        return lines;
    }

    private serializeArrayItem(itemType: Field | FieldTypeName, depth: number): string[] {
        const prefix = this.indent.repeat(depth);

        if (typeof itemType === 'string') {
            return [`${prefix}- ${itemType}`];
        }

        // Complex item type
        if (itemType.type === 'object') {
            const objField = itemType as ObjectField;
            const lines: string[] = [`${prefix}- object:`];
            for (const child of objField.fields) {
                lines.push(...this.serializeField(child, depth + 2));
            }
            return lines;
        }

        if (itemType.type === 'ref') {
            return [`${prefix}- $ref: ${(itemType as RefField).ref}`];
        }

        if (itemType.type === 'map') {
            const mapField = itemType as MapField;
            const lines: string[] = [`${prefix}- map:`];
            lines.push(...this.serializeMapItem(mapField.valueType, depth + 1));
            return lines;
        }

        // Fallback for other complex types
        return [`${prefix}- ${itemType.type}`];
    }

    private serializeTupleItem(item: Field, depth: number): string[] {
        const prefix = this.indent.repeat(depth);

        if (item.description) {
            return [`${prefix}- ${item.type}: ${item.description}`];
        }
        return [`${prefix}- ${item.type}`];
    }

    private serializeMapItem(valueType: Field | FieldTypeName, depth: number): string[] {
        const prefix = this.indent.repeat(depth);

        if (typeof valueType === 'string') {
            return [`${prefix}- ${valueType}`];
        }

        if (valueType.type === 'object') {
            const objField = valueType as ObjectField;
            const lines: string[] = [`${prefix}- object:`];
            for (const child of objField.fields) {
                lines.push(...this.serializeField(child, depth + 2));
            }
            return lines;
        }

        if (valueType.type === 'ref') {
            return [`${prefix}- $ref: ${(valueType as RefField).ref}`];
        }

        return [`${prefix}- ${valueType.type}`];
    }

    private serializeCompositionItem(schema: Field | RefField, depth: number): string[] {
        const prefix = this.indent.repeat(depth);

        if (schema.type === 'ref') {
            return [`${prefix}- $ref: ${(schema as RefField).ref}`];
        }

        if (schema.type === 'object') {
            const objField = schema as ObjectField;
            const lines: string[] = [`${prefix}- object:`];
            for (const child of objField.fields) {
                lines.push(...this.serializeField(child, depth + 2));
            }
            return lines;
        }

        // Inline primitive schema in composition
        if (schema.description) {
            return [`${prefix}- ${schema.type}: ${schema.description}`];
        }
        return [`${prefix}- ${schema.type}`];
    }

    private formatModifierValue(value: any): string {
        if (value === null) {
            return 'null';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'boolean' || typeof value === 'number') {
            return String(value);
        }
        return JSON.stringify(value);
    }

    private formatEnumValue(value: any): string {
        if (typeof value === 'string') {
            return value;
        }
        if (value === null) {
            return 'null';
        }
        return String(value);
    }
}

export function exportClearSchema(schema: Schema): string {
    const serializer = new ClearSchemaSerializer();
    return serializer.export(schema);
}
