# Changelog

All notable changes to `@clearschema/core` will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [0.4.1] - 2026-04-07

### Fixed

- Correct stale version, test count, and coverage numbers in README

## [0.4.0] - 2026-04-07

### Added

- **Discriminated unions** — `match(discriminator)` keyword for tagged unions, supported across all exporters, importer, and LSP
- **JSON Schema importer** — convert JSON Schema files to ClearSchema DSL, with CLI `import` subcommand
- **ClearSchema DSL serializer** — round-trip AST back to `.clear` source
- **Zod exporter** — full AST type coverage with CLI integration
- **Map/dictionary type** — `map<string, T>` with string keys, supported across all exporters
- **Range shorthand** — `range` and `exclusiveRange` constraint expansion in parser

### Changed

- **Constraint names unified to Zod-style** — `min`, `max`, `gt`, `lt` replace previous names (breaking)
- Serializer outputs Zod-style constraint names
- All test inputs and examples updated to new modifier names

### Fixed

- Validate range array elements are finite numbers
- Escape forward slashes in Zod regex patterns
- CLI flag bounds checking and empty `anyOf` guard in importer

## [0.3.0] - 2026-04-04

### Added

- LLM structured output exporter
- Ship-ready bundle with public API

### Fixed

- Resolve 18 pre-existing lint errors for CI
- Address code review findings for LLM exporter

## [0.2.0] - 2026-01-23

### Added

- Complete parser with all exporters (JSON Schema, TypeScript, Python, Markdown)
- CLI tooling
- Full test coverage

## [0.1.0] - 2026-01-23

### Added

- Core parser implementation
- Initial ClearSchema DSL grammar
