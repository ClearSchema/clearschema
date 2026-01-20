# ClearSchema Roadmap

A high-level overview of the development phases for ClearSchema.

---

## Phase Summary

| Phase | Name | Focus | Portfolio Value |
|-------|------|-------|-----------------|
| 1 | [Core Parser](docs/phases/PHASE1_CORE_PARSER.md) | Lexer, parser, primitives, modifiers | Shows compiler skills |
| 2 | [Complex Types](docs/phases/PHASE2_COMPLEX_TYPES.md) | Objects, arrays, nesting | Shows recursion handling |
| 3 | [References](docs/phases/PHASE3_REFERENCES.md) | $defs, $ref, imports, unions | Shows symbol resolution |
| 4 | [JSON Schema Export](docs/phases/PHASE4_JSON_SCHEMA.md) | Working output | **Minimum viable portfolio piece** |
| 5 | [Additional Exporters](docs/phases/PHASE5_EXPORTERS.md) | TypeScript, Pydantic, OpenAPI | Shows multi-target codegen |
| 6 | [CLI & Tooling](docs/phases/PHASE6_CLI.md) | CLI, validation, formatting | Shows developer tooling |
| 7 | [VS Code & LSP](docs/phases/PHASE7_VSCODE_LSP.md) | Editor integration | **Table stakes for adoption** |
| 8 | [Adoption](docs/phases/PHASE8_ADOPTION.md) | Docs, playground, community | **Required for real users** |

---

## Phase Details

### Phase 1: Core Parser Foundation
**Status:** Not Started

Build the foundational lexer and parser for primitive types with modifiers.

- Project setup (TypeScript, Jest, ESLint)
- Indentation State Machine lexer (INDENT/DEDENT tokens)
- Recursive descent parser with error recovery
- Primitive types: `string`, `number`, `integer`, `boolean`, `null`
- Modifier parsing mapped to first-class AST properties
- Excellent error messages with line/column info

**Milestone:** Parse basic schemas with primitives and modifiers.

---

### Phase 2: Complex Types
**Status:** Not Started

Extend parser to handle nested structures.

- Object field parsing with nested children
- Array parsing with item types
- Tuple array support (`array.tuple`)
- Inline object arrays
- Deep nesting and indentation handling

**Milestone:** Parse arbitrarily nested object/array structures.

---

### Phase 3: References & Advanced Types
**Status:** Not Started

Add schema reuse and composition features.

- `$defs` section parsing
- `$ref` resolution (internal JSON pointers)
- External file imports with async resolution
- Union type parsing with type-prefixed modifiers
- Composition types: `allOf`, `anyOf`, `oneOf`
- Circular reference detection

**Milestone:** Full schema language support.

---

### Phase 4: JSON Schema Export
**Status:** Not Started

First working export target.

- Exporter architecture with visitor pattern
- Complete type mapping to JSON Schema Draft 2020-12
- Modifier to constraint mapping
- `$defs` and `$ref` export
- Export options (schema version, titles, descriptions)

**Milestone:** Generate valid, standards-compliant JSON Schema.

---

### Phase 5: Additional Exporters
**Status:** Not Started

Multi-target code generation.

- TypeScript type/interface export
- Python Pydantic model export
- OpenAPI 3.1 schema export
- Smart type mapping (e.g., `format: email` → `EmailStr`)

**Milestone:** One schema, multiple outputs.

---

### Phase 6: CLI & Tooling
**Status:** Not Started

Developer experience polish.

- CLI tool for parsing and export
- Schema validation command
- Format conversion commands
- Watch mode for development
- npm package publication

**Milestone:** `npx clearschema` works.

---

### Phase 7: VS Code Extension & LSP
**Status:** Not Started

First-class editor support.

- TextMate grammar for syntax highlighting
- VS Code extension scaffolding
- LSP server: diagnostics, autocomplete, hover, go-to-definition
- Document symbols (outline view)
- VS Code marketplace publishing

**Milestone:** Real-time feedback while authoring schemas.

---

### Phase 8: Documentation & Adoption
**Status:** Not Started

Make the project discoverable and contributor-friendly.

- Docusaurus documentation site
- Online playground with live preview
- Comparison guides (vs JSON Schema, Zod, TypeSpec)
- Migration guide from JSON Schema
- GitHub polish (issue templates, CONTRIBUTING.md, CI/CD)
- Community setup

**Milestone:** Ready for public launch.

---

## Documentation Index

### Core Documentation
- [Architecture Decisions](docs/ARCHITECTURE.md) - Design rationale and type system
- [Grammar Specification](docs/GRAMMAR.md) - EBNF grammar and syntax reference
- [Testing Strategy](docs/TESTING.md) - TDD approach and test specifications

### Phase Documentation
- [Phase 1: Core Parser](docs/phases/PHASE1_CORE_PARSER.md)
- [Phase 2: Complex Types](docs/phases/PHASE2_COMPLEX_TYPES.md)
- [Phase 3: References](docs/phases/PHASE3_REFERENCES.md)
- [Phase 4: JSON Schema Export](docs/phases/PHASE4_JSON_SCHEMA.md)
- [Phase 5: Additional Exporters](docs/phases/PHASE5_EXPORTERS.md)
- [Phase 6: CLI & Tooling](docs/phases/PHASE6_CLI.md)
- [Phase 7: VS Code & LSP](docs/phases/PHASE7_VSCODE_LSP.md)
- [Phase 8: Adoption](docs/phases/PHASE8_ADOPTION.md)

---

## Success Criteria

### Minimum Viable Product (Phase 4)
- [ ] Parse all documented syntax
- [ ] Export valid JSON Schema Draft 2020-12
- [ ] Clear error messages with source locations
- [ ] 90%+ test coverage

### Production Ready (Phase 6)
- [ ] npm package published
- [ ] CLI works end-to-end
- [ ] TypeScript + Pydantic exports complete
- [ ] Documentation covers all features

### Adoption Ready (Phase 8)
- [ ] Documentation site live
- [ ] Online playground functional
- [ ] VS Code extension published
- [ ] Community channels established
