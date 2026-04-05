---
date: 2026-04-04
topic: map-dictionary-type
---

# Map/Dictionary Type Support

## Problem Frame

ClearSchema has no way to express string-keyed dictionaries — the most common type for metadata fields, HTTP headers, tags, labels, and configuration maps. Users must work around this with untyped objects or avoid ClearSchema for schemas that need maps. Every major target language has first-class map support (JSON Schema `additionalProperties`, TypeScript `Record`, Pydantic `Dict`), so the gap is immediately visible to new users.

## Requirements

**DSL Syntax**

- R1. Add `map` as a new complex type using array-style child items to define the value type
- R2. Keys are always `string` (JSON keys are inherently strings; non-string keys only matter for non-JSON targets, which are out of scope)
- R3. Value type is defined by a single child item (`- valueType`), supporting primitives, objects, refs, unions, arrays, and maps
- R4. Map fields support standard inline modifiers (`.required`, `.nullable`) and universal modifiers (`^default`, `^description`)

**Exporter Output**

- R5. JSON Schema: `{ "type": "object", "additionalProperties": <valueSchema> }` — no `properties` or `required`
- R6. TypeScript: `Record<string, ValueType>`
- R7. Pydantic: `Dict[str, ValueType]`
- R8. OpenAPI: delegates to JSON Schema exporter (existing pattern)
- R9. LLM exporter: omit map fields from output with a warning. This applies recursively — an `array` of `map` or an object whose only field is a map also gets omitted. This is a new behavior pattern (the existing LLM exporter strips keywords but never omits entire fields)

**Composition**

- R10. Maps work as value types inside arrays (`array` of `map`), as field types inside objects, and as value types inside other maps (map-of-map via composition)
- R11. Map value types can be `$ref` references, resolved through the existing resolver

## Success Criteria

- All 5 exporters handle map types with tests: JSON Schema, TypeScript, Pydantic, and OpenAPI emit map output; LLM exporter tests verify warning + omission behavior
- Existing 232+ tests continue to pass
- GRAMMAR.md updated with map production rules
- At least one example `.clear` file demonstrating map usage

## Scope Boundaries

- No configurable key types (string only) — JSON keys are always strings; non-string keys only matter for non-JSON targets, which are out of scope
- No `map.X` dot notation shorthand — value type always specified via child items for consistency
- No nested map-of-map special handling — works naturally through composition but not a first-class concern
- No map-specific modifiers (e.g., `^minProperties`) in this iteration

## Key Decisions

- **Array-style child items for value type**: Follows the precedent set by `array` type, keeping the DSL consistent. No new syntactic patterns (angle brackets, dot notation) needed.
- **String-only keys**: JSON keys are inherently strings. Non-string keys only matter for non-JSON targets, which are out of scope.
- **LLM exporter warns and skips**: LLM structured output requires `additionalProperties: false`, which is fundamentally incompatible with maps. This introduces a new behavior pattern — the existing LLM exporter strips keywords but never omits entire fields. Map omission is the first instance of field-level removal.

## Outstanding Questions

### Deferred to Planning

- [Affects R5][Technical] Should map emit `minProperties`/`maxProperties` constraints via modifiers in a future iteration?
- [Affects R1][Needs research] How should parser errors read when map has zero or multiple child items? Follow existing array error patterns.

## Next Steps

→ `/ce:plan` for structured implementation planning
