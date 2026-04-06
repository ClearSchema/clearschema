import {
    Schema,
    Field,
    ObjectField,
    ArrayField,
    MapField,
    TupleArrayField,
    UnionField,
    RefField,
    CompositionField,
    MatchField,
} from '../ast/types';
import { Exporter, ExportOptions } from './types';

export interface TypeScriptExportOptions extends ExportOptions {
    useInterfaces?: boolean; // true = interfaces, false = types
    exportKeyword?: 'export' | 'declare' | '';
    includeComments?: boolean;
}

export class TypeScriptExporter implements Exporter<string> {
    private indent = '  ';

    export(schema: Schema, options?: TypeScriptExportOptions): string {
        const useInterfaces = options?.useInterfaces ?? true;
        const exportKeyword = options?.exportKeyword ?? 'export';
        const includeComments = options?.includeComments ?? true;

        const lines: string[] = [];

        // Export definitions first
        for (const def of schema.definitions) {
            if (includeComments && def.field.description) {
                lines.push(`/** ${def.field.description} */`);
            }

            if (useInterfaces && def.field.type === 'object') {
                lines.push(...this.exportObjectAsInterface(def.name, def.field as ObjectField, exportKeyword, includeComments));
            } else {
                const typeDef = this.exportFieldType(def.field, options);
                lines.push(`${exportKeyword ? exportKeyword + ' ' : ''}type ${def.name} = ${typeDef};`);
            }
            lines.push('');
        }

        // Export root fields as a single interface
        if (schema.fields.length > 0) {
            const rootName = 'Schema';
            lines.push(`${exportKeyword ? exportKeyword + ' ' : ''}interface ${rootName} {`);

            for (const field of schema.fields) {
                if (includeComments && field.description) {
                    lines.push(`${this.indent}/** ${field.description} */`);
                }

                const optional = !field.required ? '?' : '';
                const fieldType = this.exportFieldType(field, options);
                lines.push(`${this.indent}${field.name}${optional}: ${fieldType};`);
            }

            lines.push('}');
        }

        return lines.join('\n');
    }

    private exportObjectAsInterface(
        name: string,
        field: ObjectField,
        exportKeyword: string,
        includeComments: boolean
    ): string[] {
        const lines: string[] = [];
        lines.push(`${exportKeyword ? exportKeyword + ' ' : ''}interface ${name} {`);

        for (const childField of field.fields) {
            if (includeComments && childField.description) {
                lines.push(`${this.indent}/** ${childField.description} */`);
            }

            const optional = !childField.required ? '?' : '';
            const fieldType = this.exportFieldType(childField, { includeComments });
            lines.push(`${this.indent}${childField.name}${optional}: ${fieldType};`);
        }

        lines.push('}');
        return lines;
    }

    private exportFieldType(field: Field, options?: TypeScriptExportOptions): string {
        let baseType: string;

        switch (field.type) {
            case 'string':
                baseType = 'string';
                break;
            case 'number':
            case 'integer':
                baseType = 'number';
                break;
            case 'boolean':
                baseType = 'boolean';
                break;
            case 'null':
                baseType = 'null';
                break;
            case 'object':
                baseType = this.exportObjectType(field as ObjectField, options);
                break;
            case 'array':
                baseType = this.exportArrayType(field as ArrayField, options);
                break;
            case 'map':
                baseType = this.exportMapType(field as MapField, options);
                break;
            case 'array.tuple':
                baseType = this.exportTupleType(field as TupleArrayField, options);
                break;
            case 'union':
                baseType = this.exportUnionType(field as UnionField, options);
                break;
            case 'ref':
                baseType = this.exportRefType(field as RefField);
                break;
            case 'match':
                baseType = this.exportMatchType(field as MatchField, options);
                break;
            case 'allOf':
            case 'anyOf':
            case 'oneOf':
                baseType = this.exportCompositionType(field as CompositionField, options);
                break;
            default:
                baseType = 'unknown';
        }

        // Handle nullable
        if (field.nullable) {
            return `${baseType} | null`;
        }

        return baseType;
    }

    private exportObjectType(field: ObjectField, options?: TypeScriptExportOptions): string {
        if (field.fields.length === 0) {
            return 'Record<string, unknown>';
        }

        const fields: string[] = [];
        for (const childField of field.fields) {
            const optional = !childField.required ? '?' : '';
            const fieldType = this.exportFieldType(childField, options);
            fields.push(`${childField.name}${optional}: ${fieldType}`);
        }

        return `{ ${fields.join('; ')} }`;
    }

    private exportArrayType(field: ArrayField, options?: TypeScriptExportOptions): string {
        let itemType: string;

        if (typeof field.itemType === 'string') {
            itemType = this.mapPrimitiveType(field.itemType);
        } else {
            itemType = this.exportFieldType(field.itemType, options);
        }

        return `${itemType}[]`;
    }

    private exportMapType(field: MapField, options?: TypeScriptExportOptions): string {
        let valueType: string;

        if (typeof field.valueType === 'string') {
            valueType = this.mapPrimitiveType(field.valueType);
        } else {
            valueType = this.exportFieldType(field.valueType, options);
        }

        return `Record<string, ${valueType}>`;
    }

    private exportTupleType(field: TupleArrayField, options?: TypeScriptExportOptions): string {
        const itemTypes = field.items.map(item => this.exportFieldType(item, options));
        return `[${itemTypes.join(', ')}]`;
    }

    private exportUnionType(field: UnionField, _options?: TypeScriptExportOptions): string {
        const types = field.types.map(t => this.mapPrimitiveType(t as string));
        return types.join(' | ');
    }

    private exportRefType(field: RefField): string {
        // Extract type name from reference
        // #/$defs/User -> User
        // User -> User
        const ref = field.ref;
        const match = ref.match(/#\/\$defs\/(.+)$/);
        if (match) {
            return match[1];
        }
        return ref;
    }

    private exportMatchType(field: MatchField, options?: TypeScriptExportOptions): string {
        const variants: string[] = [];

        for (const [key, variant] of Object.entries(field.variants)) {
            if (variant.type === 'ref') {
                const refType = this.exportRefType(variant as RefField);
                variants.push(`{ ${field.discriminator}: '${key}' } & ${refType}`);
            } else {
                const objectField = variant as ObjectField;
                const fields: string[] = [`${field.discriminator}: '${key}'`];
                for (const childField of objectField.fields) {
                    const optional = !childField.required ? '?' : '';
                    const fieldType = this.exportFieldType(childField, options);
                    fields.push(`${childField.name}${optional}: ${fieldType}`);
                }
                variants.push(`{ ${fields.join('; ')} }`);
            }
        }

        return variants.join(' | ');
    }

    private exportCompositionType(field: CompositionField, options?: TypeScriptExportOptions): string {
        const schemas = field.schemas.map(s => this.exportFieldType(s, options));

        switch (field.type) {
            case 'allOf':
                return schemas.join(' & ');
            case 'anyOf':
            case 'oneOf':
                return schemas.join(' | ');
            default:
                return 'unknown';
        }
    }

    private mapPrimitiveType(type: string): string {
        switch (type) {
            case 'string':
                return 'string';
            case 'number':
            case 'integer':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'null':
                return 'null';
            default:
                return type; // Could be a reference or unknown type
        }
    }
}

export function exportTypeScript(schema: Schema, options?: TypeScriptExportOptions): string {
    const exporter = new TypeScriptExporter();
    return exporter.export(schema, options);
}
