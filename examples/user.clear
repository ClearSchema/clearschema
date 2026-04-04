# User Profile Schema
# A simple example demonstrating basic ClearSchema features

user: object.required: User profile
  # Basic fields
  name: string.required: Full name
    ^ minLength: 2
    ^ maxLength: 100

  email: string.required: Email address
    ^ format: email

  # Optional fields
  age: integer: Age in years
    ^ min: 0
    ^ max: 150

  # Boolean with default
  isActive: boolean: Account status
    ^ default: true

  # Array of strings
  tags: array: User tags
    - string
    ^ minItems: 0
    ^ maxItems: 10
