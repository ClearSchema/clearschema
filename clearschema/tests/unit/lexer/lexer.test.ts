import { tokenize, TokenStream, TokenType } from '../../../src/lexer/lexer';

describe('Lexer', () => {
    describe('tokenize', () => {
        describe('basic field lines', () => {
            it('tokenizes a simple field line', () => {
                const input = 'name: string: User name';
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                expect(tokens).toHaveLength(2); // FIELD_LINE + EOF

                expect(tokens[0].type).toBe(TokenType.FIELD_LINE);
                expect(tokens[0].value).toBe('name: string: User name');
                expect(tokens[1].type).toBe(TokenType.EOF);
            });

            it('tokenizes multiple field lines', () => {
                const input = `name: string: Name
age: number: Age`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                expect(tokens).toHaveLength(3); // 2 FIELD_LINE + EOF

                expect(tokens[0].type).toBe(TokenType.FIELD_LINE);
                expect(tokens[0].value).toBe('name: string: Name');
                expect(tokens[1].type).toBe(TokenType.FIELD_LINE);
                expect(tokens[1].value).toBe('age: number: Age');
            });

            it('tokenizes field with inline modifiers', () => {
                const input = 'name: string.required: Required name';
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                expect(tokens[0].type).toBe(TokenType.FIELD_LINE);
                expect(tokens[0].value).toBe('name: string.required: Required name');
            });
        });

        describe('modifier lines', () => {
            it('tokenizes a modifier line with ^', () => {
                const input = '  ^ min: 5';
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                // INDENT + MODIFIER_LINE + DEDENT + EOF
                const modifierToken = tokens.find(t => t.type === TokenType.MODIFIER_LINE);
                expect(modifierToken).toBeDefined();
                expect(modifierToken!.value).toBe('^ min: 5');
            });

            it('tokenizes field with block modifiers', () => {
                const input = `name: string: Name
  ^ min: 2
  ^ max: 50`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);

                const types = tokens.map(t => t.type);
                expect(types).toContain(TokenType.FIELD_LINE);
                expect(types).toContain(TokenType.INDENT);
                expect(types).toContain(TokenType.MODIFIER_LINE);
                expect(types).toContain(TokenType.DEDENT);

                const modifiers = tokens.filter(t => t.type === TokenType.MODIFIER_LINE);
                expect(modifiers).toHaveLength(2);
                expect(modifiers[0].value).toBe('^ min: 2');
                expect(modifiers[1].value).toBe('^ max: 50');
            });
        });

        describe('INDENT/DEDENT tokens', () => {
            it('emits INDENT when indentation increases', () => {
                const input = `field: string: Field
  nested: number: Nested`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                const types = tokens.map(t => t.type);
                expect(types).toContain(TokenType.INDENT);
            });

            it('emits DEDENT when indentation decreases', () => {
                const input = `field: string: Field
  nested: number: Nested
another: string: Another`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                const types = tokens.map(t => t.type);
                expect(types).toContain(TokenType.INDENT);
                expect(types).toContain(TokenType.DEDENT);
            });

            it('emits multiple DEDENTs for nested indentation', () => {
                const input = `a: string: A
  b: string: B
    c: string: C
d: string: D`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                const dedents = tokens.filter(t => t.type === TokenType.DEDENT);
                expect(dedents.length).toBeGreaterThanOrEqual(2);
            });

            it('emits DEDENTs at end of file', () => {
                const input = `a: string: A
  b: string: B`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                // Should have INDENT when going from a to b
                // Should have DEDENT at EOF
                const indents = tokens.filter(t => t.type === TokenType.INDENT);
                const dedents = tokens.filter(t => t.type === TokenType.DEDENT);
                expect(indents).toHaveLength(1);
                expect(dedents).toHaveLength(1);
            });
        });

        describe('empty lines and comments', () => {
            it('skips empty lines', () => {
                const input = `name: string: Name

age: number: Age`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                const fieldTokens = tokens.filter(t => t.type === TokenType.FIELD_LINE);
                expect(fieldTokens).toHaveLength(2);
            });

            it('skips comment lines', () => {
                const input = `# This is a comment
name: string: Name
# Another comment
age: number: Age`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                const fieldTokens = tokens.filter(t => t.type === TokenType.FIELD_LINE);
                expect(fieldTokens).toHaveLength(2);
            });

            it('skips whitespace-only lines', () => {
                const input = `name: string: Name

age: number: Age`;
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                const fieldTokens = tokens.filter(t => t.type === TokenType.FIELD_LINE);
                expect(fieldTokens).toHaveLength(2);
            });
        });

        describe('inconsistent indentation errors', () => {
            it('reports error for inconsistent dedentation', () => {
                const input = `a: string: A
    b: string: B
  c: string: C`;
                const { errors } = tokenize(input);

                expect(errors.length).toBeGreaterThan(0);
                expect(errors[0].message).toContain('Inconsistent indentation');
            });
        });

        describe('directives', () => {
            it('tokenizes @namespace directive', () => {
                const input = '@namespace com.example';
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                expect(tokens[0].type).toBe(TokenType.NAMESPACE);
                expect(tokens[0].value).toBe('@namespace com.example');
            });

            it('tokenizes @version directive', () => {
                const input = '@version 1.0.0';
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                expect(tokens[0].type).toBe(TokenType.VERSION);
                expect(tokens[0].value).toBe('@version 1.0.0');
            });

            it('tokenizes @targets directive', () => {
                const input = '@targets json-schema, typescript';
                const { tokens, errors } = tokenize(input);

                expect(errors).toHaveLength(0);
                expect(tokens[0].type).toBe(TokenType.TARGETS);
                expect(tokens[0].value).toBe('@targets json-schema, typescript');
            });
        });

        describe('location tracking', () => {
            it('tracks line numbers correctly', () => {
                const input = `name: string: Name
age: number: Age`;
                const { tokens } = tokenize(input);

                expect(tokens[0].location.start.line).toBe(1);
                expect(tokens[1].location.start.line).toBe(2);
            });

            it('tracks column numbers correctly', () => {
                const input = '  name: string: Name';
                const { tokens } = tokenize(input);

                const fieldToken = tokens.find(t => t.type === TokenType.FIELD_LINE);
                expect(fieldToken!.location.start.column).toBe(3); // After 2 spaces
            });
        });
    });

    describe('TokenStream', () => {
        let stream: TokenStream;

        beforeEach(() => {
            const input = `name: string: Name
  ^ min: 2
age: number: Age`;
            const { tokens } = tokenize(input);
            stream = new TokenStream(tokens);
        });

        describe('current()', () => {
            it('returns the current token', () => {
                expect(stream.current().type).toBe(TokenType.FIELD_LINE);
            });
        });

        describe('peek()', () => {
            it('peeks at the next token without advancing', () => {
                const current = stream.current();
                const peeked = stream.peek();
                expect(stream.current()).toBe(current);
                expect(peeked.type).toBe(TokenType.INDENT);
            });

            it('peeks at offset tokens', () => {
                const offset2 = stream.peek(2);
                expect(offset2.type).toBe(TokenType.MODIFIER_LINE);
            });
        });

        describe('advance()', () => {
            it('advances to the next token', () => {
                const first = stream.advance();
                expect(first.type).toBe(TokenType.FIELD_LINE);
                expect(stream.current().type).toBe(TokenType.INDENT);
            });

            it('returns current token when advancing', () => {
                const token = stream.advance();
                expect(token.type).toBe(TokenType.FIELD_LINE);
            });
        });

        describe('match()', () => {
            it('returns true when current token matches', () => {
                expect(stream.match(TokenType.FIELD_LINE)).toBe(true);
            });

            it('returns false when current token does not match', () => {
                expect(stream.match(TokenType.MODIFIER_LINE)).toBe(false);
            });

            it('matches multiple token types', () => {
                expect(stream.match(TokenType.FIELD_LINE, TokenType.MODIFIER_LINE)).toBe(true);
            });
        });

        describe('expect()', () => {
            it('advances when token matches', () => {
                const token = stream.expect(TokenType.FIELD_LINE, 'test');
                expect(token.type).toBe(TokenType.FIELD_LINE);
                expect(stream.current().type).toBe(TokenType.INDENT);
            });

            it('throws ParseError when token does not match', () => {
                expect(() => {
                    stream.expect(TokenType.MODIFIER_LINE, 'test');
                }).toThrow();
            });
        });

        describe('isAtEnd()', () => {
            it('returns false when not at EOF', () => {
                expect(stream.isAtEnd()).toBe(false);
            });

            it('returns true when at EOF', () => {
                while (!stream.isAtEnd()) {
                    stream.advance();
                }
                expect(stream.isAtEnd()).toBe(true);
            });
        });

        describe('getPosition() and setPosition()', () => {
            it('gets and sets position correctly', () => {
                const pos = stream.getPosition();
                expect(pos).toBe(0);

                stream.advance();
                stream.advance();
                expect(stream.getPosition()).toBe(2);

                stream.setPosition(0);
                expect(stream.getPosition()).toBe(0);
                expect(stream.current().type).toBe(TokenType.FIELD_LINE);
            });
        });
    });
});
