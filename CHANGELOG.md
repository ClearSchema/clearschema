# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-23

### Added

- **Complex Types** (Phase 2)
  - Object field parsing with nested child fields
  - Array field parsing with item types
  - Tuple array support (`array.tuple`)
  - Inline object arrays
  - Deep nesting support (tested to 5+ levels)

- **References & Advanced Types** (Phase 3)
  - `$defs` section parsing for reusable schema definitions
  - `$ref` field type for internal schema references
  - Import declarations with `import:` directive
  - Wildcard import support (`- *`)
  - Union type parsing (`string|number`)
  - Type-specific modifiers for union variants
  - Composition types: `allOf`, `anyOf`, `oneOf`
  - Reference resolution with `resolveReferences()`
  - Async import resolution with `resolveImports()`
  - Circular import detection

- **JSON Schema Exporter** (Phase 4)
  - Complete JSON Schema Draft 2020-12 export
  - Support for Draft 2019-09 and Draft-07
  - Type mapping for all field types
  - Modifier to constraint mapping
  - `$defs` and `$ref` export
  - Union type export as `anyOf`
  - Composition type export
  - Nullable field handling

- **TypeScript Exporter** (Phase 5)
  - TypeScript interface/type generation
  - Proper handling of optional vs required fields
  - Union type support with `|` operator
  - Intersection type support with `&` operator
  - Tuple type support
  - Reference resolution from `$defs`
  - Export options: `useInterfaces`, `exportKeyword`, `includeComments`

- **Pydantic Exporter** (Phase 5)
  - Python Pydantic model generation
  - Smart type mapping (email → EmailStr, uri → HttpUrl, uuid → UUID)
  - Field constraints (min_length, max_length, ge, le, etc.)
  - Optional type handling with `typing.Optional`
  - Support for List, Tuple, Union types

- **OpenAPI Exporter** (Phase 5)
  - OpenAPI 3.1.0 specification export
  - Components/schemas generation from `$defs`
  - Server URL configuration
  - API metadata (title, version, description)

- **CLI Tool** (Phase 6)
  - Command-line interface for parsing and exporting
  - Support for all export formats: json-schema, typescript, pydantic, openapi
  - Options for output file, format selection, schema version
  - Parse error reporting
  - Help and version commands
  - Executable bin entry: `clearschema`

- **VS Code Extension** (Phase 7)
  - TextMate grammar for syntax highlighting
  - File associations (.cs, .clearschema)
  - Language configuration (comments, brackets, indentation)
  - Syntax highlighting for directives, $defs, imports, modifiers

### Changed

- Updated AST types to include `ImportDeclaration`, `CompositionField`, and `RefField`
- Enhanced lexer with `IMPORT` and `DEFS` token types
- Improved error messages with source location tracking

### Test Coverage

- 232 tests passing across 16 test suites
- 93%+ code coverage
- Comprehensive test suites for:
  - Parser (primitives, objects, arrays, tuples, unions, references, imports)
  - All exporters (JSON Schema, TypeScript, Pydantic, OpenAPI)
  - Resolver (import and reference resolution)
  - Integration tests for complex schemas

## [0.1.0] - 2026-01-20

### Added

- Core lexer with indentation state machine
- Token types: FIELD_LINE, MODIFIER_LINE, ARRAY_ITEM, DEFINITION, NAMESPACE, VERSION, TARGETS, INDENT, DEDENT, EOF
- TokenStream class for parser consumption
- Recursive descent parser for primitive types
- Support for string, number, integer, boolean, null types
- Inline modifiers: `.required`, `.nullable`
- Block modifiers with `^` prefix
  - String: minLength, maxLength, pattern, format
  - Number/Integer: min, max, exclusiveMin, exclusiveMax, multipleOf
  - Universal: default, const, enum
- Schema directives: @namespace, @version, @targets
- Error recovery with resilient parsing
- Comprehensive test suite (83 tests, 92%+ coverage)

[0.2.0]: https://github.com/clearschema/clearschema/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/clearschema/clearschema/releases/tag/v0.1.0
