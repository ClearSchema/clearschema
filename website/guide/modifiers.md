# Modifiers

Modifiers add constraints, defaults, and metadata to fields. ClearSchema provides three ways to apply modifiers: inline on the field line, as block modifiers on indented lines, and with type prefixes for union variants.

## Inline Modifiers

Chain `.required` and `.nullable` directly onto the type:

```clearschema
name: string.required: Full name
email: string.required.nullable: Email (null if unknown)
```

Only `required` and `nullable` can be used inline. All other modifiers use block syntax.

## Block Modifiers

Block modifiers appear on indented lines below the field, prefixed with `^`:

```clearschema
username: string.required: Login name
  ^ minLength: 3
  ^ maxLength: 64
  ^ pattern: ^[a-zA-Z0-9_]+$
```

Each `^` line sets one modifier with a value. The value can be a string, number, boolean, array, or object.

## Type-Prefixed Modifiers

When a field is a union type, prefix the modifier with the target type name to apply it to a specific variant:

```clearschema
id: string|number.required: Flexible ID
  ^ string.minLength: 3
  ^ string.pattern: ^[A-Z0-9]+$
  ^ number.min: 1000
```

Without a prefix on a union field, the parser raises an error because it cannot determine which variant the modifier targets.

:::info
Universal modifiers (`required`, `nullable`, `default`, `const`, `enum`, `description`) do not need a type prefix on union fields -- they apply to the union as a whole.
:::

## String Modifiers

These modifiers are valid on `string` fields.

| Modifier | Value Type | Description |
|----------|-----------|-------------|
| `minLength` | `integer` | Minimum character count |
| `maxLength` | `integer` | Maximum character count |
| `pattern` | `string` | Regular expression the value must match |
| `format` | `string` | Semantic format (see format values below) |

**Example:**

```clearschema
email: string.required: Email address
  ^ format: email

productCode: string: Product code
  ^ pattern: ^[A-Z]{3}\d{4}$
  ^ minLength: 7
  ^ maxLength: 7
```

### Format Values

| Format | Description |
|--------|-------------|
| `email` | Email address |
| `uri` | Full URI |
| `url` | URL (alias for `uri` in some contexts) |
| `uuid` | UUID string |
| `date-time` | ISO 8601 date-time |
| `date` | ISO 8601 date (YYYY-MM-DD) |
| `time` | ISO 8601 time (HH:MM:SS) |
| `ipv4` | IPv4 address |
| `ipv6` | IPv6 address |
| `hostname` | Internet hostname |

**Example:**

```clearschema
createdAt: string.required: Creation timestamp
  ^ format: date-time

website: string: Homepage URL
  ^ format: uri

userId: string.required: Unique identifier
  ^ format: uuid
```

### Pattern Escaping

Pattern values are passed through as-is -- no double-escaping is needed. Write your regex naturally:

```clearschema
zipCode: string: US postal code
  ^ pattern: ^\d{5}(-\d{4})?$
```

## Number Modifiers

These modifiers are valid on `number` and `integer` fields.

| Modifier | Value Type | Description |
|----------|-----------|-------------|
| `min` | `number` | Minimum value (inclusive), maps to JSON Schema `minimum` |
| `max` | `number` | Maximum value (inclusive), maps to JSON Schema `maximum` |
| `exclusiveMin` | `number` | Exclusive minimum (value must be greater than this) |
| `exclusiveMax` | `number` | Exclusive maximum (value must be less than this) |
| `multipleOf` | `number` | Value must be a multiple of this number |

**Example:**

```clearschema
age: integer: Age in years
  ^ min: 0
  ^ max: 150

price: number.required: Item price
  ^ min: 0
  ^ exclusiveMax: 10000

quantity: integer: Must be in multiples of 6
  ^ multipleOf: 6
```

:::warning
You cannot use both `min` and `exclusiveMin` on the same field, and likewise for `max` and `exclusiveMax`. The parser will report a conflict error.
:::

## Array Modifiers

These modifiers are valid on `array` and `array.tuple` fields.

| Modifier | Value Type | Description |
|----------|-----------|-------------|
| `minItems` | `integer` | Minimum number of items |
| `maxItems` | `integer` | Maximum number of items |
| `uniqueItems` | `boolean` | Whether all items must be unique |

**Example:**

```clearschema
tags: array: User tags
  - string
  ^ minItems: 1
  ^ maxItems: 20
  ^ uniqueItems: true
```

## Universal Modifiers

These modifiers work on any field type.

| Modifier | Value Type | Description |
|----------|-----------|-------------|
| `required` | `boolean` | Field is mandatory (usually set inline as `.required`) |
| `nullable` | `boolean` | Field value may be null (usually set inline as `.nullable`) |
| `default` | any | Default value when the field is absent |
| `const` | any | Field must have exactly this value |
| `enum` | array | Field must be one of the listed values |
| `description` | `string` | Field description (usually set inline after the second colon) |

### default

```clearschema
status: string: Order status
  ^ default: pending

isActive: boolean: Account active flag
  ^ default: true

retries: integer: Retry count
  ^ default: 3
```

### const

Lock a field to a single allowed value:

```clearschema
version: string.required: API version
  ^ const: v2

type: string.required: Discriminator
  ^ const: user
```

### enum

Restrict a field to a set of allowed values:

```clearschema
status: string.required: Order status
  ^ enum: [pending, processing, shipped, delivered, cancelled]

priority: integer: Priority level
  ^ enum: [1, 2, 3, 4, 5]
```

## The range Shorthand

The `range` modifier sets both minimum and maximum in one line. Its meaning depends on the field type:

| Field Type | `range: [a, b]` expands to |
|------------|---------------------------|
| `string` | `minLength: a`, `maxLength: b` |
| `number` | `min: a`, `max: b` |
| `integer` | `min: a`, `max: b` |

```clearschema
username: string.required: Username
  ^ range: [3, 20]

temperature: number: Temperature in Celsius
  ^ range: [-40, 60]
```

For exclusive bounds on numbers, use `exclusiveRange`:

```clearschema
probability: number: Value between 0 and 1, exclusive
  ^ exclusiveRange: [0, 1]
```

## Modifier Validation

The parser validates modifier compatibility at parse time:

- Applying a string modifier (like `minLength`) to a number field is a parse error.
- Conflicting values (like `minLength: 10` with `maxLength: 5`) are a parse error.
- Union fields require type-prefixed modifiers for type-specific constraints.

Error messages include the file, line, and column:

```
ParseError: Invalid modifier 'minLength' for number field
  --> schema.clear:3:5
   |
 3 |   ^ minLength: 10
   |     ^^^^^^^^^^ 'minLength' is only valid for string fields
   |
  help: Did you mean 'min'?
```
