---
title: "feat: Add JSON Schema reverse importer with .clear serializer"
type: feat
status: completed
date: 2026-04-05
deepened: 2026-04-05
---

# feat: Add JSON Schema reverse importer with .clear serializer

## Overview

Add a `clearschema import` command and programmatic API that reads JSON Schema (Draft 2020-12, 2019-09, Draft-07) and produces idiomatic `.clear` files. This is a two-stage pipeline: Stage 1 converts JSON Schema to the existing `Schema` AST (enabling re-export to TypeScript, Zod, Pydantic, etc.), and Stage 2 serializes the AST to `.clear` DSL text (a novel capability that doesn't exist in the codebase today).

## Problem Frame

The cold-start problem is the biggest DSL adoption barrier. Teams with existing JSON Schema files have no migration path to ClearSchema. A reverse importer (`clearschema import schema.json -o output.clear`) enables one-command adoption on existing projects. This is idea #6 from the ideation doc.

## Requirements Trace

- R1. Import JSON Schema Draft 2020-12, 2019-09, and Draft-07 files into ClearSchema AST
- R2. Serialize ClearSchema AST to idiomatic `.clear` DSL text (new ClearSchema exporter)
- R3. CLI subcommand: `clearschema import <file> [-o output.clear]`
- R4. Programmatic API: `importJsonSchema(obj, options?)` returning `{ schema: Schema, warnings: string[] }`
- R5. Handle ambiguous JSON Schema patterns (nullable `anyOf`, union vs composition, map vs object) with documented heuristics
- R6. Warn on unsupported JSON Schema keywords (e.g., `patternProperties`, `if/then/else`, `dependentSchemas`)
- R7. Round-trip fidelity: `.clear` -> JSON Schema -> import -> `.clear` should produce structurally equivalent output
- R8. Support re-export to any format directly from import CLI (e.g., `clearschema import schema.json -f typescript -o types.ts`)

## Scope Boundaries

- Single-file JSON Schema only. External `$ref` (cross-file, URL) produces a warning and is preserved as a raw `RefField` — not resolved
- No `import:` declarations generated (no cross-file ClearSchema output)
- `patternProperties`, `if/then/else`, `dependentSchemas`, `not` are warned and dropped (not stored in `rawModifiers` — keeping it simple for v1)
- Boolean schemas (`true`/`false`) are not supported as top-level schemas — only as `additionalProperties` values
- No interactive/streaming mode — batch file processing only

## Context & Research

### Relevant Code and Patterns

- `clearschema/src/exporters/json-schema.ts` — The Rosetta Stone. Contains the full AST-to-JSON-Schema mapping to reverse
- `clearschema/src/ast/types.ts` — Target AST types the importer must produce (`Schema`, `Field` discriminated union, `BaseField`, `SchemaDefinition`)
- `clearschema/src/exporters/types.ts` — `Exporter<T>` interface pattern (class + free function + options)
- `clearschema/src/exporters/llm-structured-output.ts` — Precedent for `{ schema, warnings }` return type (`LlmSchemaResult`)
- `clearschema/src/cli/index.ts` — Hand-rolled arg parser with if/else dispatch chain
- `clearschema/src/index.ts` — Public API barrel file
- `examples/ecommerce.clear` — Complex example with `$defs`, `$ref`, nested objects, arrays, composition

### External References

- JSON Schema Draft 2020-12: `$defs`, `prefixItems` for tuples, `items: false` to close tuples
- JSON Schema Draft-07: `definitions` instead of `$defs`, `items` as array for tuples, `additionalItems: false`
- JSON Schema 2019-09: Transitional — supports both `$defs` and `definitions`

## Key Technical Decisions

- **Two-stage pipeline**: Stage 1 (`JsonSchemaImporter`) produces `Schema` AST. Stage 2 (`ClearSchemaSerializer`) produces `.clear` text. Both are independently useful — Stage 1 enables JSON Schema -> TypeScript/Zod/Pydantic conversion without `.clear` as an intermediary
- **Return type follows `LlmSchemaResult` pattern**: `{ schema: Schema, warnings: string[] }` for the programmatic API, warnings to stderr for CLI
- **`anyOf` disambiguation heuristic**: (1) Exactly two elements where one is `{ type: "null" }` with no other properties -> nullable wrapper on the other element; outer-level modifiers (`description`, `default`, `const`, `enum`) merge onto the unwrapped field (inner field's own values take precedence if both exist). (2) All elements are simple `{ type: "<primitive>" }` with no other properties -> `UnionField`. (3) Everything else -> `CompositionField` with `type: 'anyOf'`. **Known limitation:** Flattened nullable unions (`{ anyOf: [{type: "string"}, {type: "number"}, {type: "null"}] }`) degrade to `CompositionField` rather than nullable `UnionField` — this is a common pattern in OpenAPI codegen output but handling it correctly requires lookahead heuristics that are deferred to a future version
- **Map detection**: Object with `additionalProperties` (as schema, not `false`) and NO `properties` (absent or empty `{}`) -> `MapField`. All other objects -> `ObjectField`. `additionalProperties: false` is silently dropped (it's the default ClearSchema behavior). Object with both `properties` and `additionalProperties` (as schema) -> `ObjectField` with warning that `additionalProperties` is dropped (lossy)
- **`$ref` normalization**: `#/definitions/X` (Draft-07) is normalized to `#/$defs/X` on import, matching the resolver's expectations. External refs produce a warning and are stored as-is in `RefField.ref`
- **`$ref` + description limitation**: The `.clear` grammar puts the ref path in the description slot (`name: $ref: #/$defs/TypeName`), so `RefField` nodes with both `ref` and `description` will lose the description during serialization. This is a known round-trip gap
- **Tuple detection**: For Draft 2020-12: `prefixItems: [...]` + `items: false` -> `TupleArrayField`. For Draft-07: `items: [...]` (as array) + `additionalItems: false` -> `TupleArrayField`. Regular `items` as object -> `ArrayField`
- **Draft detection**: Read `$schema` URI if present. If absent, use heuristic: presence of `$defs` -> 2020-12, `definitions` -> Draft-07, both -> 2019-09. Default to 2020-12
- **Synthetic `SourceLocation`**: All imported AST nodes use zeroed-out locations `{ start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } }`
- **CLI architecture**: Intercept `args[0] === 'import'` in `main()` **before** calling `parseArgs()`, branching to a separate `handleImport(args.slice(1))` function. This keeps `parseArgs` unmodified and the existing export flow untouched
- **ClearSchema serializer as a new exporter**: Lives in `src/exporters/clearschema.ts`, follows the `Exporter<string>` pattern. Produces indented `.clear` DSL text with 2-space indentation. No options type needed for v1 — just `export(schema): string`
- **No generic `Importer` interface**: Only one importer exists, so define `JsonSchemaImporter` directly with concrete types. `ImportResult`, `JsonSchemaImportOptions`, helper functions (`syntheticLocation`, `createBaseField`) all live in `src/importers/json-schema.ts` — no separate `types.ts` or `utils.ts` files

## Open Questions

### Resolved During Planning

- **Should unsupported keywords be stored in `rawModifiers`?** No — keeping v1 simple. Warn and drop. Can revisit if round-trip fidelity demands it
- **Should the API return warnings?** Yes — follows `LlmSchemaResult` precedent
- **How to handle `required` distribution?** JSON Schema puts `required: string[]` on parent. Importer distributes to per-field `required: boolean` on child `Field` nodes
- **`const` vs `enum` precedence?** Follow existing exporter convention: `const` takes precedence when both are present

- **How to handle `description` on nullable `anyOf` wrappers?** When unwrapping `anyOf: [X, {type: "null"}]`, if the outer wrapper has a `description` and the inner schema also has one, the inner schema's description wins. If only the outer has one, it propagates to the unwrapped field. This matches the principle of preserving the most specific information

### Deferred to Implementation

- Exact formatting choices for the `.clear` serializer (comment placement, blank lines between sections) — will be guided by matching existing example file style
- Handling of `examples` keyword (not in the AST currently — likely warn and drop)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
JSON Schema file (.json)
    |
    v
[JsonSchemaImporter]
    |-- detectDraft(schema) -> '2020-12' | '2019-09' | 'draft-07'
    |-- importSchema(root) -> Schema
    |     |-- importDefinitions($defs || definitions) -> SchemaDefinition[]
    |     |-- importFields(properties, required[]) -> Field[]
    |           |-- importField(name, jsonSchemaField) -> Field
    |                 |-- detectNullable(anyOf) -> unwrap or pass through
    |                 |-- detectUnion(anyOf) -> UnionField or CompositionField
    |                 |-- detectMap(object + additionalProperties) -> MapField or ObjectField
    |                 |-- detectTuple(array + prefixItems/items[]) -> TupleArrayField or ArrayField
    |                 |-- importConstraints() -> type-specific modifier fields
    |
    v
Schema AST  -----> [existing exporters: TypeScript, Zod, Pydantic, etc.]
    |
    v
[ClearSchemaSerializer]
    |-- serializeSchema(schema) -> string
    |     |-- serializeDefinitions(defs) -> "$defs:\n  ..."
    |     |-- serializeField(field, indent) -> "name: type.required.nullable: desc\n  ^ mod: val"
    |           |-- serializeModifiers(field) -> "^ key: value" lines
    |           |-- serializeChildren(field) -> indented child fields / array items
    |
    v
.clear text output
```

## Implementation Units

- [x] **Unit 1: JSON Schema to AST converter (core importer)**

**Goal:** Convert JSON Schema objects to ClearSchema `Schema` AST with full type coverage, disambiguation heuristics, types, and helpers — all in one file

**Requirements:** R1, R4, R5, R6

**Dependencies:** None

**Files:**
- Create: `clearschema/src/importers/json-schema.ts`
- Test: `clearschema/tests/unit/importers/json-schema.test.ts`

**Approach:**
- `ImportResult` type as `{ schema: Schema, warnings: string[] }` and `JsonSchemaImportOptions` with optional `defaultDraft` — defined in the same file
- Private `syntheticLocation()` and `createBaseField(name, type, description)` helpers in the same file
- `JsonSchemaImporter` class with `import(jsonSchema, options?): ImportResult`
- Private `importField(name, schema)` method with switch on detected type
- Draft detection: parse `$schema` URI, fall back to `$defs` vs `definitions` heuristic
- `$defs`/`definitions` -> `SchemaDefinition[]`, with `#/definitions/X` normalized to `#/$defs/X`
- `required` array on parent distributed to per-field `required: boolean`
- Nullable detection: 2-element `anyOf` where one element is `{ type: "null" }` with no other keys; merge outer-level modifiers (`description`, `default`, `const`, `enum`) onto unwrapped field (inner takes precedence)
- Union detection: all `anyOf` elements are simple `{ type: "<primitive>" }` with no other keys
- Map detection: `type: "object"` with `additionalProperties` (as schema) and no `properties` (absent or empty `{}`)
- Tuple detection: `prefixItems` + `items: false` (2020-12) or `items` as array + `additionalItems: false` (Draft-07)
- Unsupported keywords (`patternProperties`, `if/then/else`, `dependentSchemas`, `not`) -> push warning string, skip
- Free function `importJsonSchema(input, options?): ImportResult` wrapping the class

**Patterns to follow:**
- `clearschema/src/exporters/json-schema.ts` for the field type switch/dispatch pattern (inverted)
- `clearschema/src/exporters/llm-structured-output.ts` for warnings accumulation

**Test scenarios:**
- Happy path: Import simple object with string/number/boolean/null fields -> correct AST field types and names
- Happy path: Import string field with `minLength`, `maxLength`, `pattern`, `format` -> `StringField` with constraints
- Happy path: Import number/integer with `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` -> `NumberField` with mapped constraints (`min`/`max`/`exclusiveMin`/`exclusiveMax`)
- Happy path: Import object with nested `properties` and `required` array -> `ObjectField` with correctly distributed `required: boolean` per child
- Happy path: Import `$defs` with multiple definitions -> `Schema.definitions` as `SchemaDefinition[]`
- Happy path: Import `$ref: "#/$defs/Foo"` -> `RefField` with `ref: "#/$defs/Foo"`
- Happy path: Import `definitions` (Draft-07) -> normalized to `$defs` in AST, `$ref` paths normalized
- Happy path: Import array with `items: { type: "string" }` -> `ArrayField` with `itemType: 'string'`
- Happy path: Import array with `minItems`, `maxItems` -> `ArrayField` with constraints
- Happy path: Import tuple with `prefixItems` (2020-12) -> `TupleArrayField`
- Happy path: Import tuple with `items` as array (Draft-07) + `additionalItems: false` -> `TupleArrayField`
- Happy path: Import map (object with `additionalProperties`, no `properties`) -> `MapField`
- Happy path: Import `allOf`/`oneOf` with multiple schemas -> `CompositionField`
- Happy path: Import field with `const`, `enum`, `default`, `description` -> correct universal modifiers
- Edge case: Nullable detection — `anyOf: [{type: "string"}, {type: "null"}]` -> `StringField` with `nullable: true`
- Edge case: Nullable detection — `anyOf: [{$ref: "#/$defs/Foo"}, {type: "null"}]` -> `RefField` with `nullable: true`
- Edge case: Union detection — `anyOf: [{type: "string"}, {type: "number"}]` -> `UnionField` with `types: ['string', 'number']`
- Edge case: Complex `anyOf` (non-primitive schemas) -> `CompositionField` with `type: 'anyOf'`
- Edge case: 3+ element `anyOf` with null included -> `CompositionField` (not nullable union)
- Edge case: Object with both `properties` and `additionalProperties` -> `ObjectField` (additionalProperties dropped, warning emitted)
- Edge case: Object with `additionalProperties: false` -> `ObjectField` (no map, no warning)
- Edge case: Object with empty `properties: {}` and `additionalProperties: { type: "string" }` -> `MapField` (empty properties treated as absent)
- Edge case: Empty object `{ type: "object" }` with no properties -> `ObjectField` with empty `fields: []`
- Edge case: Nullable field with outer-level `default: null` -> `default` merged onto unwrapped field
- Edge case: Nullable `$ref` -> `RefField` with `nullable: true`, description lost (known limitation)
- Edge case: Draft auto-detection from `$schema` URI for each of the three supported drafts
- Edge case: Draft fallback heuristic when `$schema` is absent
- Error path: Unsupported keyword `patternProperties` -> warning in result, keyword ignored
- Error path: Unsupported keyword `if/then/else` -> warning, ignored
- Error path: External `$ref` (`./other.json#/definitions/X`) -> warning, stored as-is in `RefField`
- Error path: Unrecognized `type` value -> warning, fallback to `ObjectField`

**Verification:**
- All JSON Schema type mappings produce correct AST node types. Warnings array populated for unsupported features. Draft detection works for all three versions.

---

- [x] **Unit 2: ClearSchema DSL serializer**

**Goal:** Serialize a `Schema` AST to idiomatic `.clear` DSL text

**Requirements:** R2, R7

**Dependencies:** None (can be built in parallel with Unit 1 — only depends on AST types)

**Files:**
- Create: `clearschema/src/exporters/clearschema.ts`
- Test: `clearschema/tests/unit/exporters/clearschema.test.ts`

**Approach:**
- `ClearSchemaSerializer` class implementing `Exporter<string>` with `export(schema, options?): string`
- No options for v1 — just `export(schema): string` with 2-space indentation
- Serialize `$defs` block first (if any), then root fields
- Field format: `name: type[.required][.nullable]: description`
- Modifier format: indented `^ key: value` lines under their field
- Array items: indented `- itemType` under their array field
- Inline objects in arrays: `- object:` followed by further-indented fields
- Map children: `- valueType` under the map field
- `$ref` fields: `name: $ref: #/$defs/TypeName`
- Composition fields: `name: allOf|anyOf|oneOf:` with indented `- $ref: ...` or inline schemas
- Union fields: `name: string|number` (pipe-separated types on the field line)
- Enum modifier: `^ enum: [val1, val2, val3]`
- Const modifier: `^ const: value`
- Default modifier: `^ default: value`
- Free function `exportClearSchema(schema, options?): string`
- Match the style of existing `.clear` examples (2-space indent, no trailing blank lines within blocks)

**Patterns to follow:**
- `clearschema/src/exporters/zod.ts` for string-output exporter pattern
- `examples/user.clear` and `examples/ecommerce.clear` for target output style

**Test scenarios:**
- Happy path: Serialize simple object with string/number/boolean fields -> correct field line format
- Happy path: Serialize field with `.required` and `.nullable` modifiers -> inline modifiers on field line
- Happy path: Serialize string field with `minLength`, `maxLength`, `pattern`, `format` -> `^` modifier lines
- Happy path: Serialize number field with `min`, `max`, `multipleOf` -> correct modifier names
- Happy path: Serialize nested object -> child fields indented one level deeper
- Happy path: Serialize array with primitive item type -> `- string` child line
- Happy path: Serialize array with complex item type (inline object) -> `- object:` with indented children
- Happy path: Serialize tuple -> multiple `- type` children (not yet clear if tuple syntax is `array.tuple` in DSL — check grammar)
- Happy path: Serialize map with primitive value type -> `- string` child
- Happy path: Serialize `$defs` block with multiple definitions -> correct `$defs:` header and indented definitions
- Happy path: Serialize `$ref` field -> `name: $ref: #/$defs/TypeName`
- Happy path: Serialize union -> `name: string|number` pipe syntax
- Happy path: Serialize `allOf`/`anyOf`/`oneOf` composition -> composition syntax
- Happy path: Serialize `enum`, `const`, `default` modifiers -> correct `^` lines
- Happy path: Serialize field with description -> description after second colon
- Edge case: Field with no description -> no trailing colon
- Edge case: Deeply nested objects (3+ levels) -> correct indentation accumulation
- Edge case: Array with `minItems`/`maxItems` modifiers -> modifier lines under the array field
- Edge case: Empty schema (no fields, no defs) -> empty string or minimal output
- Edge case: `$ref` field with `description` set -> description dropped (grammar limitation), ref path serialized correctly

**Verification:**
- Output parses back to equivalent AST when fed through `parse()`. Style matches existing `.clear` examples.

---

- [x] **Unit 3: CLI `import` subcommand**

**Goal:** Wire the import pipeline into the CLI as `clearschema import <file> [-o output] [-f format]`

**Requirements:** R3, R8

**Dependencies:** Units 1, 2

**Files:**
- Modify: `clearschema/src/cli/index.ts`
- Test: `clearschema/tests/unit/cli/import.test.ts`

**Approach:**
- In `main()`, check `args[0] === 'import'` **before** calling `parseArgs()` — branch to `handleImport(args.slice(1))`. Do not modify `parseArgs` itself
- `handleImport` parses remaining args: input file, `-o` output, `-f` format (default: `clear`)
- When format is `clear`: JSON Schema -> AST -> `.clear` text via `ClearSchemaSerializer`
- When format is another exporter (e.g., `typescript`, `zod`): JSON Schema -> AST -> that exporter's output (bonus: enables `clearschema import schema.json -f typescript -o types.ts`)
- Print warnings to stderr
- Update help text with import subcommand usage and examples
- Read input file, `JSON.parse()` it, handle parse errors

**Patterns to follow:**
- Existing CLI structure in `clearschema/src/cli/index.ts` for arg parsing and error handling
- LLM schema CLI section for warnings-to-stderr pattern

**Test scenarios:**
- Happy path: `clearschema import schema.json` writes `.clear` to stdout
- Happy path: `clearschema import schema.json -o output.clear` writes to file
- Happy path: `clearschema import schema.json -f typescript -o types.ts` imports then re-exports
- Error path: Missing input file -> error message and exit 1
- Error path: File not found -> error message and exit 1
- Error path: Invalid JSON -> error message and exit 1
- Happy path: `clearschema import --help` shows import-specific help
- Integration: Warnings from importer printed to stderr

**Verification:**
- CLI accepts `import` subcommand without breaking existing export functionality. Help text updated.

---

- [x] **Unit 4: Public API exports and barrel file**

**Goal:** Expose the importer and serializer through the public API

**Requirements:** R4

**Dependencies:** Units 1, 2

**Files:**
- Modify: `clearschema/src/index.ts`

**Approach:**
- Export `importJsonSchema`, `JsonSchemaImporter` from `src/importers/json-schema.ts`
- Export `ImportResult`, `JsonSchemaImportOptions` types from `src/importers/json-schema.ts`
- Export `exportClearSchema`, `ClearSchemaSerializer` from `src/exporters/clearschema.ts`

**Patterns to follow:**
- Existing barrel exports in `clearschema/src/index.ts`

**Test expectation: none** -- this is wiring/re-export only, verified by TypeScript compilation

**Verification:**
- `import { importJsonSchema, exportClearSchema } from '@clearschema/core'` compiles and resolves correctly

---

- [x] **Unit 5: Integration and round-trip tests**

**Goal:** Verify end-to-end correctness with real-world schemas and round-trip fidelity

**Requirements:** R7

**Dependencies:** Units 1, 2

**Files:**
- Create: `clearschema/tests/integration/import-roundtrip.test.ts`

**Approach:**
- Round-trip tests: parse `.clear` -> `exportJsonSchema` -> `importJsonSchema` -> compare AST structures (ignoring `location`, `modifiers`, `rawModifiers`)
- Use existing example files as test fixtures: `examples/user.clear`, `examples/ecommerce.clear`, `examples/maps.clear`
- Test the full pipeline: JSON Schema object -> `importJsonSchema` -> `exportClearSchema` -> `parse` -> compare to original AST
- Write a `structurallyEqual(a, b)` helper that compares ASTs ignoring location and modifier arrays
- Test with a hand-crafted JSON Schema using Draft-07 conventions to verify draft normalization end-to-end

**Patterns to follow:**
- `clearschema/tests/integration/complex-schemas.test.ts` for integration test structure

**Test scenarios:**
- Integration: `user.clear` round-trip — parse -> export JSON Schema -> import -> AST equivalence
- Integration: `ecommerce.clear` round-trip — schema with `$defs`, `$ref`, nested objects, arrays, enums
- Integration: `maps.clear` round-trip — schema with map types
- Integration: Full pipeline — hand-crafted JSON Schema -> import -> serialize to `.clear` -> parse -> AST equivalence
- Integration: Draft-07 JSON Schema with `definitions` and `items` array (tuple) -> import -> correct AST
- Edge case: JSON Schema with unsupported keywords -> warnings array populated, remaining structure correct

**Verification:**
- All round-trip tests pass. Warnings are correctly surfaced. No structural divergence in supported feature set.

---

- [x] **Unit 6: Documentation updates**

**Goal:** Update CHANGELOG, README, and CLI help for the new import feature

**Requirements:** R3

**Dependencies:** All previous units

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`

**Approach:**
- Add v0.5.0 section to CHANGELOG with the reverse importer feature
- Add import usage to README (alongside existing export examples)
- Document supported JSON Schema drafts, disambiguation heuristics, and known limitations

**Test expectation: none** -- documentation only

**Verification:**
- CHANGELOG follows existing format. README examples are accurate.

## System-Wide Impact

- **Interaction graph:** The importer produces the same `Schema` AST that `parse()` produces, so all existing exporters and the resolver work on imported schemas without modification. The new `ClearSchemaSerializer` consumes the same AST, completing the loop.
- **Error propagation:** Import warnings are surfaced via the `warnings: string[]` array in the API and stderr in the CLI. Fatal errors (invalid JSON, unreadable file) throw/exit, following the CLI's existing pattern.
- **State lifecycle risks:** None — the importer is stateless. Each call produces a fresh `Schema` AST.
- **API surface parity:** The `import` subcommand introduces a new CLI surface but does not change existing export behavior. The `-f` flag on import intentionally reuses the same format names as export.
- **Unchanged invariants:** All existing `parse()` -> export flows remain untouched. The `Exporter<T>` interface is not modified. The AST types are not modified.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `anyOf` disambiguation heuristic produces incorrect AST for edge cases | Conservative heuristic (only detect nullable/union when patterns are unambiguous). Integration round-trip tests validate fidelity |
| `.clear` serializer output doesn't parse back correctly | Round-trip test: serialize -> parse -> compare. Fix serializer until parse succeeds |
| Draft-07 vs 2020-12 differences cause silent data loss | Separate test cases for each draft. Explicit handling of `definitions`/`$defs`, `items`/`prefixItems`, `additionalItems`/`items:false` |
| JSON Schema features outside ClearSchema's expressiveness (e.g., `patternProperties`) | Warn explicitly. Document limitations. Users can review warnings before adopting the output |
| Flattened nullable unions (`[string, number, null]`) degrade to `CompositionField` | Documented as known limitation. Conservative heuristic avoids false positives. Can be improved in a future version |
| `$ref` fields lose `description` during `.clear` serialization (grammar limitation) | Documented as known limitation. Description exists on AST but cannot be serialized to `.clear` syntax for `$ref` fields |

## Sources & References

- Origin: `docs/ideation/2026-04-04-general-ideation.md` (idea #6)
- Rosetta Stone: `clearschema/src/exporters/json-schema.ts`
- AST contract: `clearschema/src/ast/types.ts`
- Grammar spec: `docs/GRAMMAR.md`
- Prior exporter plan: `docs/plans/2026-04-05-001-feat-zod-exporter-plan.md`
