# Introduction

ClearSchema is a human-readable schema definition language. You write your data contract once in a concise, readable format and export it to JSON Schema, TypeScript, Pydantic, Zod, OpenAPI, and more.

This guide walks you through creating your first schema and exporting it. You should be done in under two minutes.

## Prerequisites

- **Node.js 20+** installed on your machine
- A terminal / command prompt

## Step 1: Install ClearSchema

Install the package globally so the `clearschema` CLI command is available everywhere:

```bash
npm install -g @clearschema/core
```

## Step 2: Create a Schema File

Create a file called `user.clear` with the following content:

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

Each line declares a field. The format is `fieldName: type: description`, with optional modifiers on indented lines below using the `^` prefix.

- `.required` marks a field as mandatory.
- `^ format: email` applies the email format constraint to the string.
- `^ min: 0` and `^ max: 150` set numeric bounds.

## Step 3: Export to JSON Schema

Run the CLI to produce JSON Schema output:

```bash
clearschema user.clear -f json-schema -o user-schema.json
```

Open `user-schema.json` and you will see:

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

## Step 4: Try Other Formats

ClearSchema can export the same `.clear` file to multiple targets:

```bash
# TypeScript interfaces
clearschema user.clear -f typescript -o user.ts

# Pydantic models (Python)
clearschema user.clear -f pydantic -o user.py

# Zod runtime validators
clearschema user.clear -f zod -o user.zod.ts

# OpenAPI 3.1 component
clearschema user.clear -f openapi -o openapi.json
```

:::tip
You can also use ClearSchema as a library in your own Node.js code. See the [API Reference](/reference/api) for details.
:::

## Next Steps

- [Installation](/getting-started/installation) -- all the ways to install and use ClearSchema
- [Types](/guide/types) -- every type ClearSchema supports
- [Modifiers](/guide/modifiers) -- constraints, defaults, enums, and more
- [CLI Reference](/reference/cli) -- all commands and flags
