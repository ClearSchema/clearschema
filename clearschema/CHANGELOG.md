# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
