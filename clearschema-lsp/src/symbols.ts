import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node';
import { Schema, Field, FieldTypeName } from '@clearschema/core';
import { locationToRange } from './utils';

/**
 * Map a ClearSchema field type name to the appropriate LSP SymbolKind.
 */
function fieldTypeToSymbolKind(type: FieldTypeName): SymbolKind {
    switch (type) {
        case 'object':
            return SymbolKind.Object;
        case 'array':
        case 'array.tuple':
            return SymbolKind.Array;
        case 'string':
            return SymbolKind.String;
        case 'number':
        case 'integer':
            return SymbolKind.Number;
        case 'boolean':
            return SymbolKind.Boolean;
        case 'null':
            return SymbolKind.Null;
        case 'ref':
            return SymbolKind.Variable;
        case 'map':
            return SymbolKind.Object;
        case 'union':
        case 'allOf':
        case 'anyOf':
        case 'oneOf':
            return SymbolKind.Enum;
        default:
            return SymbolKind.Field;
    }
}

/**
 * Convert a Field into a DocumentSymbol, recursing into ObjectField children.
 */
function fieldToSymbol(field: Field): DocumentSymbol {
    const range = locationToRange(field.location);
    const children: DocumentSymbol[] = [];

    if (field.type === 'object' && 'fields' in field) {
        for (const child of field.fields) {
            children.push(fieldToSymbol(child));
        }
    }

    return DocumentSymbol.create(
        field.name,
        field.type,
        fieldTypeToSymbolKind(field.type),
        range,
        range,
        children.length > 0 ? children : undefined,
    );
}

/**
 * Return a hierarchy of DocumentSymbol for the outline / breadcrumb UI.
 */
export function getDocumentSymbols(schema: Schema | null): DocumentSymbol[] {
    if (!schema) return [];

    const symbols: DocumentSymbol[] = [];

    // Definitions → Class symbols with children from the inner field
    for (const def of schema.definitions) {
        const range = locationToRange(def.location);
        const children: DocumentSymbol[] = [];

        if (def.field.type === 'object' && 'fields' in def.field) {
            for (const child of def.field.fields) {
                children.push(fieldToSymbol(child));
            }
        }

        symbols.push(
            DocumentSymbol.create(
                def.name,
                def.field.type,
                SymbolKind.Class,
                range,
                range,
                children.length > 0 ? children : undefined,
            ),
        );
    }

    // Top-level fields
    for (const field of schema.fields) {
        symbols.push(fieldToSymbol(field));
    }

    return symbols;
}
