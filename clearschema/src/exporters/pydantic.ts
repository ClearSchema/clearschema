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
    MatchField,
} from '../ast/types';
import { Exporter, ExportOptions } from './types';

export interface PydanticExportOptions extends ExportOptions {
    includeComments?: boolean;
    useTyping?: boolean; // Use typing.Optional vs | None
}

export class PydanticExporter implements Exporter<string> {
    private indent = '    ';
    private imports = new Set<string>();
    private extraClasses: string[] = [];

    export(schema: Schema, options?: PydanticExportOptions): string {
        const includeComments = options?.includeComments ?? true;
        const useTyping = options?.useTyping ?? true;

        this.imports.clear();
        this.extraClasses = [];
        this.imports.add('from pydantic import BaseModel, Field');

        const lines: string[] = [];
        const classLines: string[] = [];

        // Export definitions as classes or type aliases
        for (const def of schema.definitions) {
            if (def.field.type === 'object') {
                classLines.push(...this.exportObjectAsClass(
                    def.name,
                    def.field as ObjectField,
                    includeComments,
                    useTyping
                ));
                classLines.push('');
            } else if (def.field.type === 'map') {
                const mapType = this.exportMapType(def.field as MapField, useTyping);
                classLines.push(`${def.name} = ${mapType}`);
                classLines.push('');
            }
        }

        // Export root schema if fields exist
        if (schema.fields.length > 0) {
            classLines.push(...this.exportObjectAsClass(
                'Schema',
                {
                    ...schema.fields[0],
                    type: 'object',
                    fields: schema.fields,
                } as ObjectField,
                includeComments,
                useTyping
            ));
        }

        // Build final output with imports
        const importLines = Array.from(this.imports).sort();
        lines.push(...importLines);
        lines.push('');
        lines.push(...this.extraClasses);
        lines.push(...classLines);

        return lines.join('\n');
    }

    private exportObjectAsClass(
        name: string,
        field: ObjectField,
        includeComments: boolean,
        useTyping: boolean
    ): string[] {
        const lines: string[] = [];

        if (includeComments && field.description) {
            lines.push(`class ${name}(BaseModel):`);
            lines.push(`${this.indent}"""${field.description}"""`);
        } else {
            lines.push(`class ${name}(BaseModel):`);
        }

        if (field.fields.length === 0) {
            lines.push(`${this.indent}pass`);
            return lines;
        }

        for (const childField of field.fields) {
            const fieldDef = this.exportFieldDefinition(childField, includeComments, useTyping);
            lines.push(...fieldDef.map(l => this.indent + l));
        }

        return lines;
    }

    private exportFieldDefinition(
        field: Field,
        includeComments: boolean,
        useTyping: boolean
    ): string[] {
        const lines: string[] = [];
        const fieldType = this.exportFieldType(field, useTyping);
        const fieldConstraints = this.buildFieldConstraints(field, includeComments);

        if (includeComments && field.description && fieldConstraints) {
            lines.push(`${field.name}: ${fieldType} = Field(${fieldConstraints})`);
        } else if (includeComments && field.description) {
            lines.push(`${field.name}: ${fieldType} = Field(..., description="${field.description}")`);
        } else if (fieldConstraints) {
            lines.push(`${field.name}: ${fieldType} = Field(${fieldConstraints})`);
        } else if (field.required) {
            lines.push(`${field.name}: ${fieldType}`);
        } else {
            if (useTyping) {
                this.imports.add('from typing import Optional');
            }
            const optionalType = useTyping ? `Optional[${fieldType}]` : `${fieldType} | None`;
            lines.push(`${field.name}: ${optionalType} = None`);
        }

        return lines;
    }

    private exportFieldType(field: Field, useTyping: boolean): string {
        switch (field.type) {
            case 'string':
                return this.exportStringType(field as StringField);
            case 'number':
                return 'float';
            case 'integer':
                return this.exportIntegerType(field as NumberField);
            case 'boolean':
                return 'bool';
            case 'null':
                return 'None';
            case 'object':
                return this.exportObjectType(field as ObjectField);
            case 'array':
                return this.exportArrayType(field as ArrayField, useTyping);
            case 'map':
                return this.exportMapType(field as MapField, useTyping);
            case 'array.tuple':
                return this.exportTupleType(field as TupleArrayField, useTyping);
            case 'union':
                return this.exportUnionType(field as UnionField, useTyping);
            case 'match':
                return this.exportMatchType(field as MatchField, useTyping);
            case 'ref':
                return this.exportRefType(field as RefField);
            default:
                return 'Any';
        }
    }

    private exportStringType(field: StringField): string {
        // Smart type mapping based on format
        if (field.format === 'email') {
            this.imports.add('from pydantic import EmailStr');
            return 'EmailStr';
        }
        if (field.format === 'uri' || field.format === 'url') {
            this.imports.add('from pydantic import HttpUrl');
            return 'HttpUrl';
        }
        if (field.format === 'uuid') {
            this.imports.add('from typing import UUID');
            return 'UUID';
        }
        if (field.format === 'date') {
            this.imports.add('from datetime import date');
            return 'date';
        }
        if (field.format === 'date-time') {
            this.imports.add('from datetime import datetime');
            return 'datetime';
        }
        return 'str';
    }

    private exportIntegerType(field: NumberField): string {
        // Smart type mapping for constrained integers
        if (field.min !== undefined && field.min >= 1) {
            this.imports.add('from pydantic import PositiveInt');
            return 'PositiveInt';
        }
        if (field.min !== undefined && field.min >= 0) {
            this.imports.add('from pydantic import NonNegativeInt');
            return 'NonNegativeInt';
        }
        return 'int';
    }

    private exportObjectType(_field: ObjectField): string {
        // Inline object type - would need nested class
        return 'dict';
    }

    private exportArrayType(field: ArrayField, useTyping: boolean): string {
        this.imports.add('from typing import List');
        let itemType: string;

        if (typeof field.itemType === 'string') {
            itemType = this.mapPrimitiveType(field.itemType);
        } else {
            itemType = this.exportFieldType(field.itemType, useTyping);
        }

        return `List[${itemType}]`;
    }

    private exportMapType(field: MapField, useTyping: boolean): string {
        this.imports.add('from typing import Dict');
        let valueType: string;

        if (typeof field.valueType === 'string') {
            valueType = this.mapPrimitiveType(field.valueType);
        } else {
            valueType = this.exportFieldType(field.valueType, useTyping);
        }

        return `Dict[str, ${valueType}]`;
    }

    private exportTupleType(field: TupleArrayField, useTyping: boolean): string {
        this.imports.add('from typing import Tuple');
        const itemTypes = field.items.map(item => this.exportFieldType(item, useTyping));
        return `Tuple[${itemTypes.join(', ')}]`;
    }

    private exportUnionType(field: UnionField, _useTyping: boolean): string {
        this.imports.add('from typing import Union');
        const types = field.types.map(t => this.mapPrimitiveType(t as string));
        return `Union[${types.join(', ')}]`;
    }

    private exportMatchType(field: MatchField, _useTyping: boolean): string {
        this.imports.add('from typing import Annotated, Literal');
        this.imports.add('from pydantic import Discriminator');

        const variantClassNames: string[] = [];

        for (const [variantKey, variant] of Object.entries(field.variants)) {
            if (variant.type === 'ref') {
                // For $ref variants, use the ref name and assume it has the discriminator Literal field
                const refName = this.exportRefType(variant);
                variantClassNames.push(refName);
            } else {
                // Inline ObjectField variant: emit a Pydantic model class
                const className = variantKey.charAt(0).toUpperCase() + variantKey.slice(1) + 'Variant';
                variantClassNames.push(className);

                const classLines: string[] = [];
                classLines.push(`class ${className}(BaseModel):`);
                classLines.push(`${this.indent}${field.discriminator}: Literal['${variantKey}']`);

                for (const childField of variant.fields) {
                    const fieldType = this.exportFieldType(childField, false);
                    if (childField.required) {
                        classLines.push(`${this.indent}${childField.name}: ${fieldType}`);
                    } else {
                        this.imports.add('from typing import Optional');
                        classLines.push(`${this.indent}${childField.name}: Optional[${fieldType}] = None`);
                    }
                }

                classLines.push('');
                this.extraClasses.push(...classLines);
            }
        }

        const unionTypes = variantClassNames.join(' | ');
        return `Annotated[${unionTypes}, Discriminator('${field.discriminator}')]`;
    }

    private exportRefType(field: RefField): string {
        const ref = field.ref;
        const match = ref.match(/#\/\$defs\/(.+)$/);
        if (match) {
            return match[1];
        }
        return ref;
    }

    private buildFieldConstraints(field: Field, includeDescription: boolean): string {
        const constraints: string[] = [];

        // Required or default
        if (field.required) {
            constraints.push('...');
        } else if (field.default !== undefined) {
            constraints.push(`default=${JSON.stringify(field.default)}`);
        } else {
            constraints.push('None');
        }

        // Description
        if (includeDescription && field.description) {
            constraints.push(`description="${field.description}"`);
        }

        // Type-specific constraints
        if (field.type === 'string') {
            const sf = field as StringField;
            if (sf.minLength !== undefined) constraints.push(`min_length=${sf.minLength}`);
            if (sf.maxLength !== undefined) constraints.push(`max_length=${sf.maxLength}`);
            if (sf.pattern !== undefined) constraints.push(`pattern="${sf.pattern}"`);
        }

        if (field.type === 'number' || field.type === 'integer') {
            const nf = field as NumberField;
            if (nf.min !== undefined) constraints.push(`ge=${nf.min}`);
            if (nf.max !== undefined) constraints.push(`le=${nf.max}`);
            if (nf.exclusiveMin !== undefined) constraints.push(`gt=${nf.exclusiveMin}`);
            if (nf.exclusiveMax !== undefined) constraints.push(`lt=${nf.exclusiveMax}`);
            if (nf.multipleOf !== undefined) constraints.push(`multiple_of=${nf.multipleOf}`);
        }

        if (field.type === 'array') {
            const af = field as ArrayField;
            if (af.minItems !== undefined) constraints.push(`min_items=${af.minItems}`);
            if (af.maxItems !== undefined) constraints.push(`max_items=${af.maxItems}`);
        }

        return constraints.length > 1 ? constraints.join(', ') : '';
    }

    private mapPrimitiveType(type: string): string {
        switch (type) {
            case 'string':
                return 'str';
            case 'number':
                return 'float';
            case 'integer':
                return 'int';
            case 'boolean':
                return 'bool';
            case 'null':
                return 'None';
            default:
                return type;
        }
    }
}

export function exportPydantic(schema: Schema, options?: PydanticExportOptions): string {
    const exporter = new PydanticExporter();
    return exporter.export(schema, options);
}
