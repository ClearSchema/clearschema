// Public API for ClearSchema parser

// Parser functions
export { parse, parseField } from './parser/parser';

// Error handling
export { ParseError, pos, loc } from './parser/errors';

// Lexer (for advanced usage)
export { tokenize, TokenStream, TokenType } from './lexer/lexer';
export type { Token, LexerResult } from './lexer/lexer';

// Exporters
export { exportJsonSchema, JsonSchemaExporter } from './exporters/json-schema';
export { exportTypeScript, TypeScriptExporter } from './exporters/typescript';
export type {
    Exporter,
    ExportOptions,
    JsonSchema,
    JsonSchemaField,
    JsonSchemaExportOptions,
    TypeScriptExportOptions,
} from './exporters/types';

// AST types
export type {
    // Core types
    Schema,
    Field,
    SchemaDefinition,
    ImportDeclaration,

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
    CompositionField,

    // Type names
    PrimitiveType,
    ComplexType,
    CompositionType,
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
