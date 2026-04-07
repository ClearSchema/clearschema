import type { Schema, Field, SchemaDefinition, MatchField } from '@clearschema/core';

export interface FieldSummary {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    ref?: string;
    fields?: FieldSummary[];
    itemType?: string;
    valueType?: string;
    types?: string[];
    variants?: string[];
    discriminator?: string;
}

export interface TypeSummary {
    name: string;
    type: string;
    fields?: FieldSummary[];
    ref?: string;
    itemType?: string;
    valueType?: string;
    types?: string[];
    variants?: string[];
    discriminator?: string;
}

function summarizeField(field: Field): FieldSummary {
    const summary: FieldSummary = {
        name: field.name,
        type: field.type,
        required: field.required,
    };

    if (field.description) {
        summary.description = field.description;
    }

    switch (field.type) {
        case 'object':
            summary.fields = field.fields.map((f) => ({
                name: f.name,
                type: f.type,
                required: f.required,
                ...(f.description ? { description: f.description } : {}),
                ...(f.type === 'ref' ? { ref: f.ref } : {}),
            }));
            break;
        case 'array':
            summary.itemType = typeof field.itemType === 'string' ? field.itemType : field.itemType.type;
            break;
        case 'map':
            summary.valueType = typeof field.valueType === 'string' ? field.valueType : field.valueType.type;
            break;
        case 'ref':
            summary.ref = field.ref;
            break;
        case 'union':
            summary.types = field.types;
            break;
        case 'match' as any: {
            const matchField = field as unknown as MatchField;
            summary.discriminator = matchField.discriminator;
            summary.variants = Object.keys(matchField.variants);
            break;
        }
    }

    return summary;
}

function summarizeDefinition(def: SchemaDefinition): TypeSummary {
    const summary: TypeSummary = {
        name: def.name,
        type: def.field.type,
    };

    const fieldSummary = summarizeField(def.field);

    // Copy relevant properties from field summary
    if (fieldSummary.fields) summary.fields = fieldSummary.fields;
    if (fieldSummary.ref) summary.ref = fieldSummary.ref;
    if (fieldSummary.itemType) summary.itemType = fieldSummary.itemType;
    if (fieldSummary.valueType) summary.valueType = fieldSummary.valueType;
    if (fieldSummary.types) summary.types = fieldSummary.types;
    if (fieldSummary.variants) summary.variants = fieldSummary.variants;
    if (fieldSummary.discriminator) summary.discriminator = fieldSummary.discriminator;

    return summary;
}

export function inspectSchema(schema: Schema): TypeSummary[] {
    const summaries: TypeSummary[] = [];

    for (const def of schema.definitions) {
        summaries.push(summarizeDefinition(def));
    }

    // Also include top-level fields as an anonymous type if present
    if (schema.fields.length > 0) {
        summaries.push({
            name: '(root)',
            type: 'object',
            fields: schema.fields.map((f) => ({
                name: f.name,
                type: f.type,
                required: f.required,
                ...(f.description ? { description: f.description } : {}),
                ...(f.type === 'ref' ? { ref: (f as any).ref } : {}),
            })),
        });
    }

    return summaries;
}
