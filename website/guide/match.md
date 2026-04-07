# Discriminated Unions

ClearSchema supports discriminated unions (tagged unions) with the `match()` syntax. A discriminated union is an object where one field (the discriminator) determines which set of fields is valid.

## Syntax

```clearschema
fieldName: match(discriminator): description
  variantValue:
    field1: type
    field2: type
  anotherVariant:
    field3: type
```

The discriminator name goes inside `match()`. Each variant is listed by its discriminator value, followed by its fields indented underneath.

## Basic Example

A payment method where the `type` field determines the available fields:

```clearschema
$defs:
  Payment: object: Payment details
    payment: match(type): Payment method
      credit_card:
        cardNumber: string.required: Card number
        expiry: string.required: Expiration date
          ^ pattern: ^\d{2}/\d{2}$
      bank_transfer:
        accountNumber: string.required: Bank account number
        routingNumber: string.required: Routing number
```

When `type` is `"credit_card"`, the object has `cardNumber` and `expiry`. When `type` is `"bank_transfer"`, it has `accountNumber` and `routingNumber`.

## Variants with $ref

Variants can reference existing definitions instead of defining fields inline:

```clearschema
$defs:
  CreditCardDetails: object: Credit card fields
    cardNumber: string.required
    expiry: string.required

  Payment: object: Payment details
    payment: match(type): Payment method
      credit_card: $ref: #/$defs/CreditCardDetails
      bank_transfer:
        accountNumber: string.required
        routingNumber: string.required
```

You can mix inline variants and `$ref` variants in the same `match()`.

## Modifiers

Discriminated unions support the same inline modifiers as other types:

```clearschema
payment: match(type).required.nullable: Payment method
  credit:
    card: string.required
  cash: {}
```

## Export Targets

The `match()` syntax compiles to the appropriate discriminated union representation in each target:

### JSON Schema

Uses `oneOf` with a `discriminator` annotation:

```json
{
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "type": { "type": "string", "const": "credit_card" },
        "cardNumber": { "type": "string" }
      },
      "required": ["type", "cardNumber"]
    },
    {
      "type": "object",
      "properties": {
        "type": { "type": "string", "const": "bank_transfer" },
        "accountNumber": { "type": "string" }
      },
      "required": ["type", "accountNumber"]
    }
  ],
  "discriminator": { "propertyName": "type" }
}
```

### TypeScript

Produces a discriminated union type:

```typescript
export type Payment =
  | { type: 'credit_card'; cardNumber: string; expiry: string }
  | { type: 'bank_transfer'; accountNumber: string; routingNumber: string };
```

### Pydantic

Uses tagged unions with discriminator:

```python
class CreditCard(BaseModel):
    type: Literal["credit_card"]
    card_number: str
    expiry: str

class BankTransfer(BaseModel):
    type: Literal["bank_transfer"]
    account_number: str
    routing_number: str

Payment = Annotated[Union[CreditCard, BankTransfer], Field(discriminator="type")]
```

### Zod

Uses `z.discriminatedUnion()`:

```typescript
const PaymentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("credit_card"), cardNumber: z.string(), expiry: z.string() }),
  z.object({ type: z.literal("bank_transfer"), accountNumber: z.string(), routingNumber: z.string() }),
]);
```

### OpenAPI

Uses `discriminator` with `mapping` on a `oneOf`:

```json
{
  "oneOf": [...],
  "discriminator": {
    "propertyName": "type",
    "mapping": {
      "credit_card": "#/components/schemas/CreditCardVariant",
      "bank_transfer": "#/components/schemas/BankTransferVariant"
    }
  }
}
```

## Importing Discriminated Unions

The JSON Schema importer detects discriminated unions in two ways:

1. **Explicit discriminator annotation** -- `oneOf` with a `discriminator.propertyName` field
2. **Heuristic detection** -- `oneOf` where each variant has a `const` value on the same property

Both produce `match()` syntax in the imported `.clear` output.

## When to Use

Discriminated unions are the right choice when:

- An object's shape depends on a single "type" or "kind" field
- You want compile-time exhaustiveness checking (TypeScript) or runtime validation (Zod, Pydantic)
- You need clean, human-readable schema definitions for API request/response payloads, event systems, or payment methods

For simpler cases where you just need "one of these types" without a discriminator field, use [composition](/guide/composition) with `oneOf` instead.
