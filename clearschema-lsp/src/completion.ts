import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import type { Schema } from '@clearschema/core';

// --- Type completions ---------------------------------------------------

interface TypeCompletion {
    label: string;
    detail: string;
    documentation: string;
}

const TYPE_COMPLETIONS: TypeCompletion[] = [
    { label: 'string', detail: 'Primitive type', documentation: 'A UTF-8 string value' },
    { label: 'number', detail: 'Primitive type', documentation: 'A numeric value (integer or float)' },
    { label: 'integer', detail: 'Primitive type', documentation: 'An integer value' },
    { label: 'boolean', detail: 'Primitive type', documentation: 'A true/false value' },
    { label: 'null', detail: 'Primitive type', documentation: 'An explicit null value' },
    { label: 'object', detail: 'Complex type', documentation: 'A nested object with child fields' },
    { label: 'array', detail: 'Complex type', documentation: 'An ordered list of items' },
    { label: 'array.tuple', detail: 'Complex type', documentation: 'A fixed-length array with positional types' },
    { label: 'map', detail: 'Complex type', documentation: 'A dictionary of string keys to typed values' },
    { label: '$ref', detail: 'Reference type', documentation: 'A reference to a schema definition' },
    { label: 'allOf', detail: 'Composition type', documentation: 'Combine schemas: value must match all' },
    { label: 'anyOf', detail: 'Composition type', documentation: 'Combine schemas: value must match at least one' },
    { label: 'oneOf', detail: 'Composition type', documentation: 'Combine schemas: value must match exactly one' },
];

function makeTypeCompletions(): CompletionItem[] {
    return TYPE_COMPLETIONS.map((t) => ({
        label: t.label,
        kind: CompletionItemKind.TypeParameter,
        detail: t.detail,
        documentation: t.documentation,
    }));
}

// --- Modifier completions -----------------------------------------------

interface ModifierMeta {
    label: string;
    detail: string;
    documentation: string;
}

const UNIVERSAL_MODIFIERS: ModifierMeta[] = [
    { label: 'default', detail: 'any value', documentation: 'Default value when field is absent' },
    { label: 'const', detail: 'any value', documentation: 'Field must equal this exact value' },
    { label: 'enum', detail: 'array value', documentation: 'Field value must be one of the listed values' },
];

const STRING_MODIFIERS: ModifierMeta[] = [
    { label: 'minLength', detail: 'integer', documentation: 'Minimum string length' },
    { label: 'maxLength', detail: 'integer', documentation: 'Maximum string length' },
    { label: 'pattern', detail: 'regex string', documentation: 'Regular expression the string must match' },
    { label: 'format', detail: 'string', documentation: 'Semantic format (e.g. email, uri, date-time)' },
];

const NUMBER_MODIFIERS: ModifierMeta[] = [
    { label: 'min', detail: 'number', documentation: 'Minimum value (inclusive)' },
    { label: 'max', detail: 'number', documentation: 'Maximum value (inclusive)' },
    { label: 'exclusiveMin', detail: 'number', documentation: 'Minimum value (exclusive)' },
    { label: 'exclusiveMax', detail: 'number', documentation: 'Maximum value (exclusive)' },
    { label: 'multipleOf', detail: 'number', documentation: 'Value must be a multiple of this number' },
];

const ARRAY_MODIFIERS: ModifierMeta[] = [
    { label: 'minItems', detail: 'integer', documentation: 'Minimum number of array items' },
    { label: 'maxItems', detail: 'integer', documentation: 'Maximum number of array items' },
    { label: 'uniqueItems', detail: 'boolean', documentation: 'Whether array items must be unique' },
];

function modifiersForType(typeName: string | null): ModifierMeta[] {
    const mods: ModifierMeta[] = [];
    switch (typeName) {
        case 'string':
            mods.push(...STRING_MODIFIERS);
            break;
        case 'number':
        case 'integer':
            mods.push(...NUMBER_MODIFIERS);
            break;
        case 'array':
        case 'array.tuple':
            mods.push(...ARRAY_MODIFIERS);
            break;
    }
    mods.push(...UNIVERSAL_MODIFIERS);
    return mods;
}

function makeModifierCompletions(typeName: string | null): CompletionItem[] {
    return modifiersForType(typeName).map((m) => ({
        label: m.label,
        kind: CompletionItemKind.Property,
        detail: m.detail,
        documentation: m.documentation,
    }));
}

// --- Ref completions ----------------------------------------------------

function makeRefCompletions(schema: Schema | null): CompletionItem[] {
    if (!schema || !schema.definitions || schema.definitions.length === 0) {
        return [];
    }
    return schema.definitions.map((def) => ({
        label: def.name,
        kind: CompletionItemKind.Reference,
        detail: `Definition: ${def.name}`,
        documentation: `Reference to #/$defs/${def.name}`,
        insertText: `#/$defs/${def.name}`,
    }));
}

// --- Dot completions (required / nullable) ------------------------------

function makeDotCompletions(): CompletionItem[] {
    return [
        {
            label: 'required',
            kind: CompletionItemKind.Property,
            detail: 'Field modifier',
            documentation: 'Mark this field as required',
        },
        {
            label: 'nullable',
            kind: CompletionItemKind.Property,
            detail: 'Field modifier',
            documentation: 'Mark this field as nullable',
        },
    ];
}

// --- Context helpers ----------------------------------------------------

/**
 * Parse the type name from a field line like `  name: string.required: desc`
 * Returns null if no type can be determined.
 */
function parseTypeFromFieldLine(line: string): string | null {
    // Match field pattern: optional indent, fieldName: type[.modifiers]: desc
    const match = line.match(/^\s*[\w$][\w-]*\s*:\s*([\w$.]+)/);
    if (!match) return null;
    const rawType = match[1];
    // Strip .required / .nullable suffixes
    const typePart = rawType.replace(/\.(required|nullable)/g, '');
    return typePart || null;
}

/**
 * Walk backward from lineNumber to find the nearest field line (not a modifier,
 * array-item, or comment line).
 */
function findParentFieldType(allLines: string[], lineNumber: number): string | null {
    // Start from the line above the current modifier line
    for (let i = lineNumber - 1; i >= 0; i--) {
        const line = allLines[i];
        // Skip blank lines
        if (line.trim() === '') continue;
        // Skip comment lines
        if (/^\s*#/.test(line)) continue;
        // Skip modifier lines
        if (/^\s*\^/.test(line)) continue;
        // Skip array item lines
        if (/^\s*-\s/.test(line)) continue;
        // This should be a field line
        return parseTypeFromFieldLine(line);
    }
    return null;
}

// --- Main entry point ---------------------------------------------------

/**
 * Return completion items based on the cursor context within a ClearSchema document.
 *
 * Pure function — no LSP server dependency.
 */
export function getCompletions(
    lineText: string,
    character: number,
    allLines: string[],
    lineNumber: number,
    schema: Schema | null,
): CompletionItem[] {
    const textBeforeCursor = lineText.slice(0, character);

    // 1. Comment line → no completions
    if (/^\s*#/.test(textBeforeCursor)) {
        return [];
    }

    // 2. After $ref: → suggest definition names
    if (/\$ref:\s*$/.test(textBeforeCursor)) {
        return makeRefCompletions(schema);
    }

    // 3. Modifier line (^ ) → suggest modifiers based on parent field type
    if (/^\s*\^\s*$/.test(textBeforeCursor) || /^\s*\^\s+\S*$/.test(textBeforeCursor)) {
        // Only trigger when we're on a modifier line
        if (/^\s*\^/.test(textBeforeCursor)) {
            const parentType = findParentFieldType(allLines, lineNumber);
            return makeModifierCompletions(parentType);
        }
    }

    // 4. After `.` on a type name → suggest required, nullable
    // Match: `fieldName: typeName.` with cursor right after the dot
    if (/^\s*[\w$][\w-]*\s*:\s*[\w$.]+\.$/.test(textBeforeCursor)) {
        return makeDotCompletions();
    }

    // 5. Array item line: `  - ` or `  -  ` with cursor at end
    if (/^\s*-\s+$/.test(textBeforeCursor) || /^\s*-\s*$/.test(textBeforeCursor)) {
        return makeTypeCompletions();
    }

    // 6. After first `:` on a field line — cursor after `fieldName: ` with no type yet
    // Match lines like `name: ` or `  fieldName: ` (with optional trailing space)
    if (/^\s*[\w$][\w-]*\s*:\s+$/.test(textBeforeCursor)) {
        return makeTypeCompletions();
    }

    // 7. Otherwise → no completions
    return [];
}
