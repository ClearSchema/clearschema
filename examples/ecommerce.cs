# E-commerce Schema
# Demonstrates references, composition, and complex nested structures

$defs:
  Address: object: Shipping or billing address
    street: string.required: Street address
    city: string.required: City
    state: string: State or province
    zipCode: string.required: Postal code
      ^ pattern: ^\d{5}(-\d{4})?$
    country: string.required: Country code
      ^ pattern: ^[A-Z]{2}$

  Product: object: Product information
    id: string.required: Product ID
      ^ format: uuid
    name: string.required: Product name
    price: number.required: Price in USD
      ^ min: 0
    inStock: boolean.required: Availability
    tags: array: Product categories
      - string
      ^ enum: [electronics, clothing, books, home, sports]

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

  items: array.required: Order items
    - object:
        product: $ref: #/$defs/Product
        quantity: integer.required: Quantity ordered
          ^ min: 1
        subtotal: number.required: Item subtotal
          ^ min: 0

  total: number.required: Order total
    ^ min: 0

  status: string.required: Order status
    ^ enum: [pending, processing, shipped, delivered, cancelled]

  createdAt: string.required: Order creation timestamp
    ^ format: date-time
