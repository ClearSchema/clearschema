# ClearSchema Grammar Specification

This document defines the formal EBNF grammar for ClearSchema and provides syntax examples.

---

## EBNF Grammar

```ebnf
(* Document Structure *)
document        = { metadata } , { import_decl } , { definitions } , fields ;

(* Metadata *)
metadata        = namespace | version | targets ;
namespace       = "namespace:" , identifier ;
version         = "version:" , version_string ;
targets         = "targets:" , "[" , identifier , { "," , identifier } , "]" ;

(* Imports *)
import_decl     = "import:" , file_path , NEWLINE , { INDENT , "-" , ( identifier | "*" ) , NEWLINE } ;
file_path       = quoted_string | relative_path ;
relative_path   = [ "./" | "../" ] , { path_segment , "/" } , filename ;
filename        = identifier , ".clear" ;

(* Schema Definitions *)
definitions     = "$defs:" , NEWLINE , { INDENT , definition , NEWLINE } ;
definition      = identifier , ":" , field_body ;

(* Fields *)
fields          = { field , NEWLINE } ;
field           = field_name , ":" , field_type , [ ".required" ] , [ ".nullable" ] , ":" , description , { modifier_line } , { child_content } ;

(* Field Components *)
field_name      = identifier ;
field_type      = primitive_type | complex_type | union_type | reference_type | composition_type ;
primitive_type  = "string" | "number" | "integer" | "boolean" | "null" ;
complex_type    = "object" | "array" | "array.tuple" ;
union_type      = field_type , { "|" , field_type } ;
reference_type  = "$ref" ;
composition_type = "allOf" | "anyOf" | "oneOf" ;  (* "extends" reserved for future use *)
description     = { any_char_except_newline } ;

(* Modifiers *)
modifier_line   = INDENT , "^" , modifier_name , [ ":" , modifier_value ] ;
modifier_name   = [ type_prefix , "." ] , identifier ;
type_prefix     = "string" | "number" | "array" | "object" ;
modifier_value  = string_value | number_value | boolean_value | array_value | object_value ;

(* Array Items *)
child_content   = array_items | object_fields | composition_items ;
array_items     = INDENT , "-" , ( item_type | inline_object ) , [ ":" , description ] ;
item_type       = field_type ;
inline_object   = "object:" , NEWLINE , { INDENT , field } ;

(* Object Fields *)
object_fields   = { INDENT , field } ;

(* Composition Items *)
composition_items = { INDENT , "-" , ( reference | inline_schema ) } ;
reference       = "$ref:" , json_pointer ;
inline_schema   = field_body ;

(* Values *)
string_value    = quoted_string | unquoted_string ;
number_value    = integer | decimal ;
boolean_value   = "true" | "false" ;
array_value     = "[" , [ value , { "," , value } ] , "]" ;
object_value    = "{" , [ key_value , { "," , key_value } ] , "}" ;
key_value       = string_value , ":" , value ;
value           = string_value | number_value | boolean_value | array_value | object_value | "null" ;

(* JSON Pointer *)
json_pointer    = "#/" , path_segment , { "/" , path_segment } ;
path_segment    = identifier | "$defs" ;

(* Lexical Elements *)
identifier      = letter , { letter | digit | "_" | "-" } ;
quoted_string   = '"' , { any_char_except_quote } , '"' ;
unquoted_string = { any_char_except_special } ;
integer         = [ "-" ] , digit , { digit } ;
decimal         = integer , "." , digit , { digit } ;
version_string  = digit , { digit } , "." , digit , { digit } , [ "." , digit , { digit } ] ;

(* Comments - line-based only, no inline comments *)
comment         = "#" , { any_char_except_newline } ;

(* Whitespace *)
INDENT          = ( "  " | "\t" ) , { "  " | "\t" } ;
NEWLINE         = "\n" | "\r\n" ;
```

---

## Syntax Examples

### Basic Field

```yaml
name: string.required: User's full name
  ^ minLength: 2
  ^ maxLength: 128
```

### Object with Nested Fields

```yaml
user: object.required: User profile
  name: string.required: Full name
  email: string.required: Email address
    ^ format: email
  age: number: Age in years
    ^ min: 0
    ^ max: 150
```

### Array with Item Type

```yaml
tags: array: List of tags
  - string
  ^ minItems: 1
  ^ maxItems: 10
```

### Tuple Array

```yaml
coordinates: array.tuple: GPS coordinates
  - number: latitude
  - number: longitude
  - number: altitude
```

### Object Array

```yaml
users: array: User list
  - object:
      name: string.required: User name
      email: string.required: Email
        ^ format: email
```

### Union Type

```yaml
id: string|number: Flexible identifier
  ^ string.minLength: 3
  ^ string.pattern: ^[A-Z0-9_-]+$
  ^ number.min: 1000
```

### Schema References

```yaml
$defs:
  User: object: Reusable user schema
    name: string.required: Full name
    email: string.required: Email
      ^ format: email

primaryUser: $ref: #/$defs/User

contacts: array: Contact list
  - $ref: #/$defs/User
```

### Schema Composition

```yaml
adminUser: allOf: Admin user with extra permissions
  - $ref: #/$defs/User
  - object:
      permissions: array.required: Admin permissions
        - string
        ^ enum: [read, write, delete, admin]
```

### External Imports

```yaml
import: ./common/types.clear
  - User
  - Address

primaryUser: $ref: User
shippingAddress: $ref: Address
```

### Wildcard Import

```yaml
import: ./common/types.clear
  - *
```

---

## Description Parsing

### Greedy Colon Parsing

Descriptions use **greedy parsing**: everything after the second colon is treated as the description, including any additional colons.

```yaml
# The description is: "The URL format is: https://example.com"
url: string: The URL format is: https://example.com

# The description is: "Ratio (e.g., 1:2:3)"
ratio: string: Ratio (e.g., 1:2:3)
```

This means you never need to escape or quote colons in descriptions.

### Multi-line Descriptions

For longer descriptions, use YAML-style pipe syntax:

```yaml
complexField: object: |
  This is a longer description that spans multiple lines.
  It preserves line breaks and is useful for documenting
  complex fields that need detailed explanation.

  You can include blank lines too.
```

The indented block after `|` is collected as the description with line breaks preserved.

**Grammar:**
```ebnf
description       = inline_description | block_description ;
inline_description = { any_char_except_newline } ;
block_description  = "|" , NEWLINE , INDENT , { description_line , NEWLINE } , DEDENT ;
description_line   = { any_char_except_newline } ;
```

---

## Indentation Rules

- **Default:** 2 spaces per level
- **Also supported:** 4 spaces, tabs
- **Detection:** From first indented line
- **Requirement:** Consistent within document (errors on inconsistency)
- **Mixed tabs/spaces:** Error

### Examples

**Valid (2-space indent):**
```yaml
user: object: User
  name: string: Name
  address: object: Address
    street: string: Street
    city: string: City
```

**Valid (4-space indent):**
```yaml
user: object: User
    name: string: Name
    address: object: Address
        street: string: Street
```

**Invalid (inconsistent):**
```yaml
user: object: User
  name: string: Name     # 2 spaces
   age: number: Age      # 3 spaces - ERROR
```

---

## Comments

ClearSchema supports line comments only. Comments start with `#` and extend to the end of the line.

```yaml
# This is a document-level comment

user: object: User profile  # Inline comments are NOT supported
  # This comment is on its own line
  name: string: Full name

  # Another comment
  email: string: Email address
```

**Note:** Inline comments (after content on the same line) are not supported to keep parsing simple and avoid ambiguity with `#` characters in strings.

---

## Reserved Keywords

The following are reserved and cannot be used as field names:

- `$defs`
- `$ref`
- `import`
- `namespace`
- `version`
- `targets`
- `allOf`
- `anyOf`
- `oneOf`
- `extends` (reserved for future use)

---

## File Extension

ClearSchema files use the `.clear` extension:

```
schemas/
  user.clear
  common/
    types.clear
    address.clear
```
