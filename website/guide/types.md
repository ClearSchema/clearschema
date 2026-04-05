# Types

ClearSchema supports a complete type system that maps cleanly to JSON Schema, TypeScript, Pydantic, and other targets. This page covers every available type with examples.

## Field Syntax

Every field follows this structure:

```
fieldName: type[.required][.nullable]: description
```

The type comes after the field name, separated by a colon. Inline modifiers like `.required` and `.nullable` are chained directly onto the type. Everything after the second colon is the description.

## Primitive Types

### string

Text values.

```clearschema
username: string.required: The user's login name
  ^ minLength: 3
  ^ maxLength: 64
```

Supports modifiers: `minLength`, `maxLength`, `pattern`, `format`.

### number

Numeric values (integer or floating point).

```clearschema
price: number.required: Price in USD
  ^ min: 0
  ^ exclusiveMax: 10000
```

Supports modifiers: `min`, `max`, `exclusiveMin`, `exclusiveMax`, `multipleOf`.

### integer

Whole numbers only. Accepts the same modifiers as `number`.

```clearschema
quantity: integer.required: Number of items
  ^ min: 1
  ^ max: 999
```

### boolean

True or false values.

```clearschema
isActive: boolean: Whether the account is active
  ^ default: true
```

### null

An explicit null value. Rarely used on its own -- you typically want `.nullable` on another type instead.

```clearschema
deletedAt: null: Always null for active records
```

## Complex Types

### object

A nested structure with named fields. Child fields are indented below the parent.

```clearschema
user: object.required: User profile
  name: string.required: Full name
    ^ minLength: 2
  email: string.required: Email address
    ^ format: email
  age: integer: Age in years
    ^ min: 0
    ^ max: 150
```

Objects can be nested to any depth:

```clearschema
company: object: Company information
  name: string.required: Company name
  address: object.required: Headquarters
    street: string.required: Street address
    city: string.required: City
    zipCode: string: Postal code
      ^ pattern: ^\d{5}$
```

### array

A collection of items. The item type is declared with a `-` prefix on an indented line.

**Array of primitives:**

```clearschema
tags: array: User tags
  - string
  ^ minItems: 1
  ^ maxItems: 10
```

**Array of objects:**

```clearschema
users: array.required: User list
  - object:
      name: string.required: User name
      email: string.required: Email
        ^ format: email
```

**Array of references:**

```clearschema
addresses: array: Saved addresses
  - $ref: #/$defs/Address
```

Supports modifiers: `minItems`, `maxItems`, `uniqueItems`.

### array.tuple

A fixed-length array where each position has its own type. Items are declared in order with `-` prefixes.

```clearschema
coordinates: array.tuple.required: GPS coordinates
  - number: Latitude
  - number: Longitude
```

```clearschema
record: array.tuple: Name and age pair
  - string: Name
  - integer: Age
```

### map

A dictionary with string keys and typed values. The value type is declared with a `-` prefix, similar to arrays.

**Map with string values:**

```clearschema
metadata: map: Key-value metadata
  - string
```

**Map with object values:**

```clearschema
headers: map: HTTP headers with details
  - object:
      value: string.required: Header value
      sensitive: boolean: Whether the header is sensitive
        ^ default: false
```

**Map with reference values:**

```clearschema
configs: map: Named configurations
  - $ref: #/$defs/Config
```

Maps export to JSON Schema `additionalProperties`, TypeScript `Record<string, T>`, and Pydantic `Dict[str, T]`.

## Union Types

A field that accepts multiple types, written with `|` between type names.

```clearschema
id: string|number.required: Flexible identifier
```

You can apply modifiers to specific variants of the union using type-prefixed modifiers:

```clearschema
id: string|number.required: Flexible ID
  ^ string.minLength: 3
  ^ string.pattern: ^[A-Z0-9]+$
  ^ number.min: 1000
```

Each prefixed modifier applies only to that variant. In JSON Schema this produces an `anyOf` with per-variant constraints.

:::info
Universal modifiers like `required`, `nullable`, `default`, `const`, and `enum` apply to the union as a whole and do not need a type prefix.
:::

## Reference Type

Use `$ref` to reference a named definition. See the [References](/guide/references) page for full details.

```clearschema
$defs:
  Address: object: Mailing address
    street: string.required: Street
    city: string.required: City

homeAddress: $ref: #/$defs/Address
workAddress: $ref: #/$defs/Address
```

## Composition Types

ClearSchema supports three composition keywords that combine schemas. See the [Composition](/guide/composition) page for detailed examples.

### allOf

The value must match **all** of the listed schemas. Used for intersection or extension patterns.

```clearschema
admin: allOf: Admin user
  - $ref: #/$defs/User
  - object:
      role: string.required: Role
        ^ const: admin
```

### anyOf

The value must match **at least one** of the listed schemas.

```clearschema
contact: anyOf: Contact method
  - object:
      email: string.required: Email
  - object:
      phone: string.required: Phone number
```

### oneOf

The value must match **exactly one** of the listed schemas (exclusive).

```clearschema
payment: oneOf: Payment method
  - object:
      cardNumber: string.required: Card number
  - object:
      bankAccount: string.required: Bank account
```

## Nullable Fields

Any field type can be made nullable by adding `.nullable`:

```clearschema
middleName: string.nullable: Middle name (may be null)
deletedAt: string.nullable: Deletion timestamp
  ^ format: date-time
```

In JSON Schema this produces `"type": ["string", "null"]`. In TypeScript it produces `string | null`.

## Required vs Optional

Fields are **optional by default**. Add `.required` to make a field mandatory:

```clearschema
name: string.required: Must be provided
nickname: string: Optional nickname
```

In JSON Schema, required fields are listed in the parent object's `required` array. In TypeScript, optional fields get a `?` suffix.
