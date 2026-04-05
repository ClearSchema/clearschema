import { Hover, MarkupKind } from 'vscode-languageserver/node';
import { Schema, SchemaDefinition, Field } from '@clearschema/core';

// ---------------------------------------------------------------------------
// Static documentation maps
// ---------------------------------------------------------------------------

const TYPE_DOCS: Record<string, string> = {
    string: [
        '**string**',
        '',
        'Text value.',
        '',
        '**Available modifiers:**',
        '- `minLength` — minimum character count',
        '- `maxLength` — maximum character count',
        '- `pattern` — regular expression constraint',
        '- `format` — semantic format (email, uri, uuid, date-time, …)',
    ].join('\n'),

    number: [
        '**number**',
        '',
        'Numeric value (integer or float).',
        '',
        '**Available modifiers:**',
        '- `min` — minimum value (inclusive)',
        '- `max` — maximum value (inclusive)',
        '- `exclusiveMin` — exclusive minimum',
        '- `exclusiveMax` — exclusive maximum',
        '- `multipleOf` — value must be a multiple of this',
    ].join('\n'),

    integer: [
        '**integer**',
        '',
        'Whole number (no fractional part).',
        '',
        '**Available modifiers:**',
        '- `min` — minimum value (inclusive)',
        '- `max` — maximum value (inclusive)',
        '- `exclusiveMin` — exclusive minimum',
        '- `exclusiveMax` — exclusive maximum',
        '- `multipleOf` — value must be a multiple of this',
    ].join('\n'),

    boolean: [
        '**boolean**',
        '',
        'True or false value.',
        '',
        '**Available modifiers:** universal only (`default`, `const`, `enum`)',
    ].join('\n'),

    null: [
        '**null**',
        '',
        'Explicit null value.',
        '',
        '**Available modifiers:** universal only (`default`, `const`)',
    ].join('\n'),

    object: [
        '**object**',
        '',
        'Nested structure with named fields.',
        '',
        '**Available modifiers:** universal only (`default`, `const`, `enum`)',
    ].join('\n'),

    array: [
        '**array**',
        '',
        'Ordered collection of items of a single type.',
        '',
        '**Available modifiers:**',
        '- `minItems` — minimum number of items',
        '- `maxItems` — maximum number of items',
        '- `uniqueItems` — all items must be distinct',
    ].join('\n'),

    'array.tuple': [
        '**array.tuple**',
        '',
        'Fixed-length array with positional types.',
        '',
        '**Available modifiers:**',
        '- `minItems` — minimum number of items',
        '- `maxItems` — maximum number of items',
        '- `uniqueItems` — all items must be distinct',
    ].join('\n'),

    map: [
        '**map**',
        '',
        'Key-value mapping (string keys to a typed value).',
        '',
        '**Available modifiers:** universal only (`default`, `const`, `enum`)',
    ].join('\n'),
};

const MODIFIER_DOCS: Record<string, string> = {
    minLength: [
        '**minLength**',
        '',
        'Minimum string length.',
        '',
        '**Value type:** integer',
        '',
        '```clearschema',
        'name: string: Name',
        '  ^ minLength: 2',
        '```',
    ].join('\n'),

    maxLength: [
        '**maxLength**',
        '',
        'Maximum string length.',
        '',
        '**Value type:** integer',
        '',
        '```clearschema',
        'name: string: Name',
        '  ^ maxLength: 100',
        '```',
    ].join('\n'),

    pattern: [
        '**pattern**',
        '',
        'Regular expression constraint for string values.',
        '',
        '**Value type:** string (regex)',
        '',
        '```clearschema',
        'code: string: Product code',
        '  ^ pattern: ^[A-Z]{3}\\d{4}$',
        '```',
    ].join('\n'),

    format: [
        '**format**',
        '',
        'Semantic format validation for string values.',
        '',
        '**Value type:** string',
        '',
        '**Supported:** `email`, `uri`, `url`, `uuid`, `date-time`, `date`, `time`, `ipv4`, `ipv6`, `hostname`',
        '',
        '```clearschema',
        'email: string: Email address',
        '  ^ format: email',
        '```',
    ].join('\n'),

    min: [
        '**min**',
        '',
        'Minimum value (inclusive) for number/integer fields.',
        '',
        '**Value type:** number',
        '',
        '```clearschema',
        'age: integer: Age in years',
        '  ^ min: 0',
        '```',
    ].join('\n'),

    max: [
        '**max**',
        '',
        'Maximum value (inclusive) for number/integer fields.',
        '',
        '**Value type:** number',
        '',
        '```clearschema',
        'age: integer: Age in years',
        '  ^ max: 150',
        '```',
    ].join('\n'),

    exclusiveMin: [
        '**exclusiveMin**',
        '',
        'Exclusive minimum value for number/integer fields.',
        '',
        '**Value type:** number',
        '',
        '```clearschema',
        'probability: number: Probability',
        '  ^ exclusiveMin: 0',
        '```',
    ].join('\n'),

    exclusiveMax: [
        '**exclusiveMax**',
        '',
        'Exclusive maximum value for number/integer fields.',
        '',
        '**Value type:** number',
        '',
        '```clearschema',
        'probability: number: Probability',
        '  ^ exclusiveMax: 1',
        '```',
    ].join('\n'),

    multipleOf: [
        '**multipleOf**',
        '',
        'Value must be an exact multiple of this number.',
        '',
        '**Value type:** number',
        '',
        '```clearschema',
        'quantity: integer: Order quantity',
        '  ^ multipleOf: 5',
        '```',
    ].join('\n'),

    minItems: [
        '**minItems**',
        '',
        'Minimum number of items in an array.',
        '',
        '**Value type:** integer',
        '',
        '```clearschema',
        'tags: array: Tags',
        '  ^ minItems: 1',
        '```',
    ].join('\n'),

    maxItems: [
        '**maxItems**',
        '',
        'Maximum number of items in an array.',
        '',
        '**Value type:** integer',
        '',
        '```clearschema',
        'tags: array: Tags',
        '  ^ maxItems: 10',
        '```',
    ].join('\n'),

    uniqueItems: [
        '**uniqueItems**',
        '',
        'All array items must be distinct (no duplicates).',
        '',
        '**Value type:** boolean',
        '',
        '```clearschema',
        'tags: array: Tags',
        '  ^ uniqueItems: true',
        '```',
    ].join('\n'),

    default: [
        '**default**',
        '',
        'Default value when the field is omitted. Universal modifier (all types).',
        '',
        '**Value type:** matches field type',
        '',
        '```clearschema',
        'status: string: Status',
        '  ^ default: "pending"',
        '```',
    ].join('\n'),

    const: [
        '**const**',
        '',
        'Field value must be exactly this constant. Universal modifier (all types).',
        '',
        '**Value type:** matches field type',
        '',
        '```clearschema',
        'version: string: API version',
        '  ^ const: "v1"',
        '```',
    ].join('\n'),

    enum: [
        '**enum**',
        '',
        'Restrict field to one of the listed values. Universal modifier (all types).',
        '',
        '**Value type:** array',
        '',
        '```clearschema',
        'status: string: Status',
        '  ^ enum: [active, inactive, archived]',
        '```',
    ].join('\n'),
};

const INLINE_MODIFIER_DOCS: Record<string, string> = {
    required: '**required** — marks the field as mandatory in its parent object.',
    nullable: '**nullable** — allows `null` in addition to the declared type.',
};

const COMPOSITION_DOCS: Record<string, string> = {
    allOf: '**allOf** — the value must match *all* of the listed schemas.',
    anyOf: '**anyOf** — the value must match *at least one* of the listed schemas.',
    oneOf: '**oneOf** — the value must match *exactly one* of the listed schemas.',
};

// ---------------------------------------------------------------------------
// Word extraction helper
// ---------------------------------------------------------------------------

const WORD_CHAR = /[\w.$#/]/;

/**
 * Extract the word under the cursor from a line of text.
 * Returns the word and its start/end character offsets.
 */
function getWordAt(
    lineText: string,
    character: number
): { word: string; start: number; end: number } | null {
    if (character < 0 || character >= lineText.length) {
        return null;
    }

    if (!WORD_CHAR.test(lineText[character])) {
        return null;
    }

    let start = character;
    while (start > 0 && WORD_CHAR.test(lineText[start - 1])) {
        start--;
    }

    let end = character;
    while (end < lineText.length - 1 && WORD_CHAR.test(lineText[end + 1])) {
        end++;
    }

    const word = lineText.slice(start, end + 1);
    return { word, start, end: end + 1 };
}

// ---------------------------------------------------------------------------
// Definition summary helper
// ---------------------------------------------------------------------------

function summarizeDefinition(def: SchemaDefinition): string {
    const lines: string[] = [`**$defs/${def.name}**`, ''];

    const field = def.field;
    if (field.type === 'object' && 'fields' in field) {
        lines.push('| Field | Type | Required |');
        lines.push('|-------|------|----------|');
        for (const f of (field as { fields: Field[] }).fields) {
            const req = f.required ? 'yes' : 'no';
            lines.push(`| \`${f.name}\` | \`${f.type}\` | ${req} |`);
        }
    } else {
        lines.push(`Type: \`${field.type}\``);
    }

    if (field.description) {
        lines.push('', field.description);
    }

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute hover documentation for a position in a ClearSchema document.
 *
 * @param lineText  The full text of the line containing the cursor.
 * @param character 0-based column position of the cursor.
 * @param schema    Cached parse result (may be null).
 * @returns         A Hover object with Markdown content, or null.
 */
export function getHover(
    lineText: string,
    character: number,
    schema: Schema | null
): Hover | null {
    // Comments — no hover
    const trimmed = lineText.trimStart();
    if (trimmed.startsWith('#')) {
        return null;
    }

    const extracted = getWordAt(lineText, character);
    if (!extracted) {
        return null;
    }

    const { word } = extracted;

    // 1. Composition types
    if (word in COMPOSITION_DOCS) {
        return mkHover(COMPOSITION_DOCS[word]);
    }

    // 2. Type keywords
    if (word in TYPE_DOCS) {
        return mkHover(TYPE_DOCS[word]);
    }

    // 3. Modifier lines (^ modifierName: value)
    if (trimmed.startsWith('^')) {
        // Strip optional type prefix (e.g. "string.minLength" → "minLength")
        const modName = word.includes('.') ? word.split('.').pop()! : word;
        if (modName in MODIFIER_DOCS) {
            return mkHover(MODIFIER_DOCS[modName]);
        }
    }

    // 4. Inline modifiers after a dot (.required, .nullable)
    // The word may be "string.required" due to dot in WORD_CHAR
    const lastSegment = word.includes('.') ? word.split('.').pop()! : word;
    if (lastSegment in INLINE_MODIFIER_DOCS && word.includes('.')) {
        return mkHover(INLINE_MODIFIER_DOCS[lastSegment]);
    }
    if (word in INLINE_MODIFIER_DOCS) {
        // Standalone word — check if preceded by a dot in the line
        const idx = lineText.indexOf(word);
        if (idx > 0 && lineText[idx - 1] === '.') {
            return mkHover(INLINE_MODIFIER_DOCS[word]);
        }
    }

    // 5. $ref targets
    if (lineText.includes('$ref:') && schema) {
        // The word might be "Address" from "$ref: #/$defs/Address"
        // or the full path "#/$defs/Address"
        const refName = word.includes('/')
            ? word.split('/').pop()!
            : word;
        const def = schema.definitions.find((d) => d.name === refName);
        if (def) {
            return mkHover(summarizeDefinition(def));
        }
    }

    // 6. Field names — first word before the first colon
    if (schema) {
        const colonIdx = lineText.indexOf(':');
        if (colonIdx > 0) {
            const fieldPart = lineText.slice(0, colonIdx).trim();
            // Remove inline modifiers like .required.nullable
            const baseName = fieldPart.split('.')[0];
            if (word === baseName || word === fieldPart) {
                const field = findFieldByName(schema, baseName);
                if (field) {
                    return mkHover(summarizeField(field));
                }
            }
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mkHover(value: string): Hover {
    return {
        contents: { kind: MarkupKind.Markdown, value },
    };
}

function findFieldByName(schema: Schema, name: string): Field | null {
    // Search top-level fields
    for (const f of schema.fields) {
        if (f.name === name) return f;
    }
    // Search inside definitions
    for (const def of schema.definitions) {
        if (def.field.type === 'object' && 'fields' in def.field) {
            for (const f of (def.field as { fields: Field[] }).fields) {
                if (f.name === name) return f;
            }
        }
    }
    return null;
}

function summarizeField(field: Field): string {
    const lines: string[] = [`**${field.name}**: \`${field.type}\``];

    if (field.description) {
        lines.push('', field.description);
    }

    const constraints: string[] = [];
    if (field.required) constraints.push('required');
    if (field.nullable) constraints.push('nullable');

    // Type-specific constraints
    if (field.type === 'string') {
        if (field.minLength !== undefined) constraints.push(`minLength: ${field.minLength}`);
        if (field.maxLength !== undefined) constraints.push(`maxLength: ${field.maxLength}`);
        if (field.pattern !== undefined) constraints.push(`pattern: ${field.pattern}`);
        if (field.format !== undefined) constraints.push(`format: ${field.format}`);
    } else if (field.type === 'number' || field.type === 'integer') {
        if (field.min !== undefined) constraints.push(`min: ${field.min}`);
        if (field.max !== undefined) constraints.push(`max: ${field.max}`);
    } else if (field.type === 'array') {
        if (field.minItems !== undefined) constraints.push(`minItems: ${field.minItems}`);
        if (field.maxItems !== undefined) constraints.push(`maxItems: ${field.maxItems}`);
    }

    if (constraints.length > 0) {
        lines.push('', '**Constraints:** ' + constraints.join(', '));
    }

    return lines.join('\n');
}
