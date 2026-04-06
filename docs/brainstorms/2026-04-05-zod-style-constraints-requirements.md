---
date: 2026-04-05
topic: zod-style-constraints
---

# Zod-Style Unified Constraint Names

## Problem Frame

ClearSchema currently uses different constraint names depending on the field type: `minLength`/`maxLength` for strings, `min`/`max` for numbers, `minItems`/`maxItems` for arrays, and `exclusiveMin`/`exclusiveMax` for exclusive bounds. Since ClearSchema already knows each field's type at parse time, these type-prefixed names add cognitive overhead without adding information. Zod's approach — using `.min()`, `.max()`, `.gt()`, `.lt()` uniformly — is more developer-friendly and already familiar to TypeScript developers.

## Requirements

**Unified Constraint Naming**
- R1. `min` and `max` become the universal constraint names for all bounded types: strings (length), numbers/integers (value), and arrays (item count)
- R2. `exclusiveMin` and `exclusiveMax` are renamed to `gt` and `lt` (numbers/integers only)
- R3. The old names (`minLength`, `maxLength`, `minItems`, `maxItems`, `exclusiveMin`, `exclusiveMax`) are not accepted as valid modifiers. The parser produces a migration hint (e.g., `"minLength" is not a valid modifier — use "min" instead`) rather than a generic unknown-modifier error

**Type-Aware Translation**
- R4. The parser resolves `min`/`max` to the correct AST property based on field type: `minLength`/`maxLength` for strings, `min`/`max` for numbers/integers, `minItems`/`maxItems` for arrays
- R5. `gt`/`lt` resolve to `exclusiveMin`/`exclusiveMax` on number/integer fields; using them on other types is a parse error
- R6. Using `min`/`max` on types that don't support bounds (boolean, null, object) is a parse error with a clear message

**Union Type-Prefixed Modifiers**
- R7. Type-prefixed modifiers in unions continue to work with the new names: `^ string.min: 3`, `^ number.max: 100`, `^ number.gt: 0`
- R8. Old type-prefixed names in unions (`^ string.minLength: 3`) are also removed

**Range Shorthand**
- R9. Implement the `range: [a, b]` shorthand as specified in ARCHITECTURE.md — it expands to `min`/`max` at parse time based on field type (string -> `minLength`/`maxLength`, number/integer -> `min`/`max` in AST)
- R10. `range` works on strings, numbers, integers, and arrays. Using it on other types is a parse error
- R11. `range` works with union type-prefixed syntax: `^ string.range: [1, 100]`, `^ number.range: [0, 1000]`
- R12. `range` is purely syntactic sugar — it expands to AST properties and is not stored in the AST itself
- R13. `exclusiveRange: [a, b]` expands to `gt`/`lt` (i.e., AST `exclusiveMin`/`exclusiveMax`) for numbers/integers only

**AST Representation**
- R14. The internal AST types (`StringField`, `NumberField`, `ArrayField`) retain their current property names (`minLength`, `maxLength`, `min`, `max`, `minItems`, `maxItems`, `exclusiveMin`, `exclusiveMax`) — only the user-facing syntax changes

**Exporter Updates**
- R15. All exporters (JSON Schema, Zod, Pydantic, OpenAPI, LLM Schema) continue to produce correct output — they read from AST properties which are unchanged (R14), so no logic changes needed
- R16. The ClearSchema serializer must translate AST property names back to the new user-facing names when serializing (e.g., AST `minLength` -> output `min`, AST `exclusiveMin` -> output `gt`)

**Importer Updates**
- R17. The JSON Schema importer produces unchanged AST (it already sets typed properties like `minLength`). No changes needed unless it also sets `rawModifiers` with old names — verify during planning.

**Documentation and Examples**
- R18. ARCHITECTURE.md, GRAMMAR.md, and all example `.clear` files are updated to reflect the new names
- R19. Error messages for invalid modifier usage reference the new names

## Success Criteria
- All existing tests pass after updating constraint names in test inputs/expectations
- The parser rejects old names with a helpful migration hint suggesting the new name
- `range: [a, b]` expands correctly for strings, numbers, and integers
- `exclusiveRange: [a, b]` expands correctly for numbers/integers
- Round-trip (parse -> serialize) produces valid `.clear` files using new names
- All exporters produce identical output to before (since AST properties are unchanged)

## Scope Boundaries
- No changes to AST property names — only user-facing `.clear` syntax changes
- No new constraint types added (e.g., no `length` alias, no `size`)

## Key Decisions
- **Clean break over gradual migration**: Old names are removed, not deprecated. ClearSchema is pre-1.0 and this simplifies both the parser and the mental model.
- **AST stays stable**: Exporters don't need changes (except the ClearSchema serializer). The translation layer lives entirely in the parser.
- **`gt`/`lt` over `exclusiveMin`/`exclusiveMax`**: Matches Zod's `.gt()/.lt()`, reads more naturally (`gt: 0` vs `exclusiveMin: 0`).

## Outstanding Questions

### Deferred to Planning
- [Affects R6][Needs research] Should `map` type support `min`/`max` for entry count? Check if maps currently support `minItems`/`maxItems` in the parser.
- [Affects R17][Technical] Does the JSON Schema importer set `rawModifiers` with old names? If so, those need updating too.
- [Affects R9][Technical] Should `range` conflict with explicit `min`/`max` on the same field? (e.g., `^ range: [1, 10]` + `^ min: 5` — error or override?)

## Next Steps

-> `/ce:plan` for structured implementation planning
