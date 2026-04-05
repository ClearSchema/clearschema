# Composition

ClearSchema provides three composition keywords -- `allOf`, `anyOf`, and `oneOf` -- that combine multiple schemas into one. It also supports inline union types with `|` for simpler cases.

## allOf (Intersection / Extension)

A value must match **all** of the listed schemas. This is commonly used to extend a base type with additional fields.

```clearschema
$defs:
  User: object: Base user
    name: string.required: Full name
    email: string.required: Email address
      ^ format: email

  Admin: allOf: Admin user with extra fields
    - $ref: #/$defs/User
    - object:
        role: string.required: Admin role
          ^ const: admin
        permissions: array.required: Granted permissions
          - string
          ^ enum: [read, write, delete, admin]
```

The `Admin` definition inherits all fields from `User` (via `$ref`) and adds `role` and `permissions` through the second schema in the list.

**JSON Schema output:**

```json
{
  "allOf": [
    { "$ref": "#/$defs/User" },
    {
      "type": "object",
      "properties": {
        "role": { "type": "string", "const": "admin" },
        "permissions": {
          "type": "array",
          "items": { "type": "string", "enum": ["read", "write", "delete", "admin"] }
        }
      },
      "required": ["role", "permissions"]
    }
  ]
}
```

### When to Use allOf

- Extending a base schema with additional required fields
- Combining independently defined schemas that must all be satisfied
- Modeling inheritance-like patterns

## anyOf (Union / Variant)

A value must match **at least one** of the listed schemas.

```clearschema
$defs:
  EmailContact: object: Email contact
    email: string.required: Email address
      ^ format: email

  PhoneContact: object: Phone contact
    phone: string.required: Phone number
    extension: string: Phone extension

  contact: anyOf: At least one contact method
    - $ref: #/$defs/EmailContact
    - $ref: #/$defs/PhoneContact
```

A valid `contact` value can be an email contact, a phone contact, or even both (if the value satisfies both schemas).

**JSON Schema output:**

```json
{
  "anyOf": [
    { "$ref": "#/$defs/EmailContact" },
    { "$ref": "#/$defs/PhoneContact" }
  ]
}
```

### When to Use anyOf

- Allowing multiple valid shapes for a single field
- Modeling "at least one of these" requirements
- Cases where values might legitimately satisfy multiple schemas

## oneOf (Exclusive Union)

A value must match **exactly one** of the listed schemas. If a value matches two or more, validation fails.

```clearschema
$defs:
  CreditCard: object: Credit card payment
    cardNumber: string.required: Card number
      ^ pattern: ^\d{16}$
    expiryDate: string.required: Expiry date
      ^ pattern: ^\d{2}/\d{2}$

  BankTransfer: object: Bank transfer payment
    bankAccount: string.required: Account number
    routingNumber: string.required: Routing number

  payment: oneOf: Payment method (exactly one)
    - $ref: #/$defs/CreditCard
    - $ref: #/$defs/BankTransfer
```

A `payment` value must be either a credit card or a bank transfer, but never both.

**JSON Schema output:**

```json
{
  "oneOf": [
    { "$ref": "#/$defs/CreditCard" },
    { "$ref": "#/$defs/BankTransfer" }
  ]
}
```

### When to Use oneOf

- Discriminated unions where exactly one variant should match
- Payment methods, notification channels, or similar mutually exclusive options
- Any case where matching more than one schema would be a bug

## Inline Schemas in Composition

Composition items can be inline objects instead of references:

```clearschema
adminUser: allOf: Admin user
  - $ref: #/$defs/User
  - object:
      role: string.required: Role
        ^ const: admin
```

The second item is defined inline as an `object:` with its fields indented beneath it. You can mix references and inline schemas freely.

## Union Types with |

For simple cases where a field can be one of several primitive or simple types, use the `|` syntax instead of composition:

```clearschema
id: string|number.required: Flexible identifier
```

This is equivalent to an `anyOf` with two type schemas, but is more concise.

### Per-Type Modifiers on Unions

Apply constraints to specific variants using type-prefixed modifiers:

```clearschema
id: string|number.required: Flexible ID
  ^ string.minLength: 3
  ^ string.pattern: ^[A-Z0-9]+$
  ^ number.min: 1000
```

**JSON Schema output:**

```json
{
  "anyOf": [
    {
      "type": "string",
      "minLength": 3,
      "pattern": "^[A-Z0-9]+$"
    },
    {
      "type": "number",
      "minimum": 1000
    }
  ]
}
```

Each type-prefixed modifier applies only to its variant. Universal modifiers (like `default` or `enum`) apply to the union as a whole.

### Union vs Composition

| Approach | Best for |
|----------|----------|
| `string\|number` | Simple type alternatives with optional per-type constraints |
| `anyOf` | Complex object variants or when referencing definitions |
| `oneOf` | Mutually exclusive variants where only one should match |
| `allOf` | Combining/extending schemas where all must be satisfied |

:::tip
Use union types (`|`) when you have two or three primitive types. Use composition keywords when combining objects, referencing definitions, or when you need the semantic distinction between `anyOf` and `oneOf`.
:::

## Composition with Descriptions

Each composition type accepts a description, just like any other field:

```clearschema
result: oneOf: API response (success or error)
  - object:
      data: object.required: Response payload
        id: string.required: Resource ID
        name: string.required: Resource name
  - object:
      error: object.required: Error details
        code: integer.required: Error code
        message: string.required: Error message
```

## Nesting Composition

Composition types can reference other composition types, allowing complex schema patterns:

```clearschema
$defs:
  BaseEntity: object: Common entity fields
    id: string.required: Entity ID
      ^ format: uuid
    createdAt: string.required: Creation timestamp
      ^ format: date-time

  User: allOf: User entity
    - $ref: #/$defs/BaseEntity
    - object:
        name: string.required: Full name
        email: string.required: Email
          ^ format: email

  Admin: allOf: Admin entity
    - $ref: #/$defs/User
    - object:
        role: string.required: Admin role
          ^ const: admin
```

Here `Admin` extends `User`, which itself extends `BaseEntity`. The result is a schema that requires `id`, `createdAt`, `name`, `email`, and `role` -- built up through a chain of `allOf` compositions.
