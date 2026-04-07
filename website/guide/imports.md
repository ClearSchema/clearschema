# Imports

ClearSchema supports cross-file imports so you can split large schemas across multiple `.clear` files and share definitions between them.

## Syntax

Use the `import:` declaration at the top of your file, followed by the file path and a list of definition names to import:

```clearschema
import: ./common/types.clear
  - User
  - Address
```

This makes `User` and `Address` available for `$ref` references in the current file.

## Wildcard Imports

Import all definitions from a file with `*`:

```clearschema
import: ./common/types.clear
  - *
```

## Multiple Imports

Import from several files by listing multiple `import:` blocks:

```clearschema
import: ./common/types.clear
  - User
  - Address

import: ./models/product.clear
  - Product
  - Category
```

## Using Imported Definitions

Once imported, reference definitions with `$ref` as usual:

```clearschema
import: ./common/types.clear
  - Address

order: object.required: Customer order
  shippingAddress: $ref: #/$defs/Address
  billingAddress: $ref: #/$defs/Address
```

## Full Example

**common/types.clear:**

```clearschema
$defs:
  Address: object: Mailing address
    street: string.required: Street address
    city: string.required: City
    state: string: State or province
    zipCode: string.required: Postal code
      ^ pattern: ^\d{5}(-\d{4})?$

  Email: string: Validated email
    ^ format: email
    ^ max: 254
```

**models/user.clear:**

```clearschema
import: ../common/types.clear
  - Address
  - Email

$defs:
  User: object: Registered user
    name: string.required: Full name
    email: $ref: #/$defs/Email
    homeAddress: $ref: #/$defs/Address
```

## Resolving Imports

### CLI

The CLI resolves imports automatically when compiling. File paths are relative to the importing file's location:

```bash
clearschema models/user.clear -f typescript -o types.ts
```

### API

Use `resolveImports` to resolve import declarations before exporting:

```typescript
import { parse, resolveImports, exportTypeScript } from '@clearschema/core';
import fs from 'fs';

const source = fs.readFileSync('models/user.clear', 'utf-8');
const schema = parse(source);

const resolved = await resolveImports(schema, {
  basePath: './models'
});

const typescript = exportTypeScript(resolved);
```

The `basePath` option tells the resolver where to look for imported files relative to the current working directory.

## Notes

- Import paths are always relative (starting with `./` or `../`)
- Circular imports are detected and produce an error
- Imported definitions are merged into the importing schema's `$defs` before export
- Import declarations must appear before `$defs` and field definitions in the file
