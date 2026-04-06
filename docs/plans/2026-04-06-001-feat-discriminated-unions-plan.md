---
title: "feat: Add discriminated unions via `match` keyword"
type: feat
status: completed
date: 2026-04-06
origin: docs/brainstorms/2026-04-06-discriminated-unions-requirements.md
---

# feat: Add discriminated unions via `match` keyword

## Overview

Add a `match(discriminator)` keyword to ClearSchema's grammar that expresses discriminated unions — the most common pattern for polymorphic API data. Each variant is keyed by its discriminator value, with the discriminator field auto-injected at export time. All 7 exporters, the JSON Schema importer, and LSP are updated.

## Problem Frame

ClearSchema cannot express discriminated unions. The importer warns on `if/then/else` and `discriminator` and drops them, making reverse-imported schemas lossy. This is a language completeness gap — real-world schemas (payment methods, event payloads, LLM tool results) almost always need discriminated unions. (see origin: `docs/brainstorms/2026-04-06-discriminated-unions-requirements.md`)

## Requirements Trace

- R1. `match` keyword in grammar
- R2. Variant block parsing
- R3. Discriminator field auto-injection (at export time)
- R4. Unique variant key validation
- R5. `$ref` variant validation
- R6. `MatchField` AST node
- R7. Add to `Field` union type
- R8. JSON Schema exporter (Unit 2)
- R9. TypeScript exporter (Unit 3)
- R10. Zod exporter (Unit 3)
- R11. Pydantic exporter (Unit 4)
- R12. OpenAPI exporter (Unit 4)
- R13. LLM structured output exporter (Unit 5)
- R14. ClearSchema serializer (Unit 6)
- R15–R17. Importer detects and converts `oneOf` + discriminator patterns
- R19–R21. LSP autocomplete, diagnostics, hover

## Scope Boundaries

- No general `if/then/else` conditionals
- No non-string discriminators
- No nested match-within-match (explicitly not designed for; parser will not reject it)
- No `dependentSchemas` / `dependentRequired`
- R18 removed — `if/then/else` stays in UNSUPPORTED_KEYWORDS

## Context & Research

### Relevant Code and Patterns

- **Parser dispatch**: `parser.ts:buildField` (line ~658) switches on type string — add `'match'` case
- **Type validation**: `parser.ts:isValidType` (line ~418) checks `ALL_TYPES` + `'ref'` + `'union'`
- **Type parsing**: `parser.ts:parseTypeString` (line ~333) splits on `.` — must handle `match(identifier)` before dot-split
- **Composition pattern**: `buildCompositionField` (line ~972) converts `arrayItems` to schema list — `buildMatchField` follows similar structure but keyed by variant name
- **Lexer**: No changes needed — `match(type):` lines classify as `FIELD_LINE` (contains `:`)
- **Variant lines**: `credit_card:` also classify as `FIELD_LINE` — parser must detect match context and parse as variant headers
- **Exporter pattern**: Each exporter has `exportFieldType` with a type switch — add `'match'` case
- **Importer dispatch**: `importField` (line ~188) checks `oneOf` at line ~212 — insert discriminated union detection before this
- **Pydantic gap**: Pydantic exporter currently returns `Any` for all composition types — fix as part of this work

### External References

- **JSON Schema**: `discriminator` is NOT a JSON Schema keyword — it's OpenAPI-only. Pure JSON Schema uses `oneOf` + `const` on discriminator property
- **OpenAPI 3.1**: `discriminator: { propertyName: string, mapping?: Record<string, string> }`
- **Zod v3**: `z.discriminatedUnion('key', [z.object({key: z.literal('a'), ...}), ...])`
- **Pydantic v2**: `Annotated[Cat | Dog, Discriminator('type')]` where each model has `type: Literal['variant_name']`
- **LLM providers**: Use `anyOf` (not `oneOf`) for broadest support. `const` is universally supported. `discriminator` keyword not recognized by any LLM provider. OpenAI/Anthropic have issues with `oneOf` in strict mode.

## Key Technical Decisions

- **AST node named `MatchField`**: Consistent with naming convention (`StringField`, `MapField`, etc.), matches keyword, shorter than `DiscriminatedUnionField`
- **Discriminator injection at export time, not parse time**: Keeps AST faithful to source text. The AST stores the discriminator field name and variant map; each exporter injects the discriminator property into variant schemas during export. This avoids duplicating the discriminator field in the AST (where it would be redundant with the variant key).
- **LLM exporter uses `anyOf` instead of `oneOf`**: Research confirms `anyOf` has broadest LLM provider support (Anthropic, OpenAI strict mode, Gemini). `oneOf` is problematic in OpenAI strict mode.
- **LLM exporter preserves `const` for discriminator fields**: Override the existing `const` stripping in `UNSUPPORTED_KEYWORDS` specifically for discriminator properties — without `const`, variants become indistinguishable.
- **OpenAPI exporter needs direct AST processing**: Currently delegates entirely to `exportJsonSchema`. For discriminated unions, it must add the `discriminator` annotation to the JSON Schema output post-hoc, OR process `MatchField` nodes directly. Decision: post-process the JSON Schema output to inject `discriminator` where `oneOf` with const-based branches exists.
- **Variant keys allow hyphens**: Existing grammar defines `identifier = letter { letter | digit | "_" | "-" }`. Variant keys follow the same rule. This supports real-world values like `us_bank_account` and `credit-card`. Dots are not allowed (they conflict with modifier syntax).
- **$ref collision handling**: If a `$ref` target already contains the discriminator field, the exporter validates compatibility (same `const` value as the variant key) and warns if conflicting. If absent, it is injected.
- **Importer detection is two-tier**: Tier 1: Explicit OpenAPI `discriminator` annotation (unambiguous). Tier 2: Heuristic — `oneOf` where all variants share a property with `const` (detect the shared property name). Tier 1 takes precedence.

## Open Questions

### Resolved During Planning

- **AST naming**: `MatchField` — consistent convention, matches keyword
- **Injection timing**: Export-time — keeps AST faithful to source
- **Pydantic v2 syntax**: `Annotated[A | B, Discriminator('field')]` with `Literal` types
- **LLM exporter handling**: Use `anyOf` + preserve `const` for discriminator fields
- **Variant key character set**: Follow existing identifier grammar (letters, digits, underscores, hyphens)

### Deferred to Implementation

- Exact parser error messages for malformed match blocks
- Whether to emit a `discriminator` annotation in the JSON Schema exporter (it's OpenAPI-only; the JSON Schema exporter should emit pure JSON Schema with `oneOf` + `const`)
- Handling of edge cases where the importer's heuristic false-positives on `oneOf` schemas that are not actually discriminated unions

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

### Grammar Extension (EBNF)

```ebnf
match_type     = "match" , "(" , identifier , ")" ;
match_block    = field_name , ":" , match_type , [ ":" , description ] , NEWLINE ,
                 INDENT , { variant_block } , DEDENT ;
variant_block  = variant_key , ":" , NEWLINE ,
                 INDENT , ( variant_fields | ref_line ) , DEDENT ;
variant_key    = identifier ;
variant_fields = { field_line } ;
ref_line       = "$ref:" , ref_path ;
```

### AST Node

```
MatchField extends BaseField {
    type: 'match'
    discriminator: string           // field name, e.g. 'type'
    variants: Record<string, ObjectField | RefField>  // variant key -> schema
}
```

### Export-Time Discriminator Injection

Each exporter, when processing a `MatchField`, iterates over variants and injects the discriminator property:
- For inline variants: add `{discriminator}: const(variantKey)` to the object's properties
- For $ref variants: resolve the reference, clone the schema, inject the discriminator property

### Importer Detection Flow

```
importField(name, obj):
  if obj.oneOf:
    if obj.discriminator?.propertyName:           // Tier 1: explicit OpenAPI
      return importDiscriminatedUnion(name, obj, obj.discriminator.propertyName)
    shared = findSharedConstProperty(obj.oneOf)   // Tier 2: heuristic
    if shared:
      return importDiscriminatedUnion(name, obj, shared)
    return importComposition(name, obj, 'oneOf')  // fallback: generic oneOf
```

## Implementation Units

- [ ] **Unit 1: AST types and parser foundation**

**Goal:** Define `MatchField` in the AST and parse `match(discriminator)` syntax with variant blocks.

**Requirements:** R1, R2, R4, R5, R6, R7 (R3 is cross-cutting — implemented by each exporter in Units 2–6)

**Dependencies:** None

**Files:**
- Modify: `clearschema/src/ast/types.ts`
- Modify: `clearschema/src/parser/parser.ts`
- Modify: `clearschema/src/index.ts`
- Create: `clearschema/tests/unit/parser/match.test.ts`

**Approach:**
- Add `'match'` to `FieldTypeName` type union and a `MatchType = 'match'` literal
- Define `MatchField` interface: `{ type: 'match', discriminator: string, variants: Record<string, ObjectField | RefField> }`
- Add `MatchField` to the `Field` union type
- In `parseTypeString`: before the dot-split logic, check if the type string starts with `match(` and ends with `)`. Extract the discriminator name from within parentheses. Return type `'match'` with the discriminator stored separately (add a `discriminator` field to `ParsedTypeString`)
- Add `'match'` to `isValidType` check (alongside the `ALL_TYPES` include)
- In `buildField` switch: add a `case 'match':` that calls `buildMatchField`
- `buildMatchField`: Consume `childFields` from `parseFieldWithModifiers`. Each child field was parsed as a `FIELD_LINE` — reinterpret: the child's `name` is the variant key, and its own children are the variant's fields. If the child has a description starting with `$ref:`, treat it as a `RefField` variant. Otherwise, construct an `ObjectField` from the child's children.
- Validate: unique variant keys (R4), valid $ref targets (R5)
- Export `MatchField` from `index.ts`

**Patterns to follow:**
- `buildCompositionField` (line ~972) for consuming child items
- `buildObjectField` for constructing variant object schemas
- `buildMapField` for the pattern of reinterpreting child fields as a different structure

**Test scenarios:**
- Happy path: parse `match(type)` with 2 inline variants → `MatchField` with correct discriminator and variant map
- Happy path: parse `match(kind)` with a `$ref` variant → `RefField` in variant map
- Happy path: parse match with mixed inline + `$ref` variants
- Happy path: match with description → description preserved on MatchField
- Edge case: match with single variant → valid (no minimum variant count)
- Edge case: variant key with hyphens (`credit-card`) → accepted
- Error path: duplicate variant keys → `ParseError` with clear message
- Error path: `match` without parentheses → `ParseError`
- Error path: `match()` with empty discriminator → `ParseError`
- Error path: match with no variants (empty block) → `ParseError`

**Verification:**
- All parser tests pass
- `MatchField` appears in exported types
- Existing composition tests remain green

---

- [ ] **Unit 2: JSON Schema exporter**

**Goal:** Export `MatchField` as `oneOf` with discriminator `const` values in each variant.

**Requirements:** R8

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/exporters/json-schema.ts`
- Modify: `clearschema/tests/unit/exporters/json-schema.test.ts`

**Approach:**
- Add `exportMatch(field: MatchField, options)` method
- Iterate over `field.variants`: for each variant, build the JSON Schema object, inject `{discriminator}: { const: variantKey }` as a required property
- For inline `ObjectField` variants: export as normal object, then inject discriminator
- For `RefField` variants: emit as `$ref` (do NOT inline — consumers like OpenAPI resolve refs separately). The discriminator is already expected in the referenced schema, OR the OpenAPI exporter handles it.
- Emit `oneOf: [variant1, variant2, ...]` — no `discriminator` annotation (that's OpenAPI-only, not pure JSON Schema)
- Wire into the `exportField`/`exportFieldType` dispatch

**Patterns to follow:**
- `exportComposition` method structure
- `exportObject` for building object schemas with properties and required arrays

**Test scenarios:**
- Happy path: 2 inline variants → `oneOf` with 2 objects, each having discriminator `const`
- Happy path: variant with multiple fields → all fields present plus discriminator
- Happy path: `$ref` variant → `$ref` pointer in `oneOf` array (discriminator not injected into ref)
- Edge case: variant with `required` fields → discriminator added to `required` array alongside existing required fields
- Edge case: variant with no additional fields (only discriminator) → valid minimal object

**Verification:**
- JSON Schema output validates against JSON Schema meta-schema
- `oneOf` structure matches expected format

---

- [ ] **Unit 3: TypeScript and Zod exporters**

**Goal:** Export `MatchField` as TypeScript discriminated union types and Zod `z.discriminatedUnion()`.

**Requirements:** R9, R10

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/exporters/typescript.ts`
- Modify: `clearschema/src/exporters/zod.ts`
- Modify: `clearschema/tests/unit/exporters/typescript.test.ts`
- Modify: `clearschema/tests/unit/exporters/zod.test.ts`

**Approach:**
- **TypeScript**: Add `exportMatchType(field, options)`. For each variant, emit an inline object type with `{discriminator}: '{variantKey}'` as a literal type, plus the variant's fields. Join with ` | `. For `$ref` variants, emit `({discriminator}: '{variantKey}'} & RefTypeName)` intersection.
- **Zod**: Add `exportMatchType(field, includeDescriptions, depth)`. Emit `z.discriminatedUnion('{discriminator}', [z.object({...}), ...])`. Each variant object must include `{discriminator}: z.literal('{variantKey}')`. For `$ref` variants, emit the referenced schema's Zod code with the discriminator injected.

**Patterns to follow:**
- `exportCompositionType` in both exporters
- TypeScript: `exportObjectType` for building inline object types
- Zod: `exportObjectType` for building `z.object({...})`

**Test scenarios:**
- Happy path (TS): 2 variants → `{ type: 'a'; fieldA: string } | { type: 'b'; fieldB: number }`
- Happy path (Zod): 2 variants → `z.discriminatedUnion('type', [z.object({type: z.literal('a'), ...}), ...])`
- Happy path: match with description → JSDoc comment in TS, `.describe()` in Zod
- Edge case: variant with optional fields → `?` in TS, `.optional()` in Zod (alongside required discriminator)
- Edge case: `$ref` variant → intersection in TS, merged object in Zod

**Verification:**
- TypeScript output is valid TypeScript syntax
- Zod output uses `z.discriminatedUnion` (not `z.union`)

---

- [ ] **Unit 4: Pydantic and OpenAPI exporters**

**Goal:** Export `MatchField` as Pydantic discriminated union and OpenAPI `discriminator` annotation.

**Requirements:** R11, R12

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `clearschema/src/exporters/pydantic.ts`
- Modify: `clearschema/src/exporters/openapi.ts`
- Modify: `clearschema/tests/unit/exporters/pydantic.test.ts`
- Create: `clearschema/tests/unit/exporters/openapi.test.ts`

**Approach:**
- **Pydantic**: Add match handling to `exportFieldType`. For each variant, emit a Pydantic model class with `{discriminator}: Literal['{variantKey}']`. The union field becomes `Annotated[VariantA | VariantB, Discriminator('{discriminator}')]`. Also fix the existing composition gap (currently returns `Any`).
- **OpenAPI**: The OpenAPI exporter calls `exportJsonSchema` then wraps. For `MatchField`, post-process the JSON Schema output: find the `oneOf` array that corresponds to a match field and inject the `discriminator: { propertyName, mapping }` annotation. The mapping maps variant keys to their `$ref` paths or inline schema positions.

**Patterns to follow:**
- Pydantic: `exportObjectType` for model class generation
- OpenAPI: post-processing pattern in the existing `exportOpenApi` function

**Test scenarios:**
- Happy path (Pydantic): 2 variants → model classes with `Literal` types + `Annotated` union with `Discriminator`
- Happy path (OpenAPI): → JSON Schema `oneOf` with `discriminator: { propertyName: 'type', mapping: { ... } }`
- Edge case (Pydantic): variant with optional fields → `Optional[type] = None` alongside `Literal` discriminator
- Edge case (OpenAPI): `$ref` variants → mapping uses `$ref` paths

**Verification:**
- Pydantic output uses `Discriminator` + `Annotated` pattern
- OpenAPI output includes `discriminator` annotation alongside `oneOf`

---

- [ ] **Unit 5: LLM structured output exporter**

**Goal:** Export `MatchField` as `anyOf` with preserved `const` values for LLM provider compatibility.

**Requirements:** R13

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/exporters/llm-structured-output.ts`
- Modify: `clearschema/tests/unit/exporters/llm-structured-output.test.ts`

**Approach:**
- Use `anyOf` instead of `oneOf` for match fields (broadest LLM provider support — OpenAI strict mode has issues with `oneOf`)
- Preserve `const` on discriminator properties: the existing `stripUnsupportedKeywords` removes `const` globally. Modify it to skip `const` stripping when the property is a discriminator field within a match-derived `anyOf`. One approach: mark discriminator properties during export (e.g., with a temporary annotation) so the strip function can identify them.
- Apply existing strict-mode constraints to each variant: `additionalProperties: false`, all properties required (including the discriminator)
- No `discriminator` annotation (LLM providers don't recognize it)

**Patterns to follow:**
- Existing `enforceStrictObjects` function for per-variant property handling
- `stripUnsupportedKeywords` for understanding the stripping pipeline

**Test scenarios:**
- Happy path: 2 variants → `anyOf` (not `oneOf`) with each variant having discriminator `const` preserved
- Happy path: each variant has `additionalProperties: false` and all properties in `required`
- Happy path: discriminator property is in each variant's `required` array
- Edge case: variant with nested objects → strict mode applied recursively
- Integration: verify `const` is NOT stripped from discriminator field while other `const` values ARE stripped

**Verification:**
- Output uses `anyOf` (not `oneOf`)
- Discriminator `const` values survive the stripping pipeline

---

- [ ] **Unit 6: ClearSchema serializer and JSON Schema importer**

**Goal:** Round-trip `match` syntax and detect discriminated union patterns during import.

**Requirements:** R14, R15, R16, R17

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `clearschema/src/exporters/clearschema.ts`
- Modify: `clearschema/src/importers/json-schema.ts`
- Modify: `clearschema/tests/unit/exporters/clearschema.test.ts`
- Modify: `clearschema/tests/unit/importers/json-schema.test.ts`
- Modify: `clearschema/tests/integration/import-roundtrip.test.ts`

**Approach:**
- **Serializer**: Add `'match'` case to `buildTypePart` → `match({discriminator})`. Add match variant serialization to `serializeChildren`: emit each variant key + `:` followed by indented child fields or `$ref:` line.
- **Importer**: In `importField`, before the existing `oneOf` handler (line ~212), add discriminated union detection:
  - **Tier 1**: Check for `obj.discriminator?.propertyName` (explicit OpenAPI annotation). If present, extract the discriminator field name and pass to `importDiscriminatedUnion`.
  - **Tier 2**: If no explicit annotation, call `findSharedConstProperty(obj.oneOf)` — iterate all variants, find any property that appears in every variant with `const` or single-element `enum`. If found, use it as the discriminator.
  - `importDiscriminatedUnion`: Build a `MatchField` from the `oneOf` variants, extracting variant keys from each variant's discriminator `const` value. Import each variant's remaining schema as an `ObjectField`.

**Patterns to follow:**
- Serializer: `serializeCompositionItem` for the serialization pattern
- Importer: `importAnyOf` disambiguation heuristic for the detection pattern

**Test scenarios:**
- Happy path (serializer): `MatchField` → `.clear` text with `match(type)` and variant blocks
- Happy path (serializer): round-trip `parse → exportClearSchema → parse` produces equivalent AST
- Happy path (importer Tier 1): JSON Schema with `oneOf` + `discriminator: {propertyName: 'type'}` → `MatchField`
- Happy path (importer Tier 2): JSON Schema with `oneOf` where all variants have `type: {const: '...'}` → `MatchField`
- Edge case (importer): `oneOf` where variants do NOT share a const property → falls through to `CompositionField` (no false positive)
- Edge case (importer): `oneOf` with explicit `discriminator` but variants missing const → still detects via Tier 1
- Edge case (serializer): `$ref` variant → serializes as `$ref: path` under variant key
- Integration: JSON Schema round-trip — `parse .clear → export JSON Schema → import → export ClearSchema → compare`

**Verification:**
- Existing composition import tests remain green
- New discriminated union schemas are detected and imported as `MatchField`
- Round-trip fidelity confirmed

---

- [ ] **Unit 7: LSP support and documentation**

**Goal:** LSP autocomplete, hover, and diagnostics for `match` blocks. Update grammar docs.

**Requirements:** R19, R20, R21

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema-lsp/src/completion.ts`
- Modify: `clearschema-lsp/src/hover.ts`
- Modify: `docs/GRAMMAR.md`
- Modify: `docs/ARCHITECTURE.md`

**Approach:**
- **Completion**: Add `{ label: 'match', detail: 'Discriminated union', documentation: '...' }` to `TYPE_COMPLETIONS` array
- **Hover**: Add `match` entry to `TYPE_DOCS` or `COMPOSITION_DOCS` with description of syntax and behavior
- **Diagnostics**: Parser errors already flow through to LSP diagnostics via `parse()` call — no additional work needed beyond parser validation in Unit 1
- **GRAMMAR.md**: Add `match_type` and `variant_block` productions to the EBNF
- **ARCHITECTURE.md**: Remove "Conditional schemas (if/then/else)" from Non-Goals; add match to the supported types description

**Patterns to follow:**
- Existing `TYPE_COMPLETIONS` entries in `completion.ts`
- Existing `TYPE_DOCS` entries in `hover.ts`

**Test scenarios:**
- Happy path: LSP autocomplete suggests `match` after field name and colon
- Happy path: hover over `match` keyword shows discriminated union documentation
- Integration: malformed match block shows diagnostic error in LSP

**Verification:**
- LSP provides `match` in type completions
- Hover shows documentation
- Parser errors surface as diagnostics

## System-Wide Impact

- **Interaction graph:** Parser → AST → all 7 exporters + serializer + importer + LSP. Every exporter's type dispatch switch needs a `'match'` case. The `Field` union type change affects all code that pattern-matches on field types.
- **Error propagation:** Parser validation errors (duplicate variant keys, missing discriminator) flow through existing `ParseError` → LSP diagnostic pipeline. Exporter errors for $ref resolution use existing warning mechanisms.
- **API surface parity:** The `parse()` function returns `Schema` which includes `Field` — adding `MatchField` to the `Field` union is a TypeScript type-level breaking change for consumers who exhaustively switch on `field.type`. This is expected and documented.
- **Unchanged invariants:** All existing field types, composition types, and modifier behaviors remain unchanged. The `oneOf`/`anyOf`/`allOf` composition types continue to work as before.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Parser complexity — variant lines (`credit_card:`) look like field lines to the lexer | Parser detects match context and reinterprets child field lines as variant headers. Follow existing patterns for `map` and `object` where child parsing varies by parent type. |
| LLM exporter `const` stripping destroys discriminator semantics | Modify strip function to preserve `const` specifically on discriminator properties within match-derived `anyOf` branches |
| Importer false-positive detection — `oneOf` schemas that are not actually discriminated unions | Tier 1 (explicit annotation) is unambiguous. Tier 2 heuristic requires ALL variants to share the same property with `const` — unlikely to false-positive. If it does, the import is still semantically valid (just uses match instead of oneOf). |
| `MatchField` addition is a type-level breaking change for downstream TypeScript consumers | Acceptable at v0.7.0 pre-1.0. Document in changelog. |
| Pydantic exporter currently lacks composition support | Fix as part of Unit 4 — addresses a pre-existing gap |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-06-discriminated-unions-requirements.md](docs/brainstorms/2026-04-06-discriminated-unions-requirements.md)
- Related code: `clearschema/src/parser/parser.ts` (buildField dispatch), `clearschema/src/ast/types.ts` (Field union)
- External: [Pydantic v2 Unions docs](https://docs.pydantic.dev/latest/concepts/unions/), [Zod discriminatedUnion API](https://zod.dev/api), [OpenAPI discriminator spec](https://redocly.com/learn/openapi/discriminator)
- LLM provider constraints: Anthropic/OpenAI use `anyOf` (not `oneOf`), all support `const`, none support `discriminator` annotation
