---
title: "feat: Unify constraint names to Zod-style min/max/gt/lt with range shorthand"
type: feat
status: completed
date: 2026-04-05
origin: docs/brainstorms/2026-04-05-zod-style-constraints-requirements.md
---

# feat: Unify constraint names to Zod-style min/max/gt/lt with range shorthand

## Overview

Unify the user-facing constraint modifier names in ClearSchema to follow Zod's convention: `min`/`max` replace type-specific names (`minLength`, `maxLength`, `minItems`, `maxItems`), and `gt`/`lt` replace `exclusiveMin`/`exclusiveMax`. Add `range`/`exclusiveRange` shorthands. Internal AST property names are unchanged — the translation layer lives entirely in the parser and serializer. Union type-prefixed modifiers (`^ string.min: 3`) are deferred to a separate plan.

## Problem Frame

ClearSchema uses different constraint modifier names per type (`minLength` for strings, `min` for numbers, `minItems` for arrays) even though the parser knows the field type and can resolve a single `min` to the correct AST property. This adds cognitive overhead without adding information. Union type-prefixed modifiers (`^ string.min: 3`) — documented in ARCHITECTURE.md but not yet implemented — are deferred to a separate plan. For now, bare `min`/`max` on union fields is a parse error since the target type is ambiguous. (see origin: `docs/brainstorms/2026-04-05-zod-style-constraints-requirements.md`)

## Requirements Trace

- R1. `min`/`max` universal for strings (length), numbers (value), arrays (item count)
- R2. `exclusiveMin`/`exclusiveMax` renamed to `gt`/`lt` (numbers/integers only)
- R3. Old names produce migration hints, not generic errors
- R4. Parser resolves `min`/`max` to correct AST property by field type
- R5. `gt`/`lt` only valid on number/integer; parse error on other types
- R6. `min`/`max` on boolean/null/object/map is a parse error
- ~~R7. Type-prefixed modifiers for unions — deferred to separate plan~~
- ~~R8. Old type-prefixed names in unions — deferred to separate plan~~
- R9–R13. `range`/`exclusiveRange` shorthand implementation
- R14. AST types unchanged
- R15. All exporters unchanged (except ClearSchema serializer)
- R16. ClearSchema serializer outputs new names
- R17. JSON Schema importer unchanged (verified: it sets first-class properties, never rawModifiers)
- R18–R19. Documentation and error messages updated

## Scope Boundaries

- No changes to AST property names (`StringField.minLength`, `NumberField.exclusiveMin`, etc. stay as-is)
- No new constraint types (no `length`, `size`, `between`)
- Map type does not support `min`/`max` (MapField has no constraint properties)
- Modifier conflict validation (e.g., `min > max`) documented in ARCHITECTURE.md but not yet implemented — remains out of scope. Type validation (rejecting `min` on boolean per R5/R6) IS in scope
- `range`/`exclusiveRange` conflicting with explicit `min`/`max`/`gt`/`lt` on the same field — conflict detection IS in scope
- Union type-prefixed modifiers (`^ string.min: 3`) — deferred to a separate plan. Bare `min`/`max`/`gt`/`lt` on union fields is a parse error for now

## Context & Research

### Relevant Code and Patterns

- **Parser modifier flow:** `parseModifierLine()` (parser.ts:422) → `buildField()` (parser.ts:658) → type-specific builders (`buildStringField` at 736, `buildNumberField` at 750, `buildArrayField` at 796)
- **Modifier regex:** `^\^\s*(\w+)\s*:\s*(.*)$` — captures only single-word names
- **Value parser:** `parseModifierValue()` (parser.ts:581) already handles `[a, b]` array syntax — `range` values parse naturally
- **ClearSchema serializer:** `addStringModifiers()` (clearschema.ts:162), `addNumberModifiers()` (clearschema.ts:177), `addArrayModifiers()` (clearschema.ts:195) — all read first-class AST properties
- **JSON Schema importer:** Sets first-class properties directly, never populates `rawModifiers` — confirmed no changes needed
- **Inline modifier validation:** parser.ts:374-379 provides the pattern for error messages with hints
- **Union AST:** `UnionField` has `types: FieldTypeName[]` and flat `rawModifiers` — no per-type modifier storage exists (relevant for deferred union type-prefixed plan)

### Institutional Learnings

No `docs/solutions/` directory exists yet.

## Key Technical Decisions

- **Translation in parser, not AST:** The parser reads `min` from `rawModifiers` and maps it to `StringField.minLength`, `NumberField.min`, or `ArrayField.minItems` based on type. AST stays stable, so 6 of 7 exporters need zero changes.
- **`range` conflicts with explicit `min`/`max`:** If both `range: [a, b]` and `min`/`max` are set on the same field, the parser throws a conflict error (e.g., `"cannot use both 'range' and 'min' on the same field"`).
- **Migration hints via old-name map:** The parser maintains a static map of old-to-new names and produces specific migration hints: `"minLength" is not a valid modifier — use "min" instead`. The deprecated-name check must be type-aware — `minLength` is only deprecated as a string modifier, not universally. The check runs after field type is known (inside each type-specific builder or after type routing in `buildField()`), not as a flat pre-check.
- **Union fields:** Bare `min`/`max`/`gt`/`lt`/`range`/`exclusiveRange` on union fields is a parse error. The error message should hint toward the deferred type-prefixed syntax: `"min" is ambiguous on union types — type-prefixed modifiers (e.g., "string.min") will be supported in a future release`.

## Open Questions

### Resolved During Planning

- **Does the JSON Schema importer need changes?** No — it sets first-class AST properties directly and never populates `rawModifiers`. Round-trip (JSON Schema → AST → .clear) works because the serializer reads AST properties.
- **Should `map` support `min`/`max`?** No — `MapField` has no constraint properties and adding them is out of scope.
- **`range` + explicit `min`/`max` conflict?** Parse error. Both setting the same underlying property is ambiguous.
- **Are type-prefixed modifiers implemented?** No — deferred to a separate plan. For now, bare constraints on union fields error with a forward-looking hint.

### Deferred to Implementation

- Exact error message wording for migration hints and union-ambiguity errors

### Deferred to Separate Plan

- Union type-prefixed modifiers (`^ string.min: 3`) — requires regex change, dot-notation parsing, rawModifiers storage design, and exporter consumption
- Union type-prefixed range/exclusiveRange (`^ string.range: [1, 100]`)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
User writes:          Parser resolves to AST:         Serializer outputs:
─────────────         ─────────────────────           ──────────────────
^ min: 2              StringField.minLength = 2       ^ min: 2
  (on string)

^ min: 0              NumberField.min = 0             ^ min: 0
  (on number)

^ min: 1              ArrayField.minItems = 1         ^ min: 1
  (on array)

^ gt: 0               NumberField.exclusiveMin = 0    ^ gt: 0
  (on number)

^ range: [2, 50]      StringField.minLength = 2       ^ min: 2
  (on string)          StringField.maxLength = 50      ^ max: 50

^ exclusiveRange:      NumberField.exclusiveMin = 0    ^ gt: 0
  [0, 1]               NumberField.exclusiveMax = 1    ^ lt: 1
  (on number)

^ min: 5              Parse error: "min is       (not applicable)
  (on union)           ambiguous on union types"
```

## Implementation Units

- [ ] **Unit 1: Update modifier regex and type-aware resolution in parser**

  **Goal:** Change the parser to accept `min`/`max`/`gt`/`lt` as the primary constraint names and resolve them to the correct AST properties based on field type. Reject old names with migration hints. Reject these modifiers on union fields with a forward-looking hint.

  **Requirements:** R1, R2, R3, R4, R5, R6

  **Dependencies:** None

  **Files:**
  - Modify: `clearschema/src/parser/parser.ts`
  - Modify: `clearschema/src/parser/errors.ts` (if migration hint errors need a distinct error type)
  - Test: `clearschema/tests/unit/parser/primitives.test.ts`
  - Test: `clearschema/tests/unit/parser/arrays.test.ts`
  - Test: `clearschema/tests/unit/parser/unions.test.ts`

  **Approach:**
  - In `buildStringField()`: read `rawModifiers['min']` → `minLength`, `rawModifiers['max']` → `maxLength`. Also check for deprecated names (`minLength`, `maxLength`) and throw `ParseError` with migration hint
  - In `buildNumberField()`: read `rawModifiers['gt']` → `exclusiveMin`, `rawModifiers['lt']` → `exclusiveMax` (keep reading `min`/`max`/`multipleOf` as-is). Check for deprecated names (`exclusiveMin`, `exclusiveMax`) and throw
  - In `buildArrayField()`: read `rawModifiers['min']` → `minItems`, `rawModifiers['max']` → `maxItems`. Check for deprecated names (`minItems`, `maxItems`) and throw
  - The deprecated-name check must be type-aware: `minLength` is only deprecated on string fields, `minItems` only on array fields, etc. The check runs inside each type-specific builder (not as a flat pre-check in `buildField()`) so the field type is already known
  - Add type validation: if `min`/`max` appear on boolean/null/object/map/union fields, throw `ParseError`. For union fields, the error hints at future type-prefixed syntax
  - No changes to the modifier regex or union handling — type-prefixed modifiers are deferred

  **Patterns to follow:**
  - Inline modifier validation at parser.ts:374-379 for error message pattern with hint
  - `ParseError` constructor: `(message, location, source, hint?)`

  **Test scenarios:**
  - Happy path: `^ min: 2` on string → `StringField.minLength === 2`
  - Happy path: `^ max: 50` on string → `StringField.maxLength === 50`
  - Happy path: `^ min: 0` on number → `NumberField.min === 0`
  - Happy path: `^ max: 100` on integer → `NumberField.max === 100`
  - Happy path: `^ gt: 0` on number → `NumberField.exclusiveMin === 0`
  - Happy path: `^ lt: 1` on number → `NumberField.exclusiveMax === 1`
  - Happy path: `^ min: 1` on array → `ArrayField.minItems === 1`
  - Happy path: `^ max: 10` on array → `ArrayField.maxItems === 10`
  - Error path: `^ minLength: 2` on string → ParseError with hint "use 'min' instead"
  - Error path: `^ maxLength: 50` on string → ParseError with hint "use 'max' instead"
  - Error path: `^ minItems: 1` on array → ParseError with hint "use 'min' instead"
  - Error path: `^ maxItems: 10` on array → ParseError with hint "use 'max' instead"
  - Error path: `^ exclusiveMin: 0` on number → ParseError with hint "use 'gt' instead"
  - Error path: `^ exclusiveMax: 1` on number → ParseError with hint "use 'lt' instead"
  - Error path: `^ min: 5` on boolean → ParseError "min is not valid on boolean"
  - Error path: `^ max: 5` on null → ParseError "max is not valid on null"
  - Error path: `^ min: 5` on object → ParseError
  - Error path: `^ gt: 0` on string → ParseError "`gt` is only valid on number/integer"
  - Error path: `^ lt: 1` on array → ParseError "`lt` is only valid on number/integer"
  - Error path: `^ min: 5` on union → ParseError "min is ambiguous on union types"
  - Error path: `^ gt: 0` on union → ParseError "gt is ambiguous on union types"
  - Edge case: `^ min: 5` and `^ max: 3` on string (min > max) → still parses (conflict validation is out of scope for this plan beyond range)
  - Update all existing modifier tests to use new names

  **Verification:**
  - All existing parser tests pass after updating input strings from old to new names
  - New migration hint tests pass
  - New type validation tests pass

- [ ] **Unit 2: Implement range and exclusiveRange shorthand**

  **Goal:** Add `range: [a, b]` and `exclusiveRange: [a, b]` as syntactic sugar that expands to the appropriate AST properties at parse time.

  **Requirements:** R9, R10, R12, R13 (R11 union type-prefixed range deferred)

  **Dependencies:** Unit 1 (type-aware min/max resolution must work first)

  **Files:**
  - Modify: `clearschema/src/parser/parser.ts`
  - Test: `clearschema/tests/unit/parser/primitives.test.ts`
  - Test: `clearschema/tests/unit/parser/arrays.test.ts`
  - Test: `clearschema/tests/unit/parser/unions.test.ts`

  **Approach:**
  - In each type-specific builder, after extracting `min`/`max`, check for `rawModifiers['range']`
  - If `range` is present: validate it's a 2-element array, validate `a <= b`, extract into the appropriate AST properties (`minLength`/`maxLength` for string, `min`/`max` for number/integer, `minItems`/`maxItems` for array)
  - If both `range` and explicit `min`/`max` are set, throw a conflict error
  - For `exclusiveRange`: same pattern but maps to `exclusiveMin`/`exclusiveMax`, only valid on number/integer
  - `range` and `exclusiveRange` on union fields is a parse error (same as bare `min`/`max`)

  **Patterns to follow:**
  - `parseModifierValue()` already parses `[a, b]` into an array — no lexer changes needed
  - ARCHITECTURE.md range specification for expected behavior

  **Test scenarios:**
  - Happy path: `^ range: [3, 20]` on string → `minLength === 3, maxLength === 20`
  - Happy path: `^ range: [-40, 60]` on number → `min === -40, max === 60`
  - Happy path: `^ range: [0, 150]` on integer → `min === 0, max === 150`
  - Happy path: `^ range: [1, 10]` on array → `minItems === 1, maxItems === 10`
  - Happy path: `^ exclusiveRange: [0, 1]` on number → `exclusiveMin === 0, exclusiveMax === 1`
  - Edge case: `^ range: [5, 5]` → valid (min equals max)
  - Error path: `^ range: [1, 10]` on union → ParseError "range is ambiguous on union types"
  - Error path: `^ range: [10, 5]` on string → ParseError "range minimum (10) cannot exceed maximum (5)"
  - Error path: `^ range: [0, 1]` on boolean → ParseError "range is not valid on boolean"
  - Error path: `^ exclusiveRange: [0, 1]` on string → ParseError "exclusiveRange is only valid on number/integer"
  - Error path: `^ range: [1, 10]` + `^ min: 5` on same string field → ParseError "cannot use both 'range' and 'min'"
  - Error path: `^ range: [1, 10]` + `^ max: 5` on same number field → ParseError "cannot use both 'range' and 'max'"
  - Error path: `^ exclusiveRange: [0, 1]` + `^ gt: 0` → ParseError conflict
  - Edge case: `^ range: [0]` → ParseError "range requires exactly 2 values [min, max]"
  - Verification: `range` does not appear in the resulting AST — only expanded properties

  **Verification:**
  - All range/exclusiveRange tests pass
  - AST never contains a `range` property — only the expanded min/max/gt/lt equivalents

- [ ] **Unit 3: Update ClearSchema serializer to output new names**

  **Goal:** The ClearSchema serializer (round-trip exporter) outputs `min`/`max`/`gt`/`lt` instead of `minLength`/`maxLength`/`exclusiveMin`/`exclusiveMax`/`minItems`/`maxItems`.

  **Requirements:** R16

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `clearschema/src/exporters/clearschema.ts`
  - Test: `clearschema/tests/unit/exporters/clearschema.test.ts`

  **Approach:**
  - `addStringModifiers()`: change output from `^ minLength:` to `^ min:`, `^ maxLength:` to `^ max:`
  - `addNumberModifiers()`: change output from `^ exclusiveMin:` to `^ gt:`, `^ exclusiveMax:` to `^ lt:` (min/max already correct)
  - `addArrayModifiers()`: change output from `^ minItems:` to `^ min:`, `^ maxItems:` to `^ max:`
  - No union-specific changes needed (type-prefixed modifiers deferred)

  **Patterns to follow:**
  - Existing serializer methods at clearschema.ts:162-205

  **Test scenarios:**
  - Happy path: StringField with `minLength: 2, maxLength: 50` serializes as `^ min: 2` and `^ max: 50`
  - Happy path: NumberField with `exclusiveMin: 0, exclusiveMax: 1` serializes as `^ gt: 0` and `^ lt: 1`
  - Happy path: NumberField with `min: 0, max: 100` serializes as `^ min: 0` and `^ max: 100` (unchanged)
  - Happy path: ArrayField with `minItems: 1, maxItems: 10` serializes as `^ min: 1` and `^ max: 10`
  - Integration: round-trip parse → serialize → parse produces identical AST

  **Verification:**
  - All serializer tests pass with new output names
  - Round-trip tests produce valid `.clear` files

- [ ] **Unit 4: Update exporter tests and integration tests**

  **Goal:** Update all test files that use old modifier names in `.clear` input strings. Verify all exporters still produce correct output.

  **Requirements:** R15, R18

  **Dependencies:** Units 1, 2, 3

  **Files:**
  - Modify: `clearschema/tests/unit/lexer/lexer.test.ts` (contains old modifier names in test inputs)
  - Modify: `clearschema/tests/unit/exporters/json-schema.test.ts`
  - Modify: `clearschema/tests/unit/exporters/zod.test.ts`
  - Modify: `clearschema/tests/unit/exporters/pydantic.test.ts`
  - Modify: `clearschema/tests/unit/exporters/llm-structured-output.test.ts`
  - Modify: `clearschema/tests/unit/exporters/clearschema.test.ts`
  - Modify: `clearschema/tests/unit/importers/json-schema.test.ts`
  - Modify: `clearschema/tests/integration/complex-schemas.test.ts`
  - Modify: `clearschema/tests/integration/import-roundtrip.test.ts`
  - Verify (likely no changes): `clearschema/tests/unit/exporters/typescript.test.ts`, `clearschema/tests/unit/exporters/openapi.test.ts`

  **Approach:**
  - In every test that constructs `.clear` input strings with old modifier names (`minLength`, `maxLength`, `minItems`, `maxItems`, `exclusiveMin`, `exclusiveMax`), replace with new names (`min`, `max`, `gt`, `lt`)
  - Exporter assertions should remain identical — the AST properties are unchanged, so JSON Schema output still says `minLength`, Zod output still says `.min()`, etc.
  - Importer tests: input JSON Schema is unchanged (it uses JSON Schema keywords). Assertions on AST properties are unchanged. Only update if tests round-trip through the ClearSchema serializer.

  **Patterns to follow:**
  - Existing test patterns in each file

  **Test scenarios:**
  - Happy path: Each exporter test passes with new input names and unchanged output assertions
  - Integration: Complex schema tests pass end-to-end
  - Integration: Import round-trip tests pass

  **Verification:**
  - Full test suite passes: `npm test` reports all 465+ tests passing
  - No exporter output has changed (only input `.clear` syntax changed)

- [ ] **Unit 5: Update documentation and examples**

  **Goal:** Update ARCHITECTURE.md, GRAMMAR.md, and all example `.clear` files to use new modifier names.

  **Requirements:** R18, R19

  **Dependencies:** Units 1, 2

  **Files:**
  - Modify: `docs/ARCHITECTURE.md`
  - Modify: `docs/GRAMMAR.md`
  - Modify: `examples/*.clear` (user.clear, llm-structured-response.clear, llm-agent-output.clear, llm-tool-definition.clear)

  **Approach:**
  - Replace all references to `minLength`/`maxLength`/`minItems`/`maxItems`/`exclusiveMin`/`exclusiveMax` with `min`/`max`/`gt`/`lt` in syntax examples and modifier tables
  - Update the modifier compatibility table in ARCHITECTURE.md
  - Update the `range` section to reflect that it's now implemented
  - Update error message examples to use new names
  - Update the conflict validation table (rename columns/values but keep the rules)

  **Test expectation:** none — documentation-only changes

  **Verification:**
  - All `.clear` examples in docs are valid under the new parser
  - Modifier tables are internally consistent

## System-Wide Impact

- **Interaction graph:** Parser → AST → Exporters. Only the parser's modifier-to-AST mapping changes. All exporters read unchanged AST properties. The ClearSchema serializer reverses the mapping.
- **Error propagation:** New `ParseError` instances for migration hints and type validation. Existing error handling infrastructure is sufficient.
- **API surface parity:** The JSON Schema importer is unaffected (confirmed: it sets first-class properties, never rawModifiers). The CLI passes through the parser, so it inherits the changes automatically.
- **Unchanged invariants:** All exporter outputs (JSON Schema, TypeScript, Zod, Pydantic, OpenAPI, LLM Schema) produce identical results. The AST type interfaces are unchanged. The `Exporter<T>` interface is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Existing `.clear` files break silently | Migration hints ensure users get actionable errors, not silent failures. |
| Range expansion conflicts with explicit constraints | Explicit conflict detection: throw ParseError when both range and min/max are set. |
| Union fields lose ability to set per-type constraints | `min`/`max` on unions errors with a forward-looking hint. Per-type constraints weren't implemented before either — no regression. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-05-zod-style-constraints-requirements.md](docs/brainstorms/2026-04-05-zod-style-constraints-requirements.md)
- Related code: `clearschema/src/parser/parser.ts` (modifier parsing and type-specific builders)
- Related code: `clearschema/src/exporters/clearschema.ts` (round-trip serializer)
- Related code: `clearschema/src/ast/types.ts` (AST type definitions)
- Related docs: `clearschema/docs/ARCHITECTURE.md` (modifier system, range spec, conflict validation)
