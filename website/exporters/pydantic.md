# Pydantic Exporter

Produces Python Pydantic v2 model classes from your `.clear` file.

## What It Produces

The Pydantic exporter generates Python code with `BaseModel` subclasses, typed fields, `Field()` constraints, and the correct import statements. The output is ready to use in any Python project with Pydantic v2 installed.

## CLI Usage

```bash
clearschema schema.clear -f pydantic -o models.py
```

## API Usage

```typescript
import { parse, exportPydantic } from '@clearschema/core';

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

// Default options
const python = exportPydantic(schema);

// With options
const pythonCustom = exportPydantic(schema, {
  includeComments: false,  // omit docstrings and descriptions
  useTyping: false,        // use X | None instead of Optional[X]
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeComments` | `boolean` | `true` | Include docstrings and `description=` in `Field()` calls. |
| `useTyping` | `boolean` | `true` | `true` uses `Optional[X]` from `typing`, `false` uses `X \| None` syntax (Python 3.10+). |

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

**Pydantic output:**

```python
from pydantic import BaseModel, Field

class Schema(BaseModel):
    name: str = Field(..., description="User's full name", min_length=2, max_length=128)
    email: EmailStr = Field(..., description="Email address")
    age: int = Field(None, description="Age in years", ge=0, le=150)
```

::: tip
The exporter automatically adds the necessary imports (e.g., `from pydantic import EmailStr`) based on the types used in your schema.
:::

## Smart Type Mapping

The Pydantic exporter maps ClearSchema types to the most specific Pydantic type available:

| ClearSchema Type / Format | Pydantic Type |
|--------------------------|---------------|
| `string` | `str` |
| `string` with `format: email` | `EmailStr` |
| `string` with `format: uri` or `url` | `HttpUrl` |
| `string` with `format: uuid` | `UUID` |
| `string` with `format: date` | `date` |
| `string` with `format: date-time` | `datetime` |
| `number` | `float` |
| `integer` | `int` |
| `integer` with `min >= 1` | `PositiveInt` |
| `integer` with `min >= 0` | `NonNegativeInt` |
| `boolean` | `bool` |
| `null` | `None` |
| `array` | `List[T]` |
| `array.tuple` | `Tuple[T1, T2, ...]` |
| `map` | `Dict[str, T]` |
| `union` | `Union[T1, T2]` |
| `$ref` | referenced class name |

## Constraint Mapping

ClearSchema modifiers map to Pydantic `Field()` parameters:

| ClearSchema Modifier | Pydantic `Field()` Parameter |
|---------------------|------------------------------|
| `minLength` | `min_length` |
| `maxLength` | `max_length` |
| `pattern` | `pattern` |
| `min` | `ge` (greater than or equal) |
| `max` | `le` (less than or equal) |
| `exclusiveMin` | `gt` (greater than) |
| `exclusiveMax` | `lt` (less than) |
| `multipleOf` | `multiple_of` |
| `minItems` | `min_items` |
| `maxItems` | `max_items` |
| `default` | `default=` |
| `description` | `description=` |

## Format-Specific Notes

### Optional Fields

Optional fields are wrapped in `Optional[T]` (when `useTyping` is `true`) or `T | None` (when `useTyping` is `false`) and default to `None`:

```python
# useTyping: true (default)
age: Optional[int] = None

# useTyping: false
age: int | None = None
```

### Required Fields

Required fields use the `...` (Ellipsis) sentinel in the `Field()` call:

```python
name: str = Field(..., description="User's full name")
```

### `$defs` Become Classes

Each definition in `$defs` becomes its own `BaseModel` subclass. Root fields are grouped into a class named `Schema`:

```python
class Address(BaseModel):
    """Mailing address"""
    street: str = Field(..., description="Street line")
    city: str = Field(..., description="City name")

class Schema(BaseModel):
    home: Optional[Address] = None
    work: Optional[Address] = None
```

### Automatic Imports

The exporter tracks which types are used and generates only the imports that are needed. You do not need to manually manage import statements.
