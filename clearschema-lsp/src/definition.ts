import { Location } from 'vscode-languageserver/node';
import { Schema } from '@clearschema/core';
import { locationToRange } from './utils';

/**
 * Go-to-definition: resolve a `$ref:` on the current line to the
 * corresponding SchemaDefinition location.
 */
export function getDefinition(
    lineText: string,
    _character: number,
    schema: Schema | null,
    documentUri: string,
): Location | null {
    if (!schema) return null;

    // Check if the line contains a $ref:
    const refMatch = lineText.match(/\$ref:\s*(.+)/);
    if (!refMatch) return null;

    const rawRef = refMatch[1].trim();

    // Extract definition name: "#/$defs/Address" → "Address", or bare "Address" → "Address"
    let defName: string;
    if (rawRef.startsWith('#/$defs/')) {
        defName = rawRef.slice('#/$defs/'.length);
    } else if (rawRef.startsWith('#/definitions/')) {
        defName = rawRef.slice('#/definitions/'.length);
    } else {
        defName = rawRef;
    }

    // Find matching definition
    const def = schema.definitions.find((d) => d.name === defName);
    if (!def) return null;

    return Location.create(documentUri, locationToRange(def.location));
}
