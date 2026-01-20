import {
    Schema,
    Field,
    StringField,
    NumberField,
    BooleanField,
    NullField,
    FieldTypeName,
    PrimitiveType,
    Modifier,
    ModifierValue,
    SourceLocation,
} from '../ast/types';
import { ParseError, loc } from './errors';
import { tokenize, TokenStream, TokenType } from '../lexer/lexer';

const PRIMITIVE_TYPES: PrimitiveType[] = ['string', 'number', 'integer', 'boolean', 'null'];

interface ParsedTypeString {
    type: FieldTypeName;
    required: boolean;
    nullable: boolean;
}

interface ParsedFieldLine {
    name: string;
    typeInfo: ParsedTypeString;
    description: string;
    location: SourceLocation;
}

interface ParsedModifier {
    name: string;
    value: ModifierValue;
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
            definitions: [],
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

    parseFieldWithModifiers(): Field {
        const fieldLine = this.parseFieldLine();
        const modifiers: ParsedModifier[] = [];

        // Check for INDENT to look for block modifiers
        if (this.stream.match(TokenType.INDENT)) {
            this.stream.advance();

            // Collect modifier lines
            while (this.stream.match(TokenType.MODIFIER_LINE)) {
                try {
                    modifiers.push(this.parseModifierLine());
                } catch (error) {
                    if (error instanceof ParseError) {
                        this.errors.push(error);
                        this.stream.advance(); // Skip bad modifier
                    } else {
                        throw error;
                    }
                }
            }

            // Expect DEDENT
            if (this.stream.match(TokenType.DEDENT)) {
                this.stream.advance();
            }
        }

        return this.buildField(fieldLine, modifiers);
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
        };
    }

    private parseTypeString(typeString: string, location: SourceLocation): ParsedTypeString {
        const parts = typeString.split('.');
        const typeName = parts[0];
        let required = false;
        let nullable = false;

        // Validate type name
        if (!this.isValidType(typeName)) {
            throw new ParseError(
                `Unknown type: "${typeName}"`,
                location,
                this.source,
                `Valid types are: ${PRIMITIVE_TYPES.join(', ')}`
            );
        }

        // Process inline modifiers
        for (let i = 1; i < parts.length; i++) {
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

    private isValidType(typeName: string): boolean {
        return PRIMITIVE_TYPES.includes(typeName as PrimitiveType);
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

    private buildField(fieldLine: ParsedFieldLine, modifiers: ParsedModifier[]): Field {
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
            default:
                throw new ParseError(
                    `Unsupported type: ${type}`,
                    location,
                    this.source,
                    'Phase 1 only supports primitive types'
                );
        }
    }

    private buildStringField(
        baseProps: Omit<StringField, 'type' | 'minLength' | 'maxLength' | 'pattern' | 'format'>,
        rawModifiers: Record<string, any>
    ): StringField {
        return {
            ...baseProps,
            type: 'string',
            minLength: rawModifiers['minLength'] as number | undefined,
            maxLength: rawModifiers['maxLength'] as number | undefined,
            pattern: rawModifiers['pattern'] as string | undefined,
            format: rawModifiers['format'] as string | undefined,
        };
    }

    private buildNumberField(
        baseProps: Omit<NumberField, 'type' | 'min' | 'max' | 'exclusiveMin' | 'exclusiveMax' | 'multipleOf'>,
        rawModifiers: Record<string, any>,
        type: 'number' | 'integer'
    ): NumberField {
        return {
            ...baseProps,
            type,
            min: rawModifiers['min'] as number | undefined,
            max: rawModifiers['max'] as number | undefined,
            exclusiveMin: rawModifiers['exclusiveMin'] as number | undefined,
            exclusiveMax: rawModifiers['exclusiveMax'] as number | undefined,
            multipleOf: rawModifiers['multipleOf'] as number | undefined,
        };
    }

    private buildBooleanField(
        baseProps: Omit<BooleanField, 'type'>
    ): BooleanField {
        return {
            ...baseProps,
            type: 'boolean',
        };
    }

    private buildNullField(
        baseProps: Omit<NullField, 'type'>
    ): NullField {
        return {
            ...baseProps,
            type: 'null',
        };
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
