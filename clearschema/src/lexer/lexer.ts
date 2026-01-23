import { SourceLocation } from '../ast/types';
import { ParseError, pos, loc } from '../parser/errors';

export enum TokenType {
    FIELD_LINE = 'FIELD_LINE',
    MODIFIER_LINE = 'MODIFIER_LINE',
    ARRAY_ITEM = 'ARRAY_ITEM',
    DEFINITION = 'DEFINITION',
    NAMESPACE = 'NAMESPACE',
    VERSION = 'VERSION',
    TARGETS = 'TARGETS',
    IMPORT = 'IMPORT',
    DEFS = 'DEFS',
    INDENT = 'INDENT',
    DEDENT = 'DEDENT',
    EOF = 'EOF',
}

export interface Token {
    type: TokenType;
    value: string;
    location: SourceLocation;
}

export interface LexerResult {
    tokens: Token[];
    errors: ParseError[];
}

function isBlankOrComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('#');
}

function countIndentation(line: string): number {
    let count = 0;
    for (const char of line) {
        if (char === ' ') {
            count++;
        } else if (char === '\t') {
            count += 2; // Treat tab as 2 spaces
        } else {
            break;
        }
    }
    return count;
}

function detectLineType(line: string): TokenType | null {
    const trimmed = line.trim();

    if (trimmed.startsWith('^')) {
        return TokenType.MODIFIER_LINE;
    }

    if (trimmed.startsWith('-')) {
        return TokenType.ARRAY_ITEM;
    }

    if (trimmed.startsWith('@namespace')) {
        return TokenType.NAMESPACE;
    }

    if (trimmed.startsWith('@version')) {
        return TokenType.VERSION;
    }

    if (trimmed.startsWith('@targets')) {
        return TokenType.TARGETS;
    }

    if (trimmed === '$defs:') {
        return TokenType.DEFS;
    }

    if (trimmed.startsWith('import:')) {
        return TokenType.IMPORT;
    }

    if (trimmed.startsWith('define ')) {
        return TokenType.DEFINITION;
    }

    // Check for field line (name: type pattern)
    // A field line has the format: name: type[.modifiers]: description
    // At minimum it needs a colon
    if (trimmed.includes(':')) {
        return TokenType.FIELD_LINE;
    }

    return null;
}

export function tokenize(input: string): LexerResult {
    const tokens: Token[] = [];
    const errors: ParseError[] = [];
    const lines = input.split(/\r?\n/);
    const indentStack: number[] = [0];
    let offset = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineNum = lineIndex + 1;

        // Skip blank lines and comments
        if (isBlankOrComment(line)) {
            offset += line.length + 1; // +1 for newline
            continue;
        }

        const indent = countIndentation(line);
        const currentIndent = indentStack[indentStack.length - 1];
        const trimmed = line.trim();
        const startCol = indent + 1;
        const endCol = line.length + 1;

        // Handle indentation changes
        if (indent > currentIndent) {
            // Emit INDENT
            indentStack.push(indent);
            tokens.push({
                type: TokenType.INDENT,
                value: '',
                location: loc(
                    pos(lineNum, 1, offset),
                    pos(lineNum, indent + 1, offset + indent)
                ),
            });
        } else if (indent < currentIndent) {
            // Emit DEDENT(s)
            while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
                indentStack.pop();
                tokens.push({
                    type: TokenType.DEDENT,
                    value: '',
                    location: loc(
                        pos(lineNum, 1, offset),
                        pos(lineNum, indent + 1, offset + indent)
                    ),
                });
            }

            // Check for inconsistent indentation
            if (indentStack[indentStack.length - 1] !== indent) {
                errors.push(new ParseError(
                    `Inconsistent indentation: expected ${indentStack[indentStack.length - 1]} spaces, got ${indent}`,
                    loc(pos(lineNum, 1, offset), pos(lineNum, indent + 1, offset + indent)),
                    input,
                    'Use consistent indentation (spaces or tabs)'
                ));
            }
        }

        // Detect and emit line token
        const lineType = detectLineType(line);
        if (lineType !== null) {
            tokens.push({
                type: lineType,
                value: trimmed,
                location: loc(
                    pos(lineNum, startCol, offset + indent),
                    pos(lineNum, endCol, offset + line.length)
                ),
            });
        } else {
            errors.push(new ParseError(
                `Unrecognized line format: "${trimmed}"`,
                loc(pos(lineNum, startCol, offset + indent), pos(lineNum, endCol, offset + line.length)),
                input,
                'Expected a field definition, modifier, or directive'
            ));
        }

        offset += line.length + 1; // +1 for newline
    }

    // Emit remaining DEDENTs at end of file
    while (indentStack.length > 1) {
        indentStack.pop();
        const lastLine = lines.length;
        const lastCol = (lines[lastLine - 1]?.length || 0) + 1;
        tokens.push({
            type: TokenType.DEDENT,
            value: '',
            location: loc(
                pos(lastLine, lastCol, offset),
                pos(lastLine, lastCol, offset)
            ),
        });
    }

    // Emit EOF
    const lastLine = lines.length || 1;
    const lastCol = (lines[lastLine - 1]?.length || 0) + 1;
    tokens.push({
        type: TokenType.EOF,
        value: '',
        location: loc(
            pos(lastLine, lastCol, offset),
            pos(lastLine, lastCol, offset)
        ),
    });

    return { tokens, errors };
}

export class TokenStream {
    private tokens: Token[];
    private position: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    current(): Token {
        return this.tokens[this.position] || this.tokens[this.tokens.length - 1];
    }

    peek(offset: number = 1): Token {
        const index = this.position + offset;
        return this.tokens[index] || this.tokens[this.tokens.length - 1];
    }

    advance(): Token {
        const token = this.current();
        if (this.position < this.tokens.length - 1) {
            this.position++;
        }
        return token;
    }

    match(...types: TokenType[]): boolean {
        return types.includes(this.current().type);
    }

    expect(type: TokenType, source: string): Token {
        const token = this.current();
        if (token.type !== type) {
            throw new ParseError(
                `Expected ${type}, got ${token.type}`,
                token.location,
                source,
                `Expected a ${type} token here`
            );
        }
        return this.advance();
    }

    isAtEnd(): boolean {
        return this.current().type === TokenType.EOF;
    }

    getPosition(): number {
        return this.position;
    }

    setPosition(position: number): void {
        this.position = position;
    }
}
