---
title: "feat: Add map/dictionary type support"
type: feat
status: completed
date: 2026-04-04
origin: docs/brainstorms/2026-04-04-map-dictionary-type-requirements.md
---

# feat: Add map/dictionary type support

## Overview

Add `map` as a first-class complex type to ClearSchema, enabling string-keyed dictionaries across all output formats. The type follows array-style child item syntax for value type definition and requires changes across the full compiler pipeline: grammar, AST, parser, resolver, all 5 exporters, and tests.

## Problem Frame

ClearSchema cannot express string-keyed dictionaries — the most common type for metadata, headers, tags, labels, and config maps. Every target format supports maps natively (JSON Schema `additionalProperties`, TypeScript `Record`, Pydantic `Dict`), making the gap immediately visible to users. (see origin: docs/brainstorms/2026-04-04-map-dictionary-type-requirements.md)

## Requirements Trace

- R1. `map` as new complex type with array-style child items for value type
- R2. Keys always `string` (JSON inherent constraint)
- R3. Value type via single child item, supporting primitives, objects, refs, arrays, and maps (union value types deferred — pre-existing array limitation, see Scope Boundaries)
- R4. Standard inline modifiers (`.required`, `.nullable`) and universal modifiers (`^default`, `^description`)
- R5. JSON Schema: `{ "type": "object", "additionalProperties": <valueSchema> }`
- R6. TypeScript: `Record<string, ValueType>`
- R7. Pydantic: `Dict[str, ValueType]`
- R8. OpenAPI: delegates to JSON Schema (no changes needed)
- R9. LLM exporter: omit map fields with warning, recursively (new behavior pattern)
- R10. Maps compose: inside arrays, objects, and other maps
- R11. Map value types can be `$ref` references

## Scope Boundaries

- No configurable key types (string only)
- No `map.X` dot notation shorthand
- No map-specific modifiers (`minProperties`/`maxProperties`) this iteration
- No union value types in child items (pre-existing array limitation, separate scope)

## Context & Research

### Relevant Code and Patterns

The `array` type is the direct template — it uses the same child-item pattern (`- valueType`), has the same AST shape (`itemType: Field | FieldTypeName`), and touches all the same code paths. Every file and switch statement that handles `array` needs a parallel `map` case.

Key files (all paths relative to `clearschema/`):
- `src/ast/types.ts` — `ComplexType` union (line 17), `ArrayField` interface (line 84), `Field` union (line 113)
- `src/parser/parser.ts` — `COMPLEX_TYPES` array (line 27), `buildField()` switch (line 641), `buildArrayField()` (line 735)
- `src/resolver/resolver.ts` — `resolveField()` type-specific branches (lines 128-182)
- `src/exporters/json-schema.ts` — `exportField()` switch (line 73)
- `src/exporters/typescript.ts` — `exportFieldType()` switch (line 91)
- `src/exporters/pydantic.ts` — `exportFieldType()` switch (line 126), `$defs` export filter (line 35)
- `src/exporters/llm-structured-output.ts` — post-processing pipeline (lines 47-77)
- `src/index.ts` — public type exports (line 37+)

### Institutional Learnings

No `docs/solutions/` directory exists yet. Phase docs (`PHASE2_COMPLEX_TYPES.md`, `PHASE5_EXPORTERS.md`) and `ARCHITECTURE.md` provide equivalent guidance for how types were added historically.

## Key Technical Decisions

- **LLM exporter detection heuristic:** Detect maps in JSON Schema output as `type === 'object' && typeof additionalProperties !== 'boolean' && additionalProperties !== undefined && !node.properties`. This is reliable because ClearSchema objects always emit `properties`. No AST-level refactor needed.
- **LLM pipeline ordering:** Insert map omission step between `inlineRefs` and `enforceStrictObjects`. Must run after refs are inlined (so `$ref` to a map is caught) but before strict enforcement (which would corrupt map value schemas).
- **Empty map = parse error:** Unlike arrays (which default to `string` items), maps have no natural default value type. Requiring an explicit child item is the safest choice.
- **Multiple child items = parse error:** Maps have exactly one value type. Emit `"map type accepts exactly one child item defining the value type"`.
- **Pydantic `$defs` maps:** Export as type aliases (`Config = Dict[str, str]`) rather than silently dropping non-object definitions.
- **Inline `- map:` in array items:** Support `- map:` with nested child items for "array of map with complex value type", following the existing `- object:` pattern in `parseArrayItem`.

## Open Questions

### Resolved During Planning

- **LLM detection approach:** JSON Schema heuristic (no `properties` + schema `additionalProperties`) is sufficient — no AST refactor needed
- **LLM pipeline ordering:** Between `inlineRefs` and `enforceStrictObjects`
- **Empty map behavior:** Parse error requiring explicit child item
- **Multiple child items:** Parse error with descriptive message
- **Pydantic $defs:** Export map definitions as type aliases

### Deferred to Implementation

- **Exact parser error message wording:** Follow existing array error message patterns, finalize during implementation
- **Nullable map in LLM exporter:** Detection must unwrap `anyOf` nullable wrappers — verify during implementation that the recursive walk handles `{ anyOf: [mapSchema, { type: "null" }] }`

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Grammar addition:
  complex_type = "object" | "array" | "array.tuple" | "map" ;
  map_value    = INDENT, "-", (item_type | inline_object | inline_map), NEWLINE, DEDENT ;

AST addition:
  MapField extends BaseField {
    type: 'map'
    valueType: Field | FieldTypeName   // mirrors ArrayField.itemType
  }

Compiler pipeline (unchanged shape):
  Source -> Lexer -> Parser -> Resolver -> Exporter
                       |           |           |
                  buildMapField  resolveMap  exportMap (per format)

LLM exporter pipeline (new step inserted):
  exportJsonSchema -> inlineRefs -> [omitMapFields] -> enforceStrictObjects -> stripUnsupportedKeywords
```

## Implementation Units

- [ ] **Unit 1: AST type definitions**

**Goal:** Define `MapField` interface and register `map` as a complex type

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `clearschema/src/ast/types.ts`
- Modify: `clearschema/src/index.ts`

**Approach:**
- Add `'map'` to `ComplexType` union (line 17)
- Add `MapField` interface extending `BaseField` with `type: 'map'` and `valueType: Field | FieldTypeName`, mirroring `ArrayField`
- Add `MapField` to the `Field` discriminated union (line 113)
- Export `MapField` from `src/index.ts`

**Patterns to follow:**
- `ArrayField` interface (line 84-90) for shape
- `Field` union type pattern (line 113-123) for registration

**Test expectation:** none — pure type definitions, verified by TypeScript compilation

**Verification:**
- TypeScript compiles with no errors
- `MapField` is exported from the package

- [ ] **Unit 2: Parser — map type parsing**

**Goal:** Parse `map` fields with child items into `MapField` AST nodes

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/parser/parser.ts`
- Create: `clearschema/tests/unit/parser/maps.test.ts`

**Approach:**
- Add `'map'` to `COMPLEX_TYPES` array (line 27) — `ALL_TYPES` auto-updates via spread
- Add `case 'map':` in `buildField()` switch (line 641), calling new `buildMapField()`
- `buildMapField()` follows `buildArrayField()` pattern: take first array item as `valueType`, error if zero or multiple items
- In `parseArrayItem()`, add handling for `- map:` with nested child items (parallel to existing `- object:` handling at line 453)

**Patterns to follow:**
- `buildArrayField()` (line 735-755) for value type extraction from child items
- `parseArrayItem()` `object:` handling (line 453) for inline complex type in array items

**Test scenarios:**
- Happy path: parse `metadata: map: Tags` with `- string` child → MapField with valueType `'string'`
- Happy path: parse map with object value type → MapField with valueType as ObjectField
- Happy path: parse map with `$ref` value type → MapField with valueType as RefField
- Happy path: parse map with `.required` modifier → MapField with `required: true`
- Happy path: parse map with `.nullable` modifier → MapField with `nullable: true`
- Happy path: parse map inside a schema with other fields → correct AST structure
- Happy path: parse map with `^default` modifier → MapField with default value
- Edge case: map with no child items → ParseError
- Edge case: map with multiple child items → ParseError with descriptive message
- Edge case: map as array item (`- map` with nested `- string`) → array containing MapField
- Edge case: map with map value type (nested maps) → MapField with valueType as MapField
- Happy path: map inside `$defs` → MapField in definitions

**Verification:**
- All new parser tests pass
- Existing 242+ tests still pass

- [ ] **Unit 3: Resolver — $ref resolution in map value types**

**Goal:** Resolve `$ref` references inside map value types

**Requirements:** R11

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/resolver/resolver.ts`
- Modify: `clearschema/tests/unit/resolver/resolver.test.ts`

**Approach:**
- Add `field.type === 'map'` branch in `resolveField()` after the `array` check (around line 160)
- When `valueType` is not a string, recurse into it (same pattern as array's `itemType` recursion)

**Patterns to follow:**
- `field.type === 'array'` branch (line 160-165) for recursion into child type

**Test scenarios:**
- Happy path: map with `$ref` value type pointing to a `$defs` definition → ref resolved
- Happy path: map with primitive value type → no resolution needed, passes through
- Integration: cross-file import containing a map with `$ref` → ref resolved across files

**Verification:**
- Resolver correctly populates `resolvedRef` on map value types
- Existing resolver tests pass

- [ ] **Unit 4: JSON Schema exporter**

**Goal:** Export map fields as `{ "type": "object", "additionalProperties": <valueSchema> }`

**Requirements:** R5

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/exporters/json-schema.ts`
- Modify: `clearschema/tests/unit/exporters/json-schema.test.ts`

**Approach:**
- Add `case 'map':` in `exportField()` switch (line 73), calling new `exportMap()` method
- `exportMap()` produces `{ type: 'object', additionalProperties: <exported value schema> }` with description
- Apply universal modifiers via existing `addUniversalModifiers()`
- Handle nullable via existing `exportNullable()` path

**Patterns to follow:**
- `exportArray()` (line 208-234) for value schema recursion
- `addUniversalModifiers()` (line 324) for modifier application

**Test scenarios:**
- Happy path: map with string values → `{ type: "object", additionalProperties: { type: "string" } }`
- Happy path: map with object values → `additionalProperties` contains full object schema
- Happy path: map with `$ref` values → `additionalProperties: { $ref: "..." }`
- Happy path: nullable map → wrapped in `anyOf` with null
- Happy path: map with description → description field present
- Edge case: map with `^default` modifier → `default` property in output
- Edge case: map with `^enum` modifier → `enum` property in output
- Edge case: map of maps → nested `additionalProperties` containing another `additionalProperties`

**Verification:**
- JSON Schema output validates against JSON Schema meta-schema
- All existing JSON Schema exporter tests pass

- [ ] **Unit 5: TypeScript exporter**

**Goal:** Export map fields as `Record<string, ValueType>`

**Requirements:** R6

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/exporters/typescript.ts`
- Modify: `clearschema/tests/unit/exporters/typescript.test.ts`

**Approach:**
- Add `case 'map':` in `exportFieldType()` switch (line 91), calling new `exportMapType()` method
- `exportMapType()` recursively exports the value type and wraps it: `Record<string, ${valueType}>`
- Handle nullable: `Record<string, ValueType> | null`

**Patterns to follow:**
- `exportArrayType()` (line 152-162) for recursive value type export

**Test scenarios:**
- Happy path: map with string values → `Record<string, string>`
- Happy path: map with object values → `Record<string, { field: type; ... }>`
- Happy path: nullable map → `Record<string, string> | null`
- Happy path: map with `$ref` values → `Record<string, RefTypeName>`
- Edge case: array of maps → `Record<string, string>[]`
- Edge case: map of arrays → `Record<string, string[]>`
- Edge case: map of maps → `Record<string, Record<string, string>>`

**Verification:**
- Generated TypeScript type expressions are syntactically valid
- All existing TypeScript exporter tests pass

- [ ] **Unit 6: Pydantic exporter**

**Goal:** Export map fields as `Dict[str, ValueType]` and handle map `$defs`

**Requirements:** R7

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/exporters/pydantic.ts`
- Modify: `clearschema/tests/unit/exporters/pydantic.test.ts`

**Approach:**
- Add `case 'map':` in `exportFieldType()` switch (line 126), calling new `exportMapType()` method
- `exportMapType()` adds `Dict` to the typing imports set (following `List`/`Tuple` pattern) and returns `Dict[str, ${valueType}]`
- Fix `$defs` export filter (line 35) to handle map definitions — export as type alias `ConfigName = Dict[str, ValueType]`. Note: the filter also drops other non-object definitions (arrays, unions, refs) — this is a pre-existing issue; fix only the map case here and note the broader gap for future work
- Handle nullable: `Optional[Dict[str, ValueType]]`

**Patterns to follow:**
- `exportArrayType()` for recursive value type and import management
- `List` import handling (line 196) for `Dict` import pattern

**Test scenarios:**
- Happy path: map with string values → `Dict[str, str]`
- Happy path: map with float values → `Dict[str, float]`
- Happy path: map with object values → `Dict[str, ModelName]` or `Dict[str, dict]`
- Happy path: nullable map → `Optional[Dict[str, str]]`
- Happy path: `Dict` appears in `from typing import` line
- Happy path: map defined in `$defs` → exported as type alias
- Edge case: map with `$ref` value → `Dict[str, RefClassName]`

**Verification:**
- Generated Pydantic code is syntactically valid Python
- `from typing import Dict` present when maps are used
- All existing Pydantic exporter tests pass

- [ ] **Unit 7: LLM structured output exporter — map omission**

**Goal:** Detect and omit map fields from LLM output with warnings, recursively

**Requirements:** R9

**Dependencies:** Unit 4 (JSON Schema exporter must handle maps first)

**Files:**
- Modify: `clearschema/src/exporters/llm-structured-output.ts`
- Modify: `clearschema/tests/unit/exporters/llm-structured-output.test.ts`

**Approach:**
- Add new `omitMapFields()` post-processing step that walks the JSON Schema tree
- Detection heuristic: `type === 'object' && typeof additionalProperties !== 'boolean' && additionalProperties !== undefined && !node.properties`
- Insert in pipeline between `inlineRefs` and `enforceStrictObjects`
- Recursive behavior: when a map is detected, remove the field from its parent's `properties` and `required` arrays. When an array's `items` is a map, omit the entire array field
- Must unwrap `anyOf` nullable wrappers to detect nullable maps
- Emit warnings via the existing warning mechanism for each omitted field
- This is a new behavior pattern — first instance of field-level omission in the LLM exporter

**Patterns to follow:**
- `stripUnsupportedKeywords()` for recursive tree walking pattern
- `enforceStrictObjects()` for object-level detection pattern
- Existing warning emission in the LLM exporter

**Test scenarios:**
- Happy path: schema with map field → field omitted from output, warning emitted
- Happy path: schema with map and non-map fields → only map field omitted, others preserved
- Happy path: array of map → entire array field omitted with warning
- Happy path: nullable map → detected through `anyOf` wrapper, omitted
- Edge case: map as only field in object → object has empty `properties` and `required`
- Edge case: nested object containing map field → map field omitted from nested object
- Edge case: `$ref` pointing to map definition → inlined and then omitted
- Error path: verify output after omission is valid strict-mode JSON Schema (all remaining objects have `additionalProperties: false`)

**Verification:**
- LLM output contains no `additionalProperties` schemas (only `false`)
- Warning messages identify which fields were omitted
- All existing LLM exporter tests pass

- [ ] **Unit 8: Grammar, docs, syntax highlighting, and examples**

**Goal:** Update grammar spec, VS Code extension, playground highlighting, and add example files

**Requirements:** R1 (grammar), success criteria (GRAMMAR.md, example file)

**Dependencies:** Units 2-7 (all functional work complete)

**Files:**
- Modify: `docs/GRAMMAR.md`
- Modify: `vscode-clearschema/syntaxes/clearschema.tmLanguage.json`
- Modify: `playground/src/clearschema-lang.ts`
- Create: `examples/maps.clear`

**Approach:**
- Add `"map"` to `complex_type` production in GRAMMAR.md, add syntax example section for maps
- Add `map` to the type keyword regex in the TextMate grammar (line 127)
- Add `map` to ALL type-matching regex patterns in the playground's StreamLanguage definition (there are 4+ separate patterns for different positions: array items, after-colon, standalone, composition)
- Create `examples/maps.clear` demonstrating: simple map, map with object values, map with $ref, map inside array, nullable map

**Patterns to follow:**
- Existing array/tuple sections in GRAMMAR.md for documentation style
- Existing type keyword patterns in TextMate grammar and playground lang definition
- Existing example files in `examples/` for file structure

**Test expectation:** none — documentation and config changes, verified by visual inspection

**Verification:**
- `map` highlighted as a type keyword in VS Code and playground
- Example file parses successfully with `clearschema compile`
- Grep for all `case 'array'` across `clearschema/src/` to confirm every switch also has `case 'map'` — final cross-cutting audit
- Verify OpenAPI exporter has no type-specific switch statements (it delegates to JSON Schema, so map support should be inherited)
- Add at least one integration test in `clearschema/tests/integration/complex-schemas.test.ts` for a schema with map fields compiled through all 5 formats

## System-Wide Impact

- **Interaction graph:** Parser → Resolver → all 5 exporters. The LLM exporter adds a new post-processing step. No callbacks, middleware, or observers involved.
- **Error propagation:** Parse errors for invalid map definitions propagate through the existing error reporting. LLM warnings use the existing warning mechanism.
- **State lifecycle risks:** None — the compiler is stateless, pure transformation.
- **API surface parity:** The playground and CLI both go through the same `parse()` → exporter path, so they get map support automatically.
- **Integration coverage:** End-to-end test needed for a schema with maps compiled through all formats.
- **Unchanged invariants:** All existing type handling (string, number, integer, boolean, null, object, array, array.tuple, union, ref, composition) is untouched. Existing tests verify this.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Missing a switch statement → silent wrong output | TypeScript won't flag missing switch cases with `default` branch; use grep for all `case 'array'` occurrences to find every switch that needs updating |
| LLM map detection heuristic is wrong | Heuristic is conservative (requires no `properties` key AND non-boolean `additionalProperties`). ClearSchema objects always emit `properties`. Test edge cases thoroughly |
| LLM pipeline ordering breaks existing behavior | Insert new step, don't modify existing steps. Existing LLM tests verify nothing regresses |
| Pydantic `$defs` filter silently drops maps | Fix the filter to handle map definitions as type aliases |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-04-map-dictionary-type-requirements.md](docs/brainstorms/2026-04-04-map-dictionary-type-requirements.md)
- Related code: `clearschema/src/ast/types.ts` (ArrayField as template)
- Related code: `clearschema/src/parser/parser.ts` (buildArrayField as template)
- Related code: `clearschema/src/exporters/llm-structured-output.ts` (post-processing pipeline)
- Architecture: `docs/ARCHITECTURE.md`, `docs/GRAMMAR.md`
