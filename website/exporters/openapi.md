# OpenAPI Exporter

Produces an OpenAPI 3.1.0 specification from your `.clear` file.

## What It Produces

The OpenAPI exporter generates an OpenAPI 3.1.0 document with your schema definitions placed under `components/schemas`. It builds on top of the JSON Schema exporter internally, so all type mappings and constraints carry over. The output is a JSON object you can integrate into your API documentation pipeline.

## CLI Usage

```bash
clearschema schema.clear -f openapi -o openapi.json
```

## API Usage

```typescript
import { parse, exportOpenAPI } from '@clearschema/core';

const schema = parse(`
  name: string.required: User's full name
    ^ minLength: 2
    ^ maxLength: 128
  email: string.required: Email address
    ^ format: email
  age: integer: Age in years
    ^ min: 0
    ^ max: 150
`);

// With required metadata
const openapi = exportOpenAPI(schema, {
  title: 'User API',
  version: '1.0.0',
  description: 'API for managing user profiles',
  serverUrl: 'https://api.example.com',
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string` | `'Generated API'` | The API title in `info.title`. |
| `version` | `string` | `'1.0.0'` | The API version in `info.version`. |
| `description` | `string` | (none) | Optional description in `info.description`. |
| `serverUrl` | `string` | (none) | If provided, added to the `servers` array. |

## Example

**ClearSchema input:**

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

**OpenAPI output:**

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "User API",
    "version": "1.0.0",
    "description": "API for managing user profiles"
  },
  "servers": [
    {
      "url": "https://api.example.com"
    }
  ],
  "components": {
    "schemas": {
      "RootSchema": {
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
    }
  }
}
```

### With `$defs`

**ClearSchema input:**

```clearschema
$defs:
  Address: object: Mailing address
    street: string.required: Street line
    city: string.required: City name
    zip: string: Postal code

home: $ref: #/$defs/Address
work: $ref: #/$defs/Address
```

**OpenAPI output (components section):**

```json
{
  "components": {
    "schemas": {
      "Address": {
        "type": "object",
        "description": "Mailing address",
        "properties": {
          "street": {
            "type": "string",
            "description": "Street line"
          },
          "city": {
            "type": "string",
            "description": "City name"
          },
          "zip": {
            "type": "string",
            "description": "Postal code"
          }
        },
        "required": ["street", "city"]
      },
      "RootSchema": {
        "type": "object",
        "properties": {
          "home": { "$ref": "#/$defs/Address" },
          "work": { "$ref": "#/$defs/Address" }
        }
      }
    }
  }
}
```

## Format-Specific Notes

### Schema Placement

- **Root-level fields** are grouped into a single component called `RootSchema` under `components/schemas`.
- **`$defs` definitions** are placed as individual entries under `components/schemas`, using their definition name as the key.

### Relationship to JSON Schema Exporter

The OpenAPI exporter delegates to the JSON Schema exporter (Draft 2020-12) internally to produce the schema objects. All type mappings, constraint mappings, and modifier handling from the [JSON Schema exporter](/exporters/json-schema) apply here as well.

### OpenAPI 3.1 and JSON Schema

OpenAPI 3.1.0 uses JSON Schema Draft 2020-12 as its schema language, which means the schema objects in the output are fully valid JSON Schema. This is a key improvement over OpenAPI 3.0, which used a modified subset.

### No Paths or Operations

The exporter produces `components/schemas` only. It does not generate `paths`, `operations`, or request/response definitions. You can use the output as a building block and reference the generated schemas from your hand-written or generated OpenAPI paths:

```yaml
paths:
  /users:
    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RootSchema'
```

### Server URL

When `serverUrl` is provided, it is added to the `servers` array as a single entry. If you need multiple servers, you can modify the output after generation or use it as a starting point.
