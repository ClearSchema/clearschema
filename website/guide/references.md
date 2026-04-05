# References

ClearSchema lets you define reusable schema fragments and reference them throughout your files. This avoids duplication and keeps schemas maintainable as they grow.

## Defining Reusable Schemas with $defs

Place named definitions inside a `$defs:` block at the top of your file:

```clearschema
$defs:
  Address: object: Mailing address
    street: string.required: Street address
    city: string.required: City
    state: string: State or province
    zipCode: string.required: Postal code
      ^ pattern: ^\d{5}(-\d{4})?$
    country: string.required: Country code
      ^ pattern: ^[A-Z]{2}$
```

Each definition has a name (like `Address`), a type, and its own fields and modifiers -- exactly the same syntax as a top-level field.

Definitions can be any type, not just objects:

```clearschema
$defs:
  Email: string: Validated email address
    ^ format: email
    ^ maxLength: 254

  Priority: integer: Priority level
    ^ enum: [1, 2, 3, 4, 5]
```

## Referencing Definitions with $ref

Use `$ref` to reference a definition by its JSON Pointer path:

```clearschema
$defs:
  Address: object: Mailing address
    street: string.required: Street
    city: string.required: City

homeAddress: $ref: #/$defs/Address
workAddress: $ref: #/$defs/Address
```

The path `#/$defs/Address` follows JSON Pointer syntax: `#` is the document root, `$defs` is the definitions section, and `Address` is the definition name.

### References in Arrays

You can reference definitions as array item types:

```clearschema
$defs:
  User: object: User profile
    name: string.required: Name
    email: string.required: Email

users: array.required: All users
  - $ref: #/$defs/User
```

### References in Maps

Map value types can also be references:

```clearschema
$defs:
  Config: object: Configuration entry
    key: string.required: Config key
    value: string.required: Config value

configs: map: Named configurations
  - $ref: #/$defs/Config
```

### References in Composition

Composition types (`allOf`, `anyOf`, `oneOf`) commonly use references to combine definitions:

```clearschema
$defs:
  User: object: Base user
    name: string.required: Name
    email: string.required: Email

  Admin: allOf: Admin user
    - $ref: #/$defs/User
    - object:
        role: string.required: Role
          ^ const: admin
        permissions: array.required: Permissions
          - string
```

## Cross-File Imports

For larger projects you can split definitions across multiple files and import them.

### Named Imports

Import specific definitions from another file:

```clearschema
import: ./common/types.clear
  - Address
  - User

shippingAddress: $ref: Address
customer: $ref: User
```

The `import:` directive specifies the file path, and each `-` line names a definition to import. After importing, you reference the definition by name directly (no `#/$defs/` prefix needed).

### Wildcard Imports

Import all definitions from a file with `*`:

```clearschema
import: ./common/types.clear
  - *

shippingAddress: $ref: Address
customer: $ref: User
billingAddress: $ref: Address
```

This imports every definition in the target file.

### Multiple Imports

You can import from multiple files:

```clearschema
import: ./common/types.clear
  - Address
  - User

import: ./common/products.clear
  - Product
  - Category

order: object.required: Customer order
  customer: $ref: User
  shippingAddress: $ref: Address
  items: array.required: Order items
    - $ref: Product
```

### File Resolution Rules

- Import paths are relative to the file containing the `import:` directive.
- Paths can use `./` (current directory) or `../` (parent directory).
- The `.clear` extension is required in the path.
- Circular imports are detected and produce an error.

:::warning
When using the programmatic API, import resolution requires calling `resolveImports()` after `parse()`. The parser reads the import declarations but does not load files. See the [API Reference](/reference/api#resolveimports) for details.
:::

## Resolving References Programmatically

The `resolveReferences()` function inlines all `$ref` references, replacing them with copies of the referenced definitions:

```typescript
import { parse, resolveReferences, exportJsonSchema } from '@clearschema/core';

const schema = parse(`
  $defs:
    Address: object: Address
      street: string.required: Street
      city: string.required: City

  home: $ref: #/$defs/Address
`);

const resolved = resolveReferences(schema);
// resolved.fields[0] is now a full object, not a $ref
```

This is useful when you want a flattened schema without any `$ref` pointers, for example when feeding a schema to a tool that does not support references.

## Example: E-commerce Schema

Here is a realistic example showing definitions and references working together:

```clearschema
$defs:
  Address: object: Shipping or billing address
    street: string.required: Street address
    city: string.required: City
    state: string: State or province
    zipCode: string.required: Postal code
      ^ pattern: ^\d{5}(-\d{4})?$
    country: string.required: Country code
      ^ pattern: ^[A-Z]{2}$

  Customer: object: Customer information
    id: string.required: Customer ID
    name: string.required: Full name
    email: string.required: Email
      ^ format: email
    shippingAddress: $ref: #/$defs/Address
    billingAddress: $ref: #/$defs/Address

order: object.required: E-commerce order
  orderId: string.required: Unique order ID
    ^ format: uuid
  customer: $ref: #/$defs/Customer
  total: number.required: Order total
    ^ min: 0
  status: string.required: Order status
    ^ enum: [pending, processing, shipped, delivered, cancelled]
```

The `Address` definition is reused three times (shipping, billing inside `Customer`, and potentially elsewhere) without any duplication.
