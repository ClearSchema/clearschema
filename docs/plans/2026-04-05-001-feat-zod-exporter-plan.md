---
title: "feat: Add Zod runtime validator exporter"
type: feat
status: completed
date: 2026-04-05
deepened: 2026-04-05
---

# feat: Add Zod runtime validator exporter

## Overview

Add a sixth exporter that emits Zod schemas from ClearSchema AST, producing runtime validation code that pairs with the existing TypeScript type exporter. One `.clear` file can now generate both `types.ts` (static types) and `validators.ts` (runtime validation) — the strongest "why ClearSchema?" pitch for TypeScript teams.

## Problem Frame

The TypeScript exporter generates types erased at runtime. Teams pair TS types with Zod for validation, and keeping them in sync is painful. A Zod exporter from ClearSchema gives TypeScript teams both static types and runtime validation from a single source of truth. The Pydantic exporter already proves this pattern works for Python teams.

## Requirements Trace

- R1. New `zod` export format producing valid Zod schema code as a string
- R2. Full AST type coverage: primitives, objects, arrays, tuples, maps, unions, refs, composition types (allOf/anyOf/oneOf)
- R3. Modifier-to-Zod constraint mapping: string (min/max/regex/format), number (min/max/multipleOf), integer (.int()), array (min/max), nullable, optional, default, const, enum, description. Supported string formats: email → `.email()`, uri → `.url()`, uuid → `.uuid()`, datetime → `.datetime()`. All other formats (date, time, ipv4, hostname, etc.) fall back to plain `z.string()`.
- R4. `$defs` as named `const` exports whose type matches the definition's actual content — objects become `z.object({...})`, enums become `z.enum([...])`, etc. (e.g., `export const UserSchema = z.object({...})`, `export const StatusSchema = z.enum([...])`)
- R5. Root fields wrapped in a `Schema` const
- R6. CLI integration via `-f zod`
- R7. Programmatic API via `exportZod()` and `ZodExporter` class
- R8. Import statement: `import { z } from 'zod'` at top of output
- R9. Zod remains a peer dependency concern only — ClearSchema itself has zero runtime deps

## Scope Boundaries

- No inferred TypeScript types from Zod schemas (no `z.infer<>` generation) — users can do this themselves
- No Zod-specific modifiers in the ClearSchema DSL (e.g., `.transform`, `.refine`)
- No Zod version selection — targets Zod v3 API (stable, widely adopted)
- No `z.lazy()` for circular references — same limitation as other exporters
- No playground integration this iteration (separate scope)
- `uniqueItems` on arrays silently ignored — Zod v3 has no built-in `.unique()` validator
- `format: 'date'` string format has no Zod v3 equivalent (unlike `datetime` → `.datetime()`) — falls back to `z.string()`

## Context & Research

### Relevant Code and Patterns

The TypeScript exporter (`clearschema/src/exporters/typescript.ts`) is the primary template — it produces string output, maps AST types to TypeScript syntax, and handles the same `$defs` + root fields structure. The Pydantic exporter (`clearschema/src/exporters/pydantic.ts`) is a secondary reference for import tracking and constraint mapping patterns.

**Exporter pattern:** Every exporter follows `class FooExporter implements Exporter<T>` with a standalone `exportFoo()` factory function. String-output exporters use a central `exportFieldType(field)` method that switches on `field.type`.

Key files (all paths relative to `clearschema/`):
- `src/exporters/types.ts` — `Exporter<T>` interface, `ExportOptions` base
- `src/exporters/typescript.ts` — primary reference for string-output exporter
- `src/exporters/pydantic.ts` — reference for import tracking and constraint mapping
- `src/cli/index.ts` — format validation (hardcoded string check), dispatch chain
- `src/index.ts` — barrel exports
- `src/ast/types.ts` — `Field` discriminated union, `Schema` root, `BaseField` properties
- `tests/unit/exporters/typescript.test.ts` — test structure reference
- `tests/integration/complex-schemas.test.ts` — cross-exporter integration tests

### Institutional Learnings

No `docs/solutions/` directory exists. The existing 5 exporters serve as the institutional knowledge — consistent patterns across all of them.

## Key Technical Decisions

- **String output (not AST):** Emit Zod code as a string, matching TypeScript and Pydantic exporter patterns. A Zod AST builder would add complexity for no benefit since the output is source code.
- **Named const pattern for definitions:** `$defs` become `export const FooSchema = z.object({...})` rather than a single anonymous schema. This matches how developers actually write Zod code and enables tree-shaking.
- **Format string modifiers:** Map ClearSchema format modifiers (email, uri, uuid, datetime, etc.) to Zod's built-in validators (`.email()`, `.url()`, `.uuid()`, `.datetime()`). Unsupported formats fall back to plain `z.string()`.
- **`const` overrides base type:** When a field has `const` set, emit `z.literal(value)` replacing the base type entirely. Universal modifiers (`.nullable()`, `.optional()`, `.default()`, `.describe()`) still chain onto the literal. Type-specific modifiers (`.min()`, `.regex()`, etc.) are silently dropped since they're redundant with a literal.
- **Enum handling:** The string-vs-mixed distinction is about the *values in the enum array*, not the field's declared type. If all values are strings, use `z.enum([...])`. Otherwise use `z.union([z.literal(...), ...])`. This handles number enums on `NumberField` correctly since `z.enum()` only accepts strings.
- **`const` takes precedence over `enum`:** If both are set on the same field (unusual but possible in AST), `const` wins and `enum` is ignored.
- **Composition mapping:** `allOf` with two schemas → `z.intersection(a, b)`. Three or more → `z.intersection(a, b).and(c).and(d)` (flat chaining, mirroring TypeScript exporter's flat `a & b & c` pattern). `anyOf`/`oneOf` → `z.union([...])`.
- **`ZodExportOptions` shape:** `{ includeDescriptions?: boolean }` defaulting to `true`. Controls `.describe()` emission. Follows the pattern of `TypeScriptExportOptions.includeComments` and `PydanticExportOptions.includeComments`.
- **No Zod dependency:** ClearSchema generates Zod code but does not import or depend on Zod. The generated code's consumer provides Zod.

## Open Questions

### Resolved During Planning

- **Should definitions export `const` or `let`?** → `const` with `export` keyword. This matches Zod community convention and enables tree-shaking.
- **How to handle `$ref` types?** → Reference by the definition's const name (e.g., `AddressSchema`). Append `Schema` suffix to definition names to follow Zod naming convention.
- **`.nullable()` vs `.nullish()`?** → `.nullable()` only. ClearSchema's `nullable` modifier means "value or null", not "value or null or undefined".
- **`UnionField.types` are `FieldTypeName` strings, not `Field` objects?** → Yes. Need a `mapPrimitiveType(typeName)` helper that converts `FieldTypeName` → Zod primitive (e.g., `"string"` → `z.string()`). Same pattern as TypeScript exporter's `mapPrimitiveType()`.
- **`exclusiveMin`/`exclusiveMax` mapping?** → Map to `.gt(N)` / `.lt(N)` (Zod's exclusive bounds). Apply to both `number` and `integer` fields. If both `min` and `exclusiveMin` are set, apply both (matching Pydantic exporter behavior).

### Deferred to Implementation

- **Exact ordering of chained modifiers** — Follow Zod convention (type → constraints → nullable → optional → default → describe). Adjust if tests reveal ordering issues.
- **Indentation of deeply nested objects** — Follow TypeScript exporter's approach (2-space indent). Fine-tune during implementation.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Type mapping table (AST → Zod):**

| AST type | Zod output |
|----------|------------|
| `string` | `z.string()` + `.min()`, `.max()`, `.regex()`, `.email()`, `.url()`, `.uuid()`, `.datetime()` |
| `number` | `z.number()` + `.min()`, `.max()`, `.multipleOf()` |
| `integer` | `z.number().int()` + `.min()`, `.max()` |
| `boolean` | `z.boolean()` |
| `null` | `z.null()` |
| `object` | `z.object({ ... })` |
| `array` | `z.array(<item>)` + `.min()`, `.max()` |
| `map` | `z.record(z.string(), <value>)` |
| `array.tuple` | `z.tuple([...])` |
| `union` | `z.union([...])` |
| `ref` | `FooSchema` (const name reference) |
| `allOf` | `z.intersection(a, b)` or chained `.and()` |
| `anyOf`/`oneOf` | `z.union([...])` |
| nullable | `.nullable()` |
| optional | `.optional()` |
| default | `.default(value)` |
| const | `z.literal(value)` |
| enum (strings) | `z.enum([...])` |
| enum (mixed) | `z.union([z.literal(...), ...])` |
| description | `.describe("...")` |

**Output structure:**
```
import { z } from 'zod';

// From $defs
export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
});

// Root schema
export const Schema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(0),
  address: AddressSchema.optional(),
});
```

## Implementation Units

- [x] **Unit 1: Core Zod exporter with primitive types**

**Goal:** Create the exporter file with class structure, primitive type mapping, and basic modifier support.

**Requirements:** R1, R3, R4, R5, R7, R8

**Dependencies:** None

**Files:**
- Create: `clearschema/src/exporters/zod.ts`
- Create: `clearschema/tests/unit/exporters/zod.test.ts`

**Approach:**
- Implement `ZodExporter` class implementing `Exporter<string>` with `ZodExportOptions` interface (`{ includeDescriptions?: boolean }`, default `true`). Define options in `zod.ts` (canonical), re-export from `types.ts` and `index.ts`
- Include basic `z.object()` support in this unit (needed for `$defs` and root Schema scaffolding tests). Full object/nested support in Unit 2
- Central `exportFieldType(field)` switch dispatching on `field.type`, with `const`/`enum` checks before type dispatch (since they override or replace the base type)
- `mapPrimitiveType(typeName: FieldTypeName)` helper for union type mapping
- Handle string/number/integer/boolean/null primitives with their modifier chains
- `$defs` emit as `export const <Name>Schema = ...` with `Schema` suffix
- Root fields emit as `export const Schema = z.object({...})`
- Always emit `import { z } from 'zod';` as first line
- Standalone `exportZod()` factory function

**Patterns to follow:**
- `clearschema/src/exporters/typescript.ts` — class structure, field dispatch, indent handling
- `clearschema/src/exporters/pydantic.ts` — constraint mapping approach

**Test scenarios:**
- Happy path: string field → `z.string()`
- Happy path: number field → `z.number()`
- Happy path: integer field → `z.number().int()`
- Happy path: boolean field → `z.boolean()`
- Happy path: null field → `z.null()`
- Happy path: string with minLength/maxLength → `.min(N).max(N)`
- Happy path: string with pattern → `.regex(/pattern/)`
- Happy path: string with format email → `.email()`
- Happy path: string with format uri → `.url()`
- Happy path: string with format uuid → `.uuid()`
- Happy path: string with format datetime → `.datetime()`
- Happy path: string with unsupported format → plain `z.string()`
- Happy path: number with min/max → `.min(N).max(N)`
- Happy path: number with multipleOf → `.multipleOf(N)`
- Happy path: integer with exclusiveMin/exclusiveMax → `.gt(N)` / `.lt(N)`
- Happy path: nullable field → `.nullable()`
- Happy path: optional field (required: false) → `.optional()`
- Happy path: field with default → `.default(value)`
- Happy path: field with const → `z.literal(value)`
- Happy path: field with string enum → `z.enum([...])`
- Happy path: field with mixed enum → `z.union([z.literal(...), ...])`
- Happy path: field with description → `.describe("...")`
- Happy path: output starts with `import { z } from 'zod';`
- Happy path: $defs produce named `export const` with `Schema` suffix
- Happy path: root fields wrapped in `export const Schema = z.object({...})`
- Happy path: number with exclusiveMin/exclusiveMax → `.gt(N)` / `.lt(N)`
- Happy path: field with `const` overrides base type → `z.literal("active")` instead of `z.string()`
- Happy path: field with `const` + `nullable` → `z.literal("x").nullable()`
- Happy path: field with `const` + `description` → `z.literal("x").describe("...")`
- Happy path: enum on number field (all number values) → `z.union([z.literal(1), z.literal(2)])`
- Happy path: enum + optional → `z.enum([...]).optional()`
- Edge case: string + minLength + maxLength + nullable + optional + default → correct chain order
- Edge case: number + min + max + description → correct chain order
- Edge case: `const` + `enum` both set → `const` wins, `enum` ignored
- Happy path: `mapPrimitiveType('string')` → `z.string()`, `('number')` → `z.number()`, etc. (helper used by union types in Unit 3)

**Verification:**
- All primitive types produce valid Zod code
- Modifier chains apply in correct order
- Output is a syntactically valid Zod module

---

- [x] **Unit 2: Complex types — objects, arrays, tuples, maps**

**Goal:** Add support for complex/nested types including objects, arrays, tuples, and maps.

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/exporters/zod.ts`
- Modify: `clearschema/tests/unit/exporters/zod.test.ts`

**Approach:**
- `object` → `z.object({ ... })` with recursive field export
- `array` → `z.array(<itemSchema>)` handling both `Field` and `FieldTypeName` for `itemType`
- `array.tuple` → `z.tuple([<schemas>])`
- `map` → `z.record(z.string(), <valueSchema>)` handling both `Field` and `FieldTypeName` for `valueType`
- Array modifiers: `minItems` → `.min()`, `maxItems` → `.max()`
- Handle nested composition (object inside array, map of arrays, etc.)

**Patterns to follow:**
- `clearschema/src/exporters/typescript.ts` — `exportObjectType()`, `exportArrayType()`, `exportMapType()`, `exportTupleType()`

**Test scenarios:**
- Happy path: object with fields → `z.object({ field: z.string() })`
- Happy path: nested objects → properly indented nested `z.object()`
- Happy path: array with primitive item → `z.array(z.string())`
- Happy path: array with complex item (object) → `z.array(z.object({...}))`
- Happy path: array with minItems/maxItems → `.min(N).max(N)`
- Happy path: tuple → `z.tuple([z.string(), z.number()])`
- Happy path: map with primitive value → `z.record(z.string(), z.string())`
- Happy path: map with object value → `z.record(z.string(), z.object({...}))`
- Happy path: nullable map → `z.record(...).nullable()`
- Edge case: map with `FieldTypeName` string value type → handles bare string type name
- Edge case: array with `FieldTypeName` string item type → handles bare string type name
- Edge case: deeply nested (array of objects with map fields) → correct nesting
- Edge case: empty object (no fields) → `z.object({})`

**Verification:**
- All complex types produce valid nested Zod code
- Indentation is consistent for nested structures

---

- [x] **Unit 3: References, unions, and composition types**

**Goal:** Add support for `$ref`, union types, and allOf/anyOf/oneOf composition.

**Requirements:** R2, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `clearschema/src/exporters/zod.ts`
- Modify: `clearschema/tests/unit/exporters/zod.test.ts`

**Approach:**
- `ref` → Extract name from `#/$defs/Name` pattern, append `Schema` suffix, emit as bare reference (e.g., `AddressSchema`)
- `union` → `UnionField.types` are `FieldTypeName` strings, not `Field` objects. Use `mapPrimitiveType()` from Unit 1 to convert each to Zod primitives, then wrap in `z.union([...])`
- `allOf` → `z.intersection(a, b)` for two schemas, `.and()` chaining for 3+ (flat pattern)
- `anyOf`/`oneOf` → `z.union([...])`
- Composition schemas may contain refs — handle `RefField` within composition arrays

**Patterns to follow:**
- `clearschema/src/exporters/typescript.ts` — `exportRefType()`, `exportUnionType()`, `exportCompositionType()`

**Test scenarios:**
- Happy path: ref field → references `FooSchema` const by name
- Happy path: ref in nested position (object field is a ref) → inline reference
- Happy path: union of two types → `z.union([z.string(), z.number()])`
- Happy path: union of three+ types → `z.union([...])` with all variants
- Happy path: allOf with two schemas → `z.intersection(a, b)`
- Happy path: allOf with three schemas → `z.intersection(a, b).and(c)` (flat chaining)
- Happy path: anyOf → `z.union([...])`
- Happy path: oneOf → `z.union([...])`
- Happy path: composition with ref members → refs resolved to const names
- Happy path: $defs with non-object definition → type alias const (e.g., `export const StatusSchema = z.enum([...])`)
- Edge case: ref to undefined definition → uses name as-is (best effort)

**Verification:**
- References correctly link to named schema consts
- Composition types produce valid Zod intersection/union code

---

- [x] **Unit 4: CLI integration and public API**

**Goal:** Wire the Zod exporter into the CLI and barrel exports.

**Requirements:** R6, R7

**Dependencies:** Units 1–3

**Files:**
- Modify: `clearschema/src/cli/index.ts`
- Modify: `clearschema/src/index.ts`
- Modify: `clearschema/src/exporters/types.ts`

**Approach:**
- Re-export `ZodExportOptions` from `src/exporters/types.ts` (canonical definition lives in `zod.ts`, matching how other exporters define then re-export their options)
- Add `'zod'` to format validation in `parseArgs()`
- Add `else if (format === 'zod')` dispatch in `main()`
- Import `exportZod` in CLI
- Update help text and error messages with `zod` format
- Re-export `ZodExporter`, `exportZod`, `ZodExportOptions` from `src/index.ts`

**Patterns to follow:**
- Existing format entries in `clearschema/src/cli/index.ts`
- Export pattern in `clearschema/src/index.ts`

**Test scenarios:**
- Happy path: CLI with `-f zod` produces Zod output
- Happy path: programmatic `exportZod(schema)` returns valid string
- Error path: help text lists `zod` as a format option

**Verification:**
- `clearschema -f zod examples/basic.clear` produces valid Zod output
- `exportZod` is importable from `@clearschema/core`

---

- [x] **Unit 5: Integration tests, docs, and CHANGELOG**

**Goal:** Add cross-exporter integration tests and update documentation.

**Requirements:** R1–R9

**Dependencies:** Units 1–4

**Files:**
- Modify: `clearschema/tests/integration/complex-schemas.test.ts`
- Modify: `clearschema/README.md`
- Modify: `clearschema/CHANGELOG.md`

**Approach:**
- Add Zod assertions to existing integration test sections (map fields, complex schemas)
- Add a dedicated Zod integration test with a realistic multi-type schema
- Update README: add Zod to the exporter list, add a Zod output example
- Update CHANGELOG with the new feature entry

**Patterns to follow:**
- Existing integration test blocks for other exporters
- README format section structure

**Test scenarios:**
- Integration: schema with map fields → Zod output includes `z.record()`, verified alongside all other exporters
- Integration: realistic schema with objects, arrays, refs, unions → produces complete valid Zod module
- Integration: schema with $defs and cross-references → all const names resolve correctly

**Verification:**
- All existing tests continue to pass (no regressions)
- Integration tests verify Zod output alongside other exporters
- README accurately documents the new format

## System-Wide Impact

- **Interaction graph:** The exporter is pure — takes AST in, returns string out. No callbacks, middleware, or side effects. CLI dispatches to it like all other exporters.
- **Error propagation:** Parser errors prevent export (same as all exporters). No new error paths introduced.
- **API surface parity:** The Zod exporter covers the same AST types as TypeScript/Pydantic exporters. The playground is explicitly out of scope for this iteration.
- **Unchanged invariants:** All existing exporters, parser, resolver, and CLI behavior remain unchanged. No modifications to AST types or shared infrastructure.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Zod API changes in v4 | Target Zod v3 (stable, ubiquitous). v4 migration is future scope. |
| Modifier chain ordering produces invalid Zod | Test each modifier combination. Zod is generally order-agnostic for chaining. |
| Generated code doesn't pass Zod's own type checking | Manual verification of representative outputs against actual Zod in a scratch project during implementation. |

## Sources & References

- Related ideation: `docs/ideation/2026-04-04-general-ideation.md` (item #5)
- Primary pattern reference: `clearschema/src/exporters/typescript.ts`
- Secondary pattern reference: `clearschema/src/exporters/pydantic.ts`
- Zod v3 API: https://zod.dev
