# ClearSchema for VS Code

Syntax highlighting for ClearSchema - a human-friendly schema language that compiles to JSON Schema, TypeScript, and more.

## Features

- **Syntax Highlighting**: Full syntax highlighting for ClearSchema files
- **Auto-indentation**: Smart indentation for nested structures
- **Comment Support**: Line comments with `#`
- **Bracket Matching**: Automatic bracket pairing and matching

## File Extensions

This extension activates for files with the following extensions:
- `.clear`

## Example

```clearschema
# User schema example
$defs:
  User: object: User schema
    name: string.required: Full name
      ^ minLength: 2
    email: string.required: Email address
      ^ format: email
    age: integer: Age in years
      ^ min: 0
      ^ max: 150

users: array.required: List of users
  - $ref: #/$defs/User
```

## About ClearSchema

ClearSchema is a human-friendly schema language designed to be:
- **Readable**: Clean, YAML-like syntax with semantic indentation
- **Powerful**: Full support for JSON Schema features including references, unions, and composition
- **Multi-target**: Compiles to JSON Schema, TypeScript, and more

Learn more at [github.com/clearschema/clearschema](https://github.com/clearschema/clearschema)

## License

MIT
