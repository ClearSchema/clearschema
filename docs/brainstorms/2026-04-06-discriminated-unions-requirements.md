---
date: 2026-04-06
topic: discriminated-unions
---

# Discriminated Unions for ClearSchema

## Problem Frame

ClearSchema cannot express discriminated unions -- the most common pattern for polymorphic data in APIs, event systems, and LLM tool definitions. The importer warns on `if/then/else` and `discriminator` and silently drops them, making reverse-imported schemas lossy. ARCHITECTURE.md lists conditional schemas as a Non-Goal for the initial release, but all initial goals are now complete (v0.7.0). This is the primary language completeness gap blocking ClearSchema from representing real-world schemas faithfully.

Real-world patterns that require this:
- Payment methods (credit card vs bank transfer vs PayPal)
- Event payloads (click vs purchase vs signup)
- API responses with a `type` or `kind` discriminator
- LLM tool result schemas with variant outputs

## Syntax Design

A new `match` keyword with the discriminator field name in parentheses. Variant keys become the const values for the discriminator field, auto-injected into each variant's schema.

```
payment: match(type): Payment method
  credit_card:
    cardNumber: string.required
    expiry: string.required
  bank_transfer:
    accountNumber: string.required
    routingNumber: string.required
  paypal:
    $ref: #/$defs/PayPalPayment
```

The parser understands the `credit_card` variant as having an implicit `type: string.const: 'credit_card'` field. The discriminator field is always `string` type with a `const` value matching the variant key.

Variants support both inline object definitions and `$ref` references.

## Requirements

**Grammar & Parser**

- R1. Add a `match` keyword to the grammar as a new field type: `match_type = "match" , "(" , IDENTIFIER , ")" ;`
- R2. Parse variant blocks as indented children of the match field, where each variant key is an identifier followed by a colon and either inline fields or a `$ref`
- R3. Auto-inject the discriminator field (with `const` equal to the variant key) into each variant's exported output (injection timing — parse-time vs export-time — deferred to planning)
- R4. Validate that variant keys are unique within a match block
- R5. Validate that `$ref` variants point to valid definitions (consistent with existing `$ref` validation)

**AST Representation**

- R6. Add a new `MatchField` (or `DiscriminatedUnionField`) AST node type with: discriminator field name, a map of variant key to schema (Field or RefField), and standard BaseField properties
- R7. Add the new node type to the `Field` discriminated union type in `clearschema/src/ast/types.ts`

**Exporters**

- R8. JSON Schema exporter: emit `oneOf` with each variant as an object schema containing the discriminator field with `const`, plus a sibling `discriminator: { propertyName: "..." }` annotation
- R9. TypeScript exporter: emit a discriminated union type where each variant has a literal type on the discriminator field (e.g., `{ type: 'credit_card'; cardNumber: string } | { type: 'bank_transfer'; ... }`)
- R10. Zod exporter: emit `z.discriminatedUnion('type', [z.object({ type: z.literal('credit_card'), ... }), ...])` 
- R11. Pydantic exporter: emit using `Discriminator` + `Annotated` union pattern (Pydantic v2 style)
- R12. OpenAPI exporter: emit `oneOf` with `discriminator: { propertyName: '...', mapping: { ... } }`
- R13. LLM structured output exporter: emit flattened `oneOf` with discriminator, applying existing strict-mode constraints (additionalProperties: false, all properties required)
- R14. ClearSchema serializer (`exportClearSchema`): round-trip `match` back to `.clear` syntax faithfully

**Importer**

- R15. Detect discriminated union patterns in incoming JSON Schema: `oneOf` where all variants share a property with `const` or `enum` with a single value
- R16. Detect OpenAPI `discriminator` annotation on `oneOf` schemas
- R17. Convert detected patterns to the new `MatchField` AST node instead of generic `CompositionField`
- R18. ~~Remove `if`, `then`, `else` from `UNSUPPORTED_KEYWORDS`~~ **Removed** — discriminated union detection operates on `oneOf` patterns (R15, R16), not `if/then/else`. Keep `if/then/else` in `UNSUPPORTED_KEYWORDS` unchanged.

**LSP & Editor**

- R19. LSP autocomplete suggests `match` as a field type
- R20. LSP diagnostics validate match blocks (duplicate variant keys, invalid discriminator)
- R21. LSP hover on a match field shows the discriminator and variant list

## Success Criteria

- A `.clear` file using `match(type)` compiles correctly to all 6+ export targets with proper discriminated union semantics
- Round-trip fidelity: `parse -> exportClearSchema -> parse` produces equivalent AST
- The JSON Schema importer correctly detects and converts `oneOf` + discriminator patterns into `match` AST nodes
- Existing composition types (`oneOf`, `anyOf`, `allOf`) continue to work unchanged
- Real-world schemas (Stripe payment methods, GitHub webhook events) can be expressed with `match`

## Scope Boundaries

- **Not in scope:** General `if/then/else` conditional schemas -- only discriminated unions where a single string field's const value selects the variant
- **Not in scope:** Non-string discriminator fields (integer discriminators, boolean discriminators)
- **Not in scope:** Nested discriminators (match within match) -- may work naturally but not explicitly designed for
- **Not in scope:** `dependentSchemas` or `dependentRequired` patterns
- **Not in scope:** Type-prefixed modifiers on union types (separate feature)

## Key Decisions

- **`match` keyword over extending `oneOf`**: A new keyword signals distinct semantics and avoids confusing existing `oneOf` composition with the new discriminated pattern. It also reads naturally: "match on type."
- **Auto-injected discriminator**: The variant key IS the discriminator value. This eliminates boilerplate and makes it impossible to forget the discriminator field or mismatch variant key and const value.
- **Both inline and $ref variants**: Maximizes flexibility. Small variants can be inline; large shared definitions can use $ref.
- **Discriminator is always string type**: Simplifies the initial implementation. String discriminators cover 95%+ of real-world cases. Integer discriminators can be added later if needed.

## Dependencies / Assumptions

- The discriminator field name must be a valid identifier (enforced by parser)
- Variant keys must be valid identifier-like strings (alphanumeric + underscores; no spaces or special characters)
- `$ref` variants are assumed to define object schemas (the discriminator field is injected into the resolved schema during export, not into the AST of the referenced definition)

## Outstanding Questions

### Deferred to Planning
- [Affects R6][Technical] Should the new AST node be called `MatchField` or `DiscriminatedUnionField`? Naming affects readability of the codebase.
- [Affects R3][Technical] Should the discriminator field injection happen at parse time (stored in AST) or at export time (computed on the fly)? Parse-time is simpler for exporters; export-time keeps the AST closer to the source.
- [Affects R15][Needs research] What heuristics reliably detect discriminated union patterns in arbitrary JSON Schema? Edge cases: variants with overlapping properties, discriminator field not at the top level.
- [Affects R11][Needs research] Verify the exact Pydantic v2 syntax for discriminated unions with `Discriminator` + `Annotated`. The pattern may vary between Pydantic 2.0 and 2.5+.
- [Affects R13][Technical] How should the LLM exporter handle discriminated unions given strict-mode constraints? The discriminator field must be included in each variant's required properties.

## Next Steps

-> `/ce:plan` for structured implementation planning
