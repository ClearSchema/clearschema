// Public API for ClearSchema parser

// Parser functions
export { parse, parseField } from './parser/parser';

// Error handling
export { ParseError, pos, loc } from './parser/errors';

// Lexer (for advanced usage)
export { tokenize, TokenStream, TokenType } from './lexer/lexer';
export type { Token, LexerResult } from './lexer/lexer';

// AST types
export type {
    // Core types
    Schema,
    Field,
    SchemaDefinition,

    // Field types
    StringField,
    NumberField,
    BooleanField,
    NullField,
    ObjectField,
    ArrayField,
    TupleArrayField,
    UnionField,
    RefField,

    // Type names
    PrimitiveType,
    ComplexType,
    FieldTypeName,

    // Modifiers
    Modifier,
    ModifierValue,

    // Base types
    BaseField,
    ASTNode,
    SourceLocation,
    SourcePosition,
} from './ast/types';
