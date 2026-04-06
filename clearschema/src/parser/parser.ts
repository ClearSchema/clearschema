import {
    Schema,
    Field,
    StringField,
    NumberField,
    BooleanField,
    NullField,
    ObjectField,
    ArrayField,
    MapField,
    TupleArrayField,
    UnionField,
    RefField,
    CompositionField,
    MatchField,
    SchemaDefinition,
    ImportDeclaration,
    FieldTypeName,
    PrimitiveType,
    CompositionType,
    Modifier,
    ModifierValue,
    SourceLocation,
} from '../ast/types';
import { ParseError, loc } from './errors';
import { tokenize, TokenStream, TokenType } from '../lexer/lexer';

const PRIMITIVE_TYPES: PrimitiveType[] = ['string', 'number', 'integer', 'boolean', 'null'];
const COMPLEX_TYPES: string[] = ['object', 'array', 'array.tuple', 'map'];
const COMPOSITION_TYPES: CompositionType[] = ['allOf', 'anyOf', 'oneOf'];
const ALL_TYPES: string[] = [...PRIMITIVE_TYPES, ...COMPLEX_TYPES, ...COMPOSITION_TYPES, '$ref'];

interface ParsedTypeString {
    type: FieldTypeName;
    required: boolean;
    nullable: boolean;
    discriminator?: string;
}

interface ParsedFieldLine {
    name: string;
    typeInfo: ParsedTypeString;
    description: string;
    location: SourceLocation;
    discriminator?: string;
}

interface ParsedModifier {
    name: string;
    value: ModifierValue;
    location: SourceLocation;
}

interface ArrayItemInfo {
    itemType: Field | FieldTypeName;
    description: string;
    location: SourceLocation;
}

class Parser {
    private stream: TokenStream;
    private source: string;
    private errors: ParseError[] = [];

    constructor(source: string) {
        this.source = source;
        const result = tokenize(source);
        this.stream = new TokenStream(result.tokens);
        this.errors.push(...result.errors);
    }

    parseSchema(): Schema {
        const startPos = this.stream.current().location.start;
        const fields: Field[] = [];
        const definitions: SchemaDefinition[] = [];
        const imports: ImportDeclaration[] = [];
        let namespace: string | undefined;
        let version: string | undefined;
        let targets: string[] | undefined;

        while (!this.stream.isAtEnd()) {
            try {
                if (this.stream.match(TokenType.NAMESPACE)) {
                    namespace = this.parseNamespace();
                } else if (this.stream.match(TokenType.VERSION)) {
                    version = this.parseVersion();
                } else if (this.stream.match(TokenType.TARGETS)) {
                    targets = this.parseTargets();
                } else if (this.stream.match(TokenType.IMPORT)) {
                    imports.push(this.parseImport());
                } else if (this.stream.match(TokenType.DEFS)) {
                    definitions.push(...this.parseDefs());
                } else if (this.stream.match(TokenType.FIELD_LINE)) {
                    fields.push(this.parseFieldWithModifiers());
                } else if (this.stream.match(TokenType.INDENT, TokenType.DEDENT)) {
                    // Skip orphan indent/dedent tokens
                    this.stream.advance();
                } else {
                    this.synchronize();
                }
            } catch (error) {
                if (error instanceof ParseError) {
                    this.errors.push(error);
                    this.synchronize();
                } else {
                    throw error;
                }
            }
        }

        const endPos = this.stream.current().location.end;

        return {
            namespace,
            version,
            targets,
            imports,
            definitions,
            fields,
            errors: this.errors.length > 0 ? this.errors : undefined,
            location: loc(startPos, endPos),
        };
    }

    private parseNamespace(): string {
        const token = this.stream.advance();
        const match = token.value.match(/^@namespace\s+(.+)$/);
        if (match) {
            return match[1].trim();
        }
        throw new ParseError(
            'Invalid namespace directive',
            token.location,
            this.source,
            'Expected @namespace <name>'
        );
    }

    private parseVersion(): string {
        const token = this.stream.advance();
        const match = token.value.match(/^@version\s+(.+)$/);
        if (match) {
            return match[1].trim();
        }
        throw new ParseError(
            'Invalid version directive',
            token.location,
            this.source,
            'Expected @version <version>'
        );
    }

    private parseTargets(): string[] {
        const token = this.stream.advance();
        const match = token.value.match(/^@targets\s+(.+)$/);
        if (match) {
            return match[1].split(',').map(t => t.trim());
        }
        throw new ParseError(
            'Invalid targets directive',
            token.location,
            this.source,
            'Expected @targets <target1>, <target2>, ...'
        );
    }

    private parseImport(): ImportDeclaration {
        const token = this.stream.advance();
        const match = token.value.match(/^import:\s+(.+)$/);
        if (!match) {
            throw new ParseError(
                'Invalid import directive',
                token.location,
                this.source,
                'Expected import: <file-path>'
            );
        }

        const path = match[1].trim();
        const definitions: string[] = [];
        const startPos = token.location.start;
        let endPos = token.location.end;

        // Parse import list (must be indented array items)
        if (this.stream.match(TokenType.INDENT)) {
            this.stream.advance();

            while (!this.stream.match(TokenType.DEDENT) && !this.stream.isAtEnd()) {
                if (this.stream.match(TokenType.ARRAY_ITEM)) {
                    const itemToken = this.stream.advance();
                    const content = itemToken.value.replace(/^-\s*/, '').trim();
                    definitions.push(content);
                    endPos = itemToken.location.end;
                } else {
                    this.stream.advance();
                }
            }

            if (this.stream.match(TokenType.DEDENT)) {
                this.stream.advance();
            }
        }

        return {
            path,
            definitions,
            resolved: false,
            location: loc(startPos, endPos),
        };
    }

    private parseDefs(): SchemaDefinition[] {
        const token = this.stream.advance();
        const definitions: SchemaDefinition[] = [];

        // Must have indent after $defs:
        if (!this.stream.match(TokenType.INDENT)) {
            throw new ParseError(
                'Expected indented definitions after $defs:',
                token.location,
                this.source,
                'Definitions must be indented'
            );
        }

        this.stream.advance();

        // Parse each definition
        while (!this.stream.match(TokenType.DEDENT) && !this.stream.isAtEnd()) {
            if (this.stream.match(TokenType.FIELD_LINE)) {
                const field = this.parseFieldWithModifiers();
                definitions.push({
                    name: field.name,
                    field,
                    location: field.location,
                });
            } else {
                this.stream.advance();
            }
        }

        if (this.stream.match(TokenType.DEDENT)) {
            this.stream.advance();
        }

        return definitions;
    }

    parseFieldWithModifiers(): Field {
        const fieldLine = this.parseFieldLine();

        // Special handling for match type: parse variants instead of normal children
        if (fieldLine.typeInfo.type === 'match') {
            return this.parseMatchBlock(fieldLine);
        }

        const modifiers: ParsedModifier[] = [];
        const childFields: Field[] = [];
        const arrayItems: ArrayItemInfo[] = [];

        // Check for INDENT to look for block content (modifiers, children, array items)
        if (this.stream.match(TokenType.INDENT)) {
            this.stream.advance();

            // Collect block content
            while (!this.stream.match(TokenType.DEDENT) && !this.stream.isAtEnd()) {
                try {
                    if (this.stream.match(TokenType.MODIFIER_LINE)) {
                        modifiers.push(this.parseModifierLine());
                    } else if (this.stream.match(TokenType.FIELD_LINE)) {
                        // Child field (for objects)
                        childFields.push(this.parseFieldWithModifiers());
                    } else if (this.stream.match(TokenType.ARRAY_ITEM)) {
                        // Array item (for arrays/tuples)
                        arrayItems.push(this.parseArrayItem());
                    } else {
                        // Skip unexpected tokens
                        this.stream.advance();
                    }
                } catch (error) {
                    if (error instanceof ParseError) {
                        this.errors.push(error);
                        this.stream.advance(); // Skip bad token
                    } else {
                        throw error;
                    }
                }
            }

            // Consume DEDENT
            if (this.stream.match(TokenType.DEDENT)) {
                this.stream.advance();
            }
        }

        return this.buildField(fieldLine, modifiers, childFields, arrayItems);
    }

    private parseFieldLine(): ParsedFieldLine {
        const token = this.stream.advance();
        const line = token.value;

        // Parse: name: type[.modifiers]: description
        // Format: name: type.required.nullable: description
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
            throw new ParseError(
                'Missing colon in field definition',
                token.location,
                this.source,
                'Expected format: name: type: description'
            );
        }

        const name = line.substring(0, colonIndex).trim();
        const rest = line.substring(colonIndex + 1).trim();

        // Find the second colon for description
        const secondColonIndex = rest.indexOf(':');
        let typeString: string;
        let description: string;

        if (secondColonIndex === -1) {
            // No description provided
            typeString = rest;
            description = '';
        } else {
            typeString = rest.substring(0, secondColonIndex).trim();
            description = rest.substring(secondColonIndex + 1).trim();
        }

        const typeInfo = this.parseTypeString(typeString, token.location);

        return {
            name,
            typeInfo,
            description,
            location: token.location,
            discriminator: typeInfo.discriminator,
        };
    }

    private parseTypeString(typeString: string, location: SourceLocation): ParsedTypeString {
        // Check for union type (contains |)
        if (typeString.includes('|')) {
            return this.parseUnionTypeString(typeString, location);
        }

        // Check for match(discriminator) syntax
        if (typeString.startsWith('match(')) {
            return this.parseMatchTypeString(typeString, location);
        }

        const parts = typeString.split('.');
        let typeName = parts[0];
        let required = false;
        let nullable = false;
        let startIndex = 1;

        // Handle array.tuple as a compound type name
        if (typeName === 'array' && parts.length > 1 && parts[1] === 'tuple') {
            typeName = 'array.tuple';
            startIndex = 2;
        }

        // Handle $ref
        if (typeName === '$ref') {
            typeName = 'ref';
        }

        // Validate type name
        if (!this.isValidType(typeName)) {
            throw new ParseError(
                `Unknown type: "${typeName}"`,
                location,
                this.source,
                `Valid types are: ${ALL_TYPES.join(', ')}`
            );
        }

        // Process inline modifiers
        for (let i = startIndex; i < parts.length; i++) {
            const modifier = parts[i];
            if (modifier === 'required') {
                required = true;
            } else if (modifier === 'nullable') {
                nullable = true;
            } else {
                throw new ParseError(
                    `Unknown inline modifier: "${modifier}"`,
                    location,
                    this.source,
                    'Valid inline modifiers are: required, nullable'
                );
            }
        }

        return {
            type: typeName as FieldTypeName,
            required,
            nullable,
        };
    }

    private parseUnionTypeString(typeString: string, _location: SourceLocation): ParsedTypeString {
        // Split by | but preserve modifiers after the union
        // Format: type1|type2.required.nullable
        let required = false;
        let nullable = false;

        // Extract trailing modifiers
        const lastDot = typeString.lastIndexOf('.');
        if (lastDot !== -1) {
            const afterDot = typeString.substring(lastDot + 1);
            if (afterDot === 'required' || afterDot === 'nullable') {
                const parts = typeString.split('.');
                const modifiers = parts.slice(1);

                for (const mod of modifiers) {
                    if (mod === 'required') required = true;
                    else if (mod === 'nullable') nullable = true;
                }
            }
        }

        return {
            type: 'union',
            required,
            nullable,
        };
    }

    private isValidType(typeName: string): boolean {
        return ALL_TYPES.includes(typeName) || typeName === 'ref' || typeName === 'union' || typeName === 'match';
    }

    private parseModifierLine(): ParsedModifier {
        const token = this.stream.advance();
        const line = token.value;

        // Parse: ^ modifierName: value
        const match = line.match(/^\^\s*(\w+)\s*:\s*(.*)$/);
        if (!match) {
            throw new ParseError(
                'Invalid modifier format',
                token.location,
                this.source,
                'Expected format: ^ modifierName: value'
            );
        }

        const name = match[1];
        const valueStr = match[2].trim();
        const value = this.parseModifierValue(valueStr, token.location);

        return {
            name,
            value,
            location: token.location,
        };
    }

    private parseArrayItem(): ArrayItemInfo {
        const token = this.stream.advance();
        const content = token.value.replace(/^-\s*/, '').trim();
        const location = token.location;

        // Check for inline object: "- object:" or just "- object"
        if (content === 'object:' || content === 'object') {
            // Inline object - parse nested fields
            const childFields: Field[] = [];

            if (this.stream.match(TokenType.INDENT)) {
                this.stream.advance();

                while (!this.stream.match(TokenType.DEDENT) && !this.stream.isAtEnd()) {
                    if (this.stream.match(TokenType.FIELD_LINE)) {
                        childFields.push(this.parseFieldWithModifiers());
                    } else {
                        this.stream.advance();
                    }
                }

                if (this.stream.match(TokenType.DEDENT)) {
                    this.stream.advance();
                }
            }

            const inlineObject: ObjectField = {
                name: '',
                type: 'object',
                description: '',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                fields: childFields,
                location,
            };

            return {
                itemType: inlineObject,
                description: '',
                location,
            };
        }

        // Check for inline map: "- map:" or just "- map"
        if (content === 'map:' || content === 'map') {
            // Inline map - parse nested array items for value type
            const mapItems: ArrayItemInfo[] = [];

            if (this.stream.match(TokenType.INDENT)) {
                this.stream.advance();

                while (!this.stream.match(TokenType.DEDENT) && !this.stream.isAtEnd()) {
                    if (this.stream.match(TokenType.ARRAY_ITEM)) {
                        mapItems.push(this.parseArrayItem());
                    } else {
                        this.stream.advance();
                    }
                }

                if (this.stream.match(TokenType.DEDENT)) {
                    this.stream.advance();
                }
            }

            if (mapItems.length === 0) {
                throw new ParseError(
                    'map type requires exactly one child item defining the value type',
                    location,
                    this.source,
                    'Add a child item like: - string'
                );
            }

            if (mapItems.length > 1) {
                throw new ParseError(
                    `map type accepts exactly one child item defining the value type, but ${mapItems.length} were provided`,
                    location,
                    this.source,
                    'A map can only have one value type'
                );
            }

            const inlineMap: MapField = {
                name: '',
                type: 'map',
                description: '',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                valueType: mapItems[0].itemType,
                location,
            };

            return {
                itemType: inlineMap,
                description: '',
                location,
            };
        }

        // Parse: "type: description" or just "type"
        const colonIndex = content.indexOf(':');
        let typeName: string;
        let description: string;

        if (colonIndex === -1) {
            typeName = content;
            description = '';
        } else {
            typeName = content.substring(0, colonIndex).trim();
            description = content.substring(colonIndex + 1).trim();
        }

        // Validate type
        if (!this.isValidType(typeName) && !PRIMITIVE_TYPES.includes(typeName as PrimitiveType)) {
            throw new ParseError(
                `Unknown array item type: "${typeName}"`,
                location,
                this.source,
                `Valid types are: ${ALL_TYPES.join(', ')}`
            );
        }

        return {
            itemType: typeName as FieldTypeName,
            description,
            location,
        };
    }

    private parseModifierValue(valueStr: string, location: SourceLocation): ModifierValue {
        // Empty value
        if (valueStr === '') {
            return '';
        }

        // Boolean
        if (valueStr === 'true') {
            return true;
        }
        if (valueStr === 'false') {
            return false;
        }

        // Null
        if (valueStr === 'null') {
            return null;
        }

        // Number
        if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
            return parseFloat(valueStr);
        }

        // Array: [value1, value2, ...]
        if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
            return this.parseArrayValue(valueStr, location);
        }

        // String: "value" or 'value' or unquoted
        if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
            (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
            return valueStr.slice(1, -1);
        }

        // Unquoted string
        return valueStr;
    }

    private parseArrayValue(valueStr: string, location: SourceLocation): ModifierValue[] {
        const inner = valueStr.slice(1, -1).trim();
        if (inner === '') {
            return [];
        }

        // Simple parsing: split by comma, handle quoted strings
        const items: ModifierValue[] = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';

        for (let i = 0; i < inner.length; i++) {
            const char = inner[i];

            if ((char === '"' || char === "'") && !inQuote) {
                inQuote = true;
                quoteChar = char;
                current += char;
            } else if (char === quoteChar && inQuote) {
                inQuote = false;
                quoteChar = '';
                current += char;
            } else if (char === ',' && !inQuote) {
                items.push(this.parseModifierValue(current.trim(), location));
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            items.push(this.parseModifierValue(current.trim(), location));
        }

        return items;
    }

    private buildField(
        fieldLine: ParsedFieldLine,
        modifiers: ParsedModifier[],
        childFields: Field[] = [],
        arrayItems: ArrayItemInfo[] = []
    ): Field {
        const { name, typeInfo, description, location } = fieldLine;
        const { type, required, nullable } = typeInfo;

        // Build raw modifiers map and Modifier[] array
        const rawModifiers: Record<string, any> = {};
        const modifierArray: Modifier[] = [];

        for (const mod of modifiers) {
            rawModifiers[mod.name] = mod.value;
            modifierArray.push({
                name: mod.name,
                value: mod.value,
                location: mod.location,
            });
        }

        // Extract universal modifiers
        const defaultVal = rawModifiers['default'];
        const constVal = rawModifiers['const'];
        const enumVal = rawModifiers['enum'] as any[] | undefined;

        // Base field properties
        const baseProps = {
            name,
            description,
            required,
            nullable,
            default: defaultVal,
            const: constVal,
            enum: enumVal,
            rawModifiers,
            modifiers: modifierArray,
            location,
        };

        // Build type-specific field
        switch (type) {
            case 'string':
                return this.buildStringField(baseProps, rawModifiers);
            case 'number':
            case 'integer':
                return this.buildNumberField(baseProps, rawModifiers, type);
            case 'boolean':
                return this.buildBooleanField(baseProps);
            case 'null':
                return this.buildNullField(baseProps);
            case 'object':
                return this.buildObjectField(baseProps, rawModifiers, childFields);
            case 'array':
                return this.buildArrayField(baseProps, rawModifiers, arrayItems);
            case 'map':
                return this.buildMapField(baseProps, arrayItems);
            case 'array.tuple':
                return this.buildTupleArrayField(baseProps, rawModifiers, arrayItems);
            case 'union':
                return this.buildUnionField(baseProps, fieldLine);
            case 'ref':
                return this.buildRefField(baseProps, description);
            case 'allOf':
            case 'anyOf':
            case 'oneOf':
                return this.buildCompositionField(baseProps, type as CompositionType, arrayItems);
            case 'match':
                // Match fields are handled by parseMatchBlock before reaching buildField.
                // This case should not be reached in normal flow.
                throw new ParseError(
                    'Unexpected match type in buildField',
                    location,
                    this.source,
                    'match blocks should be parsed by parseMatchBlock'
                );
            default:
                throw new ParseError(
                    `Unsupported type: ${type}`,
                    location,
                    this.source,
                    `Valid types are: ${ALL_TYPES.join(', ')}`
                );
        }
    }

    private buildStringField(
        baseProps: Omit<StringField, 'type' | 'minLength' | 'maxLength' | 'pattern' | 'format'>,
        rawModifiers: Record<string, any>
    ): StringField {
        // Reject deprecated names with migration hints
        this.rejectDeprecatedModifier(rawModifiers, 'minLength', 'min', baseProps);
        this.rejectDeprecatedModifier(rawModifiers, 'maxLength', 'max', baseProps);

        // Reject gt/lt/exclusiveRange on strings (number/integer only)
        this.rejectNumberOnlyModifier(rawModifiers, 'gt', 'string', baseProps);
        this.rejectNumberOnlyModifier(rawModifiers, 'lt', 'string', baseProps);
        this.rejectNumberOnlyModifier(rawModifiers, 'exclusiveRange', 'string', baseProps);

        // Expand range shorthand
        const range = this.expandRange(rawModifiers, 'min', 'max', baseProps);

        return {
            ...baseProps,
            type: 'string',
            minLength: range?.min ?? rawModifiers['min'] as number | undefined,
            maxLength: range?.max ?? rawModifiers['max'] as number | undefined,
            pattern: rawModifiers['pattern'] as string | undefined,
            format: rawModifiers['format'] as string | undefined,
        };
    }

    private buildNumberField(
        baseProps: Omit<NumberField, 'type' | 'min' | 'max' | 'exclusiveMin' | 'exclusiveMax' | 'multipleOf'>,
        rawModifiers: Record<string, any>,
        type: 'number' | 'integer'
    ): NumberField {
        // Reject deprecated names with migration hints
        this.rejectDeprecatedModifier(rawModifiers, 'exclusiveMin', 'gt', baseProps);
        this.rejectDeprecatedModifier(rawModifiers, 'exclusiveMax', 'lt', baseProps);

        // Expand range and exclusiveRange shorthands
        const range = this.expandRange(rawModifiers, 'min', 'max', baseProps);
        const exRange = this.expandExclusiveRange(rawModifiers, 'gt', 'lt', baseProps);

        return {
            ...baseProps,
            type,
            min: range?.min ?? rawModifiers['min'] as number | undefined,
            max: range?.max ?? rawModifiers['max'] as number | undefined,
            exclusiveMin: exRange?.min ?? rawModifiers['gt'] as number | undefined,
            exclusiveMax: exRange?.max ?? rawModifiers['lt'] as number | undefined,
            multipleOf: rawModifiers['multipleOf'] as number | undefined,
        };
    }

    private buildBooleanField(
        baseProps: Omit<BooleanField, 'type'>
    ): BooleanField {
        this.rejectInvalidTypeModifiers(baseProps, 'boolean');
        return {
            ...baseProps,
            type: 'boolean',
        };
    }

    private buildNullField(
        baseProps: Omit<NullField, 'type'>
    ): NullField {
        this.rejectInvalidTypeModifiers(baseProps, 'null');
        return {
            ...baseProps,
            type: 'null',
        };
    }

    private buildObjectField(
        baseProps: Omit<ObjectField, 'type' | 'fields'>,
        rawModifiers: Record<string, any>,
        childFields: Field[]
    ): ObjectField {
        this.rejectInvalidTypeModifiers(baseProps, 'object');
        return {
            ...baseProps,
            type: 'object',
            fields: childFields,
        };
    }

    private buildArrayField(
        baseProps: Omit<ArrayField, 'type' | 'itemType' | 'minItems' | 'maxItems' | 'uniqueItems'>,
        rawModifiers: Record<string, any>,
        arrayItems: ArrayItemInfo[]
    ): ArrayField {
        // Reject deprecated names with migration hints
        this.rejectDeprecatedModifier(rawModifiers, 'minItems', 'min', baseProps);
        this.rejectDeprecatedModifier(rawModifiers, 'maxItems', 'max', baseProps);

        // Reject gt/lt/exclusiveRange on arrays (number/integer only)
        this.rejectNumberOnlyModifier(rawModifiers, 'gt', 'array', baseProps);
        this.rejectNumberOnlyModifier(rawModifiers, 'lt', 'array', baseProps);
        this.rejectNumberOnlyModifier(rawModifiers, 'exclusiveRange', 'array', baseProps);

        // Expand range shorthand
        const range = this.expandRange(rawModifiers, 'min', 'max', baseProps);

        // Determine item type from array items
        let itemType: Field | FieldTypeName = 'string'; // Default

        if (arrayItems.length > 0) {
            itemType = arrayItems[0].itemType;
        }

        return {
            ...baseProps,
            type: 'array',
            itemType,
            minItems: range?.min ?? rawModifiers['min'] as number | undefined,
            maxItems: range?.max ?? rawModifiers['max'] as number | undefined,
            uniqueItems: rawModifiers['uniqueItems'] as boolean | undefined,
        };
    }

    private buildMapField(
        baseProps: Omit<MapField, 'type' | 'valueType'>,
        arrayItems: ArrayItemInfo[]
    ): MapField {
        this.rejectInvalidTypeModifiers(baseProps, 'map');
        if (arrayItems.length === 0) {
            throw new ParseError(
                'map type requires exactly one child item defining the value type',
                baseProps.location,
                this.source,
                'Add a child item like: - string'
            );
        }

        if (arrayItems.length > 1) {
            throw new ParseError(
                `map type accepts exactly one child item defining the value type, but ${arrayItems.length} were provided`,
                baseProps.location,
                this.source,
                'A map can only have one value type'
            );
        }

        return {
            ...baseProps,
            type: 'map',
            valueType: arrayItems[0].itemType,
        };
    }

    private buildTupleArrayField(
        baseProps: Omit<TupleArrayField, 'type' | 'items'>,
        rawModifiers: Record<string, any>,
        arrayItems: ArrayItemInfo[]
    ): TupleArrayField {
        // Convert array items to tuple items (positional fields)
        const items: Field[] = arrayItems.map((item, index) => {
            if (typeof item.itemType === 'string') {
                // Simple type - create a minimal field
                return {
                    name: `item${index}`,
                    type: item.itemType as FieldTypeName,
                    description: item.description,
                    required: false,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: item.location,
                } as Field;
            } else {
                // Already a Field
                return item.itemType;
            }
        });

        return {
            ...baseProps,
            type: 'array.tuple',
            items,
        };
    }

    private buildUnionField(
        baseProps: Omit<UnionField, 'type' | 'types'>,
        fieldLine: ParsedFieldLine
    ): UnionField {
        // Reject constraint modifiers on union fields — ambiguous without type prefix
        const unionConstraints = ['min', 'max', 'gt', 'lt', 'range', 'exclusiveRange'];
        for (const mod of unionConstraints) {
            if (baseProps.rawModifiers[mod] !== undefined) {
                throw new ParseError(
                    `"${mod}" is ambiguous on union types`,
                    baseProps.location,
                    this.source,
                    `Type-prefixed modifiers (e.g., "string.${mod}") will be supported in a future release`
                );
            }
        }

        // Extract union types from the original type string
        // typeString available via fieldLine.typeInfo.type if needed

        // Parse union from field line
        // Format: type1|type2 or type1|type2.required.nullable
        const colonIndex = this.source.indexOf(':', fieldLine.location.start.offset);
        const secondColonIndex = this.source.indexOf(':', colonIndex + 1);

        let typeStr = '';
        if (secondColonIndex > colonIndex) {
            typeStr = this.source.substring(colonIndex + 1, secondColonIndex).trim();
        }

        // Remove trailing modifiers
        typeStr = typeStr.replace(/\.(required|nullable)+$/, '');

        const types = typeStr.split('|').map(t => t.trim()) as FieldTypeName[];

        return {
            ...baseProps,
            type: 'union',
            types,
        };
    }

    private buildRefField(
        baseProps: Omit<RefField, 'type' | 'ref'>,
        description: string
    ): RefField {
        // Description contains the reference path
        // Format: $ref: #/$defs/TypeName or $ref: TypeName
        const ref = description.trim();

        return {
            ...baseProps,
            type: 'ref',
            ref,
        };
    }

    private buildCompositionField(
        baseProps: Omit<CompositionField, 'type' | 'schemas'>,
        type: CompositionType,
        arrayItems: ArrayItemInfo[]
    ): CompositionField {
        // Composition types have array items that are either refs or inline schemas
        const schemas: (Field | RefField)[] = arrayItems.map((item) => {
            if (typeof item.itemType === 'string') {
                // Should be a ref
                return {
                    name: '',
                    type: 'ref' as const,
                    ref: item.itemType,
                    description: item.description,
                    required: false,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: item.location,
                } as RefField;
            } else {
                return item.itemType;
            }
        });

        return {
            ...baseProps,
            type,
            schemas,
        };
    }

    private parseMatchTypeString(typeString: string, location: SourceLocation): ParsedTypeString {
        // Extract discriminator from match(discriminator) or match(discriminator).required etc.
        const closeParen = typeString.indexOf(')');
        if (closeParen === -1) {
            throw new ParseError(
                'Invalid match syntax: missing closing parenthesis',
                location,
                this.source,
                'Expected format: match(discriminatorField)'
            );
        }

        const discriminator = typeString.substring(6, closeParen).trim(); // 'match('.length === 6
        if (!discriminator) {
            throw new ParseError(
                'match requires a discriminator field name',
                location,
                this.source,
                'Expected format: match(type) or match(kind)'
            );
        }

        // Process inline modifiers after the closing paren: match(type).required
        let required = false;
        let nullable = false;
        const afterParen = typeString.substring(closeParen + 1);
        if (afterParen) {
            const parts = afterParen.split('.').filter(Boolean);
            for (const mod of parts) {
                if (mod === 'required') required = true;
                else if (mod === 'nullable') nullable = true;
                else {
                    throw new ParseError(
                        `Unknown inline modifier: "${mod}"`,
                        location,
                        this.source,
                        'Valid inline modifiers are: required, nullable'
                    );
                }
            }
        }

        return {
            type: 'match',
            required,
            nullable,
            discriminator,
        };
    }

    private parseMatchBlock(fieldLine: ParsedFieldLine): MatchField {
        const { name, typeInfo, description, location, discriminator } = fieldLine;

        if (!discriminator) {
            throw new ParseError(
                'match requires a discriminator field name',
                location,
                this.source,
                'Expected format: match(type)'
            );
        }

        const variants: Record<string, ObjectField | RefField> = {};
        const seenKeys = new Set<string>();

        // Match blocks must have an indented block of variants
        if (!this.stream.match(TokenType.INDENT)) {
            throw new ParseError(
                'match requires at least one variant',
                location,
                this.source,
                'Add variant blocks indented under the match field'
            );
        }
        this.stream.advance(); // consume INDENT

        while (!this.stream.match(TokenType.DEDENT) && !this.stream.isAtEnd()) {
            if (this.stream.match(TokenType.FIELD_LINE)) {
                const variantToken = this.stream.advance();
                const variantLine = variantToken.value;
                const colonIndex = variantLine.indexOf(':');

                if (colonIndex === -1) {
                    throw new ParseError(
                        'Invalid variant syntax',
                        variantToken.location,
                        this.source,
                        'Expected format: variant_key:'
                    );
                }

                const variantKey = variantLine.substring(0, colonIndex).trim();
                const rest = variantLine.substring(colonIndex + 1).trim();

                // Validate variant key is not empty
                if (variantKey === '') {
                    throw new ParseError(
                        'Variant key cannot be empty',
                        variantToken.location,
                        this.source,
                        'Provide a non-empty variant key before the colon'
                    );
                }

                // Validate unique variant keys
                if (seenKeys.has(variantKey)) {
                    throw new ParseError(
                        `Duplicate variant key: "${variantKey}"`,
                        variantToken.location,
                        this.source,
                        'Each variant key must be unique within a match block'
                    );
                }
                seenKeys.add(variantKey);

                // Check if this is a single-line $ref variant: "variantKey: $ref: path"
                if (rest.startsWith('$ref:') || rest === '$ref') {
                    const refPath = rest.startsWith('$ref:') ? rest.substring(5).trim() : '';
                    if (!refPath) {
                        throw new ParseError(
                            'Missing $ref path',
                            variantToken.location,
                            this.source,
                            'Expected format: variant_key: $ref: #/$defs/TypeName'
                        );
                    }
                    variants[variantKey] = {
                        name: variantKey,
                        type: 'ref',
                        ref: refPath,
                        description: '',
                        required: false,
                        nullable: false,
                        rawModifiers: {},
                        modifiers: [],
                        location: variantToken.location,
                    } as RefField;
                } else if (rest === '') {
                    // Variant with indented children: inline object or $ref
                    if (this.stream.match(TokenType.INDENT)) {
                        this.stream.advance(); // consume INDENT

                        // Check first child to detect $ref variant
                        if (this.stream.match(TokenType.FIELD_LINE)) {
                            const peeked = this.stream.current().value.trim();
                            if (peeked.startsWith('$ref:')) {
                                // Single $ref child: parse as ref variant
                                const refToken = this.stream.advance();
                                const refLine = refToken.value.trim();
                                const refColonIdx = refLine.indexOf(':');
                                const refRest = refLine.substring(refColonIdx + 1).trim();
                                // Handle "$ref: path" — the name is "$ref", rest after first colon is "path" or " path: more"
                                // But we need the full ref path which may contain colons (#/$defs/)
                                // Actually for "$ref: #/$defs/TypeName", refColonIdx=4, refRest="#/$defs/TypeName"
                                // But there could be a description colon: "$ref: #/$defs/Type: some desc"
                                // We just want the second segment: after "$ref" the rest is the path
                                const pathPart = refRest.includes(':') ? refRest.substring(0, refRest.indexOf(':')).trim() : refRest;
                                const refPath = pathPart || refRest;

                                variants[variantKey] = {
                                    name: variantKey,
                                    type: 'ref',
                                    ref: refPath,
                                    description: '',
                                    required: false,
                                    nullable: false,
                                    rawModifiers: {},
                                    modifiers: [],
                                    location: refToken.location,
                                } as RefField;

                                // Consume remaining tokens until DEDENT
                                while (!this.stream.match(TokenType.DEDENT) && !this.stream.isAtEnd()) {
                                    this.stream.advance();
                                }
                            } else {
                                // Inline object variant: parse child fields normally
                                const childFields: Field[] = [];
                                while (!this.stream.match(TokenType.DEDENT) && !this.stream.isAtEnd()) {
                                    if (this.stream.match(TokenType.FIELD_LINE)) {
                                        childFields.push(this.parseFieldWithModifiers());
                                    } else if (this.stream.match(TokenType.MODIFIER_LINE)) {
                                        // Skip modifiers at variant level (not supported)
                                        this.stream.advance();
                                    } else {
                                        this.stream.advance();
                                    }
                                }

                                variants[variantKey] = {
                                    name: variantKey,
                                    type: 'object',
                                    fields: childFields,
                                    description: '',
                                    required: false,
                                    nullable: false,
                                    rawModifiers: {},
                                    modifiers: [],
                                    location: variantToken.location,
                                } as ObjectField;
                            }
                        }

                        // Consume DEDENT for variant block
                        if (this.stream.match(TokenType.DEDENT)) {
                            this.stream.advance();
                        }
                    } else {
                        // Variant with no children — empty variant, create empty object
                        variants[variantKey] = {
                            name: variantKey,
                            type: 'object',
                            fields: [],
                            description: '',
                            required: false,
                            nullable: false,
                            rawModifiers: {},
                            modifiers: [],
                            location: variantToken.location,
                        } as ObjectField;
                    }
                } else {
                    throw new ParseError(
                        `Invalid variant syntax after "${variantKey}:"`,
                        variantToken.location,
                        this.source,
                        'Variants must be empty (with indented children) or use $ref: syntax'
                    );
                }
            } else {
                // Skip unexpected tokens
                this.stream.advance();
            }
        }

        // Consume DEDENT for match block
        if (this.stream.match(TokenType.DEDENT)) {
            this.stream.advance();
        }

        if (Object.keys(variants).length === 0) {
            throw new ParseError(
                'match requires at least one variant',
                location,
                this.source,
                'Add variant blocks indented under the match field'
            );
        }

        return {
            name,
            type: 'match',
            discriminator,
            variants,
            description,
            required: typeInfo.required,
            nullable: typeInfo.nullable,
            rawModifiers: {},
            modifiers: [],
            location,
        };
    }

    private expandRange(
        rawModifiers: Record<string, any>,
        minProp: string,
        maxProp: string,
        baseProps: { location: SourceLocation }
    ): { min: number; max: number } | undefined {
        const range = rawModifiers['range'];
        if (range === undefined) return undefined;

        // Validate it's a 2-element array
        if (!Array.isArray(range) || range.length !== 2) {
            throw new ParseError(
                'range requires exactly 2 values [min, max]',
                baseProps.location,
                this.source,
                'Expected format: ^ range: [min, max]'
            );
        }

        const [min, max] = range;

        // Validate both values are finite numbers
        if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max)) {
            throw new ParseError(
                'range values must be finite numbers',
                baseProps.location,
                this.source,
                'Expected format: ^ range: [min, max] where min and max are numbers'
            );
        }

        // Validate min <= max
        if (min > max) {
            throw new ParseError(
                `range minimum (${min}) cannot exceed maximum (${max})`,
                baseProps.location,
                this.source,
            );
        }

        // Check for conflicts with explicit min/max
        if (rawModifiers[minProp] !== undefined) {
            throw new ParseError(
                `Cannot use both 'range' and '${minProp}' on the same field`,
                baseProps.location,
                this.source,
            );
        }
        if (rawModifiers[maxProp] !== undefined) {
            throw new ParseError(
                `Cannot use both 'range' and '${maxProp}' on the same field`,
                baseProps.location,
                this.source,
            );
        }

        return { min, max };
    }

    private expandExclusiveRange(
        rawModifiers: Record<string, any>,
        minProp: string,
        maxProp: string,
        baseProps: { location: SourceLocation }
    ): { min: number; max: number } | undefined {
        const range = rawModifiers['exclusiveRange'];
        if (range === undefined) return undefined;

        // Validate it's a 2-element array
        if (!Array.isArray(range) || range.length !== 2) {
            throw new ParseError(
                'exclusiveRange requires exactly 2 values [min, max]',
                baseProps.location,
                this.source,
                'Expected format: ^ exclusiveRange: [min, max]'
            );
        }

        const [min, max] = range;

        // Validate both values are finite numbers
        if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max)) {
            throw new ParseError(
                'exclusiveRange values must be finite numbers',
                baseProps.location,
                this.source,
                'Expected format: ^ exclusiveRange: [min, max] where min and max are numbers'
            );
        }

        // Validate min <= max
        if (min > max) {
            throw new ParseError(
                `exclusiveRange minimum (${min}) cannot exceed maximum (${max})`,
                baseProps.location,
                this.source,
            );
        }

        // Check for conflicts with explicit gt/lt
        if (rawModifiers[minProp] !== undefined) {
            throw new ParseError(
                `Cannot use both 'exclusiveRange' and '${minProp}' on the same field`,
                baseProps.location,
                this.source,
            );
        }
        if (rawModifiers[maxProp] !== undefined) {
            throw new ParseError(
                `Cannot use both 'exclusiveRange' and '${maxProp}' on the same field`,
                baseProps.location,
                this.source,
            );
        }

        return { min, max };
    }

    private rejectDeprecatedModifier(
        rawModifiers: Record<string, any>,
        oldName: string,
        newName: string,
        baseProps: { location: SourceLocation }
    ): void {
        if (rawModifiers[oldName] !== undefined) {
            throw new ParseError(
                `"${oldName}" is not a valid modifier`,
                baseProps.location,
                this.source,
                `Use "${newName}" instead`
            );
        }
    }

    private rejectNumberOnlyModifier(
        rawModifiers: Record<string, any>,
        modName: string,
        typeName: string,
        baseProps: { location: SourceLocation }
    ): void {
        if (rawModifiers[modName] !== undefined) {
            throw new ParseError(
                `"${modName}" is only valid on number/integer types`,
                baseProps.location,
                this.source,
                `"${modName}" cannot be used on ${typeName} fields`
            );
        }
    }

    private rejectInvalidTypeModifiers(
        baseProps: { rawModifiers: Record<string, any>; location: SourceLocation },
        typeName: string
    ): void {
        const constraintModifiers = ['min', 'max', 'gt', 'lt', 'range', 'exclusiveRange'];
        for (const mod of constraintModifiers) {
            if (baseProps.rawModifiers[mod] !== undefined) {
                throw new ParseError(
                    `"${mod}" is not valid on ${typeName} fields`,
                    baseProps.location,
                    this.source,
                );
            }
        }
    }

    private synchronize(): void {
        // Skip tokens until we find a safe synchronization point
        while (!this.stream.isAtEnd()) {
            const current = this.stream.current();

            // Safe points: start of a new field, dedent, or directive
            if (current.type === TokenType.FIELD_LINE ||
                current.type === TokenType.DEDENT ||
                current.type === TokenType.NAMESPACE ||
                current.type === TokenType.VERSION ||
                current.type === TokenType.TARGETS) {
                return;
            }

            this.stream.advance();
        }
    }

    getErrors(): ParseError[] {
        return this.errors;
    }
}

/**
 * Parse a complete ClearSchema document
 */
export function parse(input: string): Schema {
    const parser = new Parser(input);
    return parser.parseSchema();
}

/**
 * Parse a single field (for testing)
 */
export function parseField(input: string): Field {
    const parser = new Parser(input);
    // Create a minimal schema context and parse the field
    if (!parser['stream'].match(TokenType.FIELD_LINE)) {
        const token = parser['stream'].current();
        throw new ParseError(
            'Expected a field definition',
            token.location,
            input,
            'Input should be a field definition like: name: type: description'
        );
    }
    return parser.parseFieldWithModifiers();
}
