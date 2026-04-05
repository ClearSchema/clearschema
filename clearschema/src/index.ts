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
export { exportPydantic, PydanticExporter } from './exporters/pydantic';
export { exportOpenAPI, OpenAPIExporter } from './exporters/openapi';
export { exportLlmSchema, LlmSchemaExporter } from './exporters/llm-structured-output';
export type { LlmSchemaResult, LlmSchemaExportOptions } from './exporters/llm-structured-output';
export { exportZod, ZodExporter } from './exporters/zod';
export type {
    Exporter,
    ExportOptions,
    JsonSchema,
    JsonSchemaField,
    JsonSchemaExportOptions,
    TypeScriptExportOptions,
    PydanticExportOptions,
    OpenAPIExportOptions,
    OpenAPISchema,
    ZodExportOptions,
} from './exporters/types';

// ClearSchema serializer
export { exportClearSchema, ClearSchemaSerializer } from './exporters/clearschema';

// Importers
export { importJsonSchema, JsonSchemaImporter } from './importers/json-schema';
export type { ImportResult, JsonSchemaImportOptions } from './importers/json-schema';

// Resolvers
export { resolveImports, resolveReferences } from './resolver/resolver';
export type { ResolverOptions, ResolvedSchema } from './resolver/resolver';

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
    MapField,
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
