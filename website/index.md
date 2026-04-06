---
layout: home

hero:
  name: ClearSchema
  text: Define schemas once, export everywhere
  tagline: A human-readable schema definition language that compiles to JSON Schema, TypeScript, Pydantic, Zod, OpenAPI, and LLM-optimized schemas from a single source of truth.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/introduction
    - theme: alt
      text: Try Playground
      link: /playground

features:
  - title: Multi-Format Export
    details: Export to JSON Schema, TypeScript, Pydantic, Zod, OpenAPI, and LLM-optimized schemas from a single .clear file.
    icon: "\U0001F504"
  - title: Human-Readable Syntax
    details: Write schemas in a clean, intuitive language that reads like documentation. Your team can actually read and review them.
    icon: "\U0001F4DD"
  - title: Zero Dependencies
    details: Hand-written parser with no runtime dependencies. Fast, portable, and lightweight.
    icon: "\U0001F4E6"
  - title: Schema References
    details: Define reusable types with $defs and $ref. Import across files for modular schema design.
    icon: "\U0001F517"
  - title: Rich Modifiers
    details: Add constraints like min, max, pattern, format, enum, and const directly in your schema definitions.
    icon: "\U0001F527"
  - title: CLI + API
    details: Convert schemas from the command line or use the programmatic API. No configuration required.
    icon: "\u2328\uFE0F"
  - title: Editor Intelligence
    details: LSP server with diagnostics, autocomplete, hover docs, go-to-definition, and document symbols.
    icon: "\U0001F4A1"
  - title: Import Existing Schemas
    details: Import JSON Schema files into ClearSchema format. Supports Draft 2020-12, 2019-09, and Draft-07.
    icon: "\U0001F4E5"
---

<div class="landing-content">

## Quick Example

Write your schema once in a clean, readable format — then export to any target.

<div class="code-comparison">
<div class="code-block">

**ClearSchema input** (9 lines)

```clearschema
name: string.required: User's full name
  ^ minLength: 2
  ^ maxLength: 128

email: string.required: Email address
  ^ format: email

age: integer: Age in years
  ^ min: 0
  ^ max: 150
```

</div>
<div class="code-block">

**JSON Schema output** (auto-generated)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "User's full name",
      "minLength": 2,
      "maxLength": 128
    },
    "email": {
      "type": "string",
      "description": "Email address",
      "format": "email"
    },
    "age": {
      "type": "integer",
      "description": "Age in years",
      "minimum": 0,
      "maximum": 150
    }
  },
  "required": ["name", "email"]
}
```

</div>
</div>

## Why ClearSchema?

| Feature | ClearSchema | JSON Schema | Zod |
|---------|-------------|-------------|-----|
| Human-readable | Yes | No (verbose JSON) | Code-based |
| Language-agnostic | Yes | Yes | No (JS/TS only) |
| Multiple exports | Yes | N/A | No |
| Zero dependencies | Yes | N/A | No |
| Schema reuse ($ref) | Yes | Yes | Partial |
| VS Code support | Yes | Via extensions | Via TypeScript |

**ClearSchema is best for:**
- Teams that need schemas in multiple languages
- API documentation that stays in sync with code
- Schemas that humans actually read and review
- Projects requiring JSON Schema, TypeScript, and Python output

## Use Cases

<div class="use-case-grid">
<div class="use-case-card">

### API Schemas

Define API contracts in ClearSchema and generate JSON Schema for request/response validation. Standards-compliant output for any validation library.

```bash
clearschema api-request.clear -f json-schema -o schema.json
```

</div>
<div class="use-case-card">

### TypeScript Types

Generate TypeScript interfaces directly from your schema definitions. Keep types in sync with API contracts without manual maintenance.

```bash
clearschema models.clear -f typescript -o types.ts
```

</div>
<div class="use-case-card">

### Python Models

Generate Pydantic model classes for Python services. Share the same schema source between your TypeScript frontend and Python backend.

```bash
clearschema models.clear -f pydantic -o models.py
```

</div>
<div class="use-case-card">

### LLM Structured Output

Generate schemas compatible with OpenAI, Anthropic, and Google structured output APIs. Strict-mode JSON Schema with no unsupported constraints.

```bash
clearschema tool.clear -f llm-schema -o tool-schema.json
```

</div>
<div class="use-case-card">

### Zod Validators

Generate Zod schemas for runtime validation that pair with your TypeScript types. One `.clear` file gives you both static types and runtime validation.

```bash
clearschema models.clear -f zod -o validators.ts
```

</div>
<div class="use-case-card">

### Import Existing Schemas

Migrate existing JSON Schema files to ClearSchema with one command. Supports Draft 2020-12, 2019-09, and Draft-07.

```bash
clearschema import schema.json -o schema.clear
```

</div>
</div>

</div>
