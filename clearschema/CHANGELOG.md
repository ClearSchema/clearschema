# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-23

### Added

- **Import Resolution** (Phase 3 Complete)
  - Async file loading for external schema imports
  - Circular import detection with clear error messages
  - Wildcard import support (`- *`)
  - Name collision detection
  - Recursive import resolution

- **Reference Resolution** (Phase 3 Complete)
  - Runtime $ref pointer following
  - Resolve references to definitions
  - Support for both `#/$defs/TypeName` and short `TypeName` format
  - Recursive resolution for nested references

- **Pydantic Exporter** (Phase 5 Complete)
  - Full Python Pydantic model generation
  - Smart type mapping (email → EmailStr, uri → HttpUrl, uuid → UUID)
  - Field constraints (min_length, max_length, ge, le, etc.)
  - Optional type handling with typing.Optional
  - Class generation from object types
  - Support for List, Tuple, Union types
  - Description and default value export

- **OpenAPI 3.1 Exporter** (Phase 5 Complete)
  - OpenAPI 3.1.0 specification export
  - Components/schemas generation from $defs
  - Server URL configuration
  - API title, version, and description metadata
  - Builds on JSON Schema Draft 2020-12

- **CLI Enhancements**
  - Support for pydantic and openapi export formats
  - Updated help text with all formats
  - Version bumped to 1.0.0

### Test Coverage
- 232 tests passing (27 new tests)
- Comprehensive tests for import/reference resolution
- Full Pydantic exporter test suite (20 tests)
- OpenAPI exporter tests (6 tests)
- Maintained 93%+ code coverage

### Breaking Changes
- None - fully backward compatible

## [0.6.0] - 2026-01-21

### Added

- Command-line interface (Phase 6 - Complete)
  - CLI tool for parsing and exporting ClearSchema files
  - Support for JSON Schema and TypeScript export formats
  - Options for output file, format selection, and schema version
  - Parse error reporting with clear error messages
  - Help and version commands
  - Executable bin entry: `clearschema`
- Package metadata
  - Updated package.json with proper description, keywords, and license
  - Added bin entry for CLI executable
  - Updated main entry point to dist/index.js

## [0.5.0] - 2026-01-21

### Added

- TypeScript type definition exporter (Phase 5 - Partial)
  - Complete type mapping for all field types
  - Interface generation for object types
  - Proper handling of optional vs required fields
  - Union type support with `|` operator
  - Intersection type support with `&` operator for allOf
  - Tuple type support with `[T1, T2, ...]` syntax
  - Reference resolution from `$defs`
  - Export options: useInterfaces, exportKeyword, includeComments
  - Support for `export`, `declare`, or no keyword
- Comprehensive test suite (205 tests total)
  - 23 tests for TypeScript exporter
  - Tests for primitive types
  - Tests for nullable and optional fields
  - Tests for complex types (objects, arrays, tuples)
  - Tests for union types
  - Tests for definitions and references
  - Tests for composition types
  - Tests for export options

## [0.4.0] - 2026-01-21

### Added

- JSON Schema Draft 2020-12 exporter (Phase 4)
  - Complete type mapping for all field types
  - Modifier to constraint mapping
  - `$defs` and `$ref` export
  - Union type export as `anyOf`
  - Composition type export (allOf, anyOf, oneOf)
  - Nullable field handling with `anyOf` pattern
  - Export options: schema version, descriptions, defaults, root $id
  - Support for JSON Schema Draft 2020-12, 2019-09, and draft-07
- Exporter architecture
  - `Exporter<T>` interface for pluggable exporters
  - `JsonSchemaExporter` class with visitor pattern
  - `exportJsonSchema()` helper function
- Comprehensive test suite (182 tests total)
  - 29 tests for JSON Schema exporter
  - Tests for all primitive types
  - Tests for complex types (objects, arrays, tuples)
  - Tests for nullable fields
  - Tests for union types
  - Tests for references and definitions
  - Tests for composition types
  - Tests for schema metadata and options

## [0.3.0] - 2026-01-21

### Added

- Schema references and advanced types (Phase 3)
  - `$defs` section parsing for reusable schema definitions
  - `$ref` field type for internal schema references
  - Import declarations with `import:` directive
    - Support for specific imports: `- User`, `- Address`
    - Support for wildcard imports: `- *`
  - Union type parsing: `string|number`
    - Union types with inline modifiers: `string|number.required`
    - Type-specific modifiers for union variants
  - Composition types: `allOf`, `anyOf`, `oneOf`
    - Schema composition with references or inline schemas
- Updated AST types
  - Added `ImportDeclaration` interface for import tracking
  - Added `CompositionField` for allOf/anyOf/oneOf
  - Added `resolvedRef` field to `RefField` for reference resolution
  - Added `imports` array to `Schema` interface
- Updated lexer with new token types
  - `IMPORT` token for import declarations
  - `DEFS` token for $defs sections
- Comprehensive test suite (153 tests total)
  - 4 tests for $defs parsing
  - 4 tests for $ref resolution
  - 4 tests for imports
  - 6 tests for union types
  - 3 tests for composition types

## [0.2.0] - 2026-01-20

### Added

- Object field parsing with nested child fields
  - Recursive parsing for arbitrary nesting depth (tested to 5+ levels)
  - Support for mixed content (primitives and nested objects)
- Array field parsing with item types
  - Simple item type specification: `- string`, `- number`, etc.
  - Inline object items: `- object:` with nested fields
  - Array modifiers: minItems, maxItems, uniqueItems
- Tuple array support (`array.tuple`)
  - Positional item types with descriptions
  - Mixed type tuples
- Comprehensive test suite (132 tests, 92%+ coverage)
  - 15 object field tests
  - 19 array field tests
  - 9 tuple array tests
  - 6 integration tests for complex schemas

## [0.1.0] - 2026-01-20

### Added

- Core lexer with indentation state machine
  - Token types: FIELD_LINE, MODIFIER_LINE, ARRAY_ITEM, DEFINITION, NAMESPACE, VERSION, TARGETS, INDENT, DEDENT, EOF
  - TokenStream class for parser consumption
- Recursive descent parser for primitive types
  - Parse complete schema documents with `parse()`
  - Parse single fields with `parseField()`
  - Support for string, number, integer, boolean, null types
- Inline modifiers: `.required`, `.nullable`
- Block modifiers with `^` prefix
  - String: minLength, maxLength, pattern, format
  - Number/Integer: min, max, exclusiveMin, exclusiveMax, multipleOf
  - Universal: default, const, enum
- Schema directives: @namespace, @version, @targets
- Error recovery with resilient parsing
- Comprehensive test suite (83 tests, 92%+ coverage)
