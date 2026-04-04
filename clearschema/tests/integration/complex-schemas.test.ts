import { parse } from '../../src';
import { ObjectField, ArrayField, StringField, NumberField, TupleArrayField } from '../../src/ast/types';

describe('Integration Tests - Complex Schemas', () => {
    describe('User Profile Schema', () => {
        it('parses complete user profile with addresses', () => {
            const input = `@namespace com.example
@version 1.0.0

user: object.required: User profile
  id: string.required: Unique identifier
    ^ format: uuid
  name: string.required: Full name
    ^ minLength: 2
    ^ maxLength: 100
  email: string.required: Email address
    ^ format: email
  age: integer: Age in years
    ^ min: 0
    ^ max: 150
  addresses: array: List of addresses
    - object:
      street: string.required: Street address
      city: string.required: City name
      country: string.required: Country
      zipCode: string: ZIP/Postal code
        ^ pattern: ^[0-9]{5}(-[0-9]{4})?$
    ^ minItems: 1
  tags: array: User tags
    - string
    ^ uniqueItems: true
  active: boolean: Is user active
    ^ default: true`;

            const schema = parse(input);

            expect(schema.namespace).toBe('com.example');
            expect(schema.version).toBe('1.0.0');
            expect(schema.fields).toHaveLength(1);

            const userField = schema.fields[0] as ObjectField;
            expect(userField.type).toBe('object');
            expect(userField.required).toBe(true);
            expect(userField.fields).toHaveLength(7);

            // Check id field
            const idField = userField.fields[0] as StringField;
            expect(idField.name).toBe('id');
            expect(idField.format).toBe('uuid');

            // Check name field
            const nameField = userField.fields[1] as StringField;
            expect(nameField.minLength).toBe(2);
            expect(nameField.maxLength).toBe(100);

            // Check addresses array
            const addressesField = userField.fields[4] as ArrayField;
            expect(addressesField.type).toBe('array');
            expect(addressesField.minItems).toBe(1);

            const addressObject = addressesField.itemType as ObjectField;
            expect(addressObject.type).toBe('object');
            expect(addressObject.fields).toHaveLength(4);

            // Check tags array
            const tagsField = userField.fields[5] as ArrayField;
            expect(tagsField.uniqueItems).toBe(true);

            // Check active field
            const activeField = userField.fields[6];
            expect(activeField.default).toBe(true);
        });
    });

    describe('API Response Schema', () => {
        it('parses API response with nested data', () => {
            const input = `response: object: API Response
  status: integer.required: HTTP status code
    ^ min: 100
    ^ max: 599
  success: boolean.required: Success flag
  data: object: Response data
    items: array: List of items
      - object:
        id: string.required: Item ID
        name: string.required: Item name
        price: number: Item price
          ^ min: 0
    total: integer: Total count
      ^ min: 0
    page: integer: Current page
      ^ min: 1
      ^ default: 1
  error: object.nullable: Error details
    code: string.required: Error code
    message: string.required: Error message`;

            const schema = parse(input);

            expect(schema.fields).toHaveLength(1);

            const response = schema.fields[0] as ObjectField;
            expect(response.fields).toHaveLength(4);

            // Check data object
            const dataField = response.fields[2] as ObjectField;
            expect(dataField.type).toBe('object');
            expect(dataField.fields).toHaveLength(3);

            // Check items array
            const itemsField = dataField.fields[0] as ArrayField;
            expect(itemsField.type).toBe('array');

            const itemObject = itemsField.itemType as ObjectField;
            expect(itemObject.fields).toHaveLength(3);

            // Check error is nullable
            const errorField = response.fields[3] as ObjectField;
            expect(errorField.nullable).toBe(true);
        });
    });

    describe('Deeply Nested Schema', () => {
        it('parses 5 levels of nesting', () => {
            const input = `root: object: Root
  level1: object: Level 1
    level2: object: Level 2
      level3: object: Level 3
        level4: object: Level 4
          level5: object: Level 5
            value: string: Deep value
            items: array: Deep items
              - string`;

            const schema = parse(input);

            const root = schema.fields[0] as ObjectField;
            const l1 = root.fields[0] as ObjectField;
            const l2 = l1.fields[0] as ObjectField;
            const l3 = l2.fields[0] as ObjectField;
            const l4 = l3.fields[0] as ObjectField;
            const l5 = l4.fields[0] as ObjectField;

            expect(l5.fields).toHaveLength(2);
            expect(l5.fields[0].name).toBe('value');
            expect(l5.fields[1].name).toBe('items');
            expect(l5.fields[1].type).toBe('array');
        });
    });

    describe('GeoJSON-like Schema', () => {
        it('parses geometry with coordinate tuples', () => {
            const input = `feature: object: GeoJSON Feature
  type: string.required: Feature type
    ^ const: Feature
  geometry: object.required: Geometry
    type: string.required: Geometry type
      ^ enum: [Point, LineString, Polygon]
    coordinates: array.tuple: Point coordinates
      - number: longitude
      - number: latitude
      - number: altitude
  properties: object: Feature properties
    name: string: Feature name
    tags: array: Feature tags
      - string`;

            const schema = parse(input);

            const feature = schema.fields[0] as ObjectField;
            expect(feature.fields).toHaveLength(3);

            const geometry = feature.fields[1] as ObjectField;
            const typeField = geometry.fields[0] as StringField;
            expect(typeField.enum).toEqual(['Point', 'LineString', 'Polygon']);

            const coordinates = geometry.fields[1] as TupleArrayField;
            expect(coordinates.type).toBe('array.tuple');
            expect(coordinates.items).toHaveLength(3);
            expect(coordinates.items[0].description).toBe('longitude');
            expect(coordinates.items[1].description).toBe('latitude');
            expect(coordinates.items[2].description).toBe('altitude');
        });
    });

    describe('E-commerce Order Schema', () => {
        it('parses complex order with line items', () => {
            const input = `order: object.required: Order
  orderId: string.required: Order ID
    ^ format: uuid
  customer: object.required: Customer
    customerId: string.required: Customer ID
    name: string.required: Customer name
    email: string.required: Email
      ^ format: email
  lineItems: array.required: Line items
    - object:
      productId: string.required: Product ID
      name: string.required: Product name
      quantity: integer.required: Quantity
        ^ min: 1
      unitPrice: number.required: Unit price
        ^ min: 0
      discount: number: Discount amount
        ^ min: 0
        ^ default: 0
    ^ minItems: 1
  shippingAddress: object.required: Shipping address
    street: string.required: Street
    city: string.required: City
    state: string: State
    country: string.required: Country
    postalCode: string.required: Postal code
  billingAddress: object: Billing address
    street: string.required: Street
    city: string.required: City
    state: string: State
    country: string.required: Country
    postalCode: string.required: Postal code
  totals: object.required: Order totals
    subtotal: number.required: Subtotal
      ^ min: 0
    tax: number.required: Tax amount
      ^ min: 0
    shipping: number.required: Shipping cost
      ^ min: 0
    total: number.required: Total amount
      ^ min: 0
  status: string.required: Order status
    ^ enum: [pending, confirmed, shipped, delivered, cancelled]
    ^ default: pending`;

            const schema = parse(input);

            expect(schema.errors).toBeUndefined();

            const order = schema.fields[0] as ObjectField;
            expect(order.fields).toHaveLength(7); // orderId, customer, lineItems, shippingAddress, billingAddress, totals, status

            // Check lineItems
            const lineItems = order.fields[2] as ArrayField;
            expect(lineItems.required).toBe(true);
            expect(lineItems.minItems).toBe(1);

            const lineItemObject = lineItems.itemType as ObjectField;
            expect(lineItemObject.fields).toHaveLength(5);

            // Check quantity constraints
            const quantityField = lineItemObject.fields[2] as NumberField;
            expect(quantityField.min).toBe(1);

            // Check totals
            const totals = order.fields[5] as ObjectField;
            expect(totals.fields).toHaveLength(4);

            // Check status
            const status = order.fields[6] as StringField;
            expect(status.enum).toEqual(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']);
            expect(status.default).toBe('pending');
        });
    });

    describe('Error handling in complex schemas', () => {
        it('recovers from errors and continues parsing', () => {
            const input = `valid: object: Valid object
  name: string: Name
invalid: unknownType: Bad field
another: object: Another object
  value: number: Value`;

            const schema = parse(input);

            // Should have errors
            expect(schema.errors).toBeDefined();
            expect(schema.errors!.length).toBeGreaterThan(0);

            // But should still parse valid fields
            expect(schema.fields.length).toBeGreaterThanOrEqual(1);
        });
    });
});
