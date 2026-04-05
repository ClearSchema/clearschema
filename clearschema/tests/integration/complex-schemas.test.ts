import { parse } from '../../src';
import { exportJsonSchema } from '../../src/exporters/json-schema';
import { exportTypeScript } from '../../src/exporters/typescript';
import { exportPydantic } from '../../src/exporters/pydantic';
import { exportOpenAPI } from '../../src/exporters/openapi';
import { exportLlmSchema } from '../../src/exporters/llm-structured-output';
import { exportZod } from '../../src/exporters/zod';
import { ObjectField, ArrayField, StringField, NumberField, TupleArrayField, MapField } from '../../src/ast/types';

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

    describe('Schema with Map Fields', () => {
        const input = `service: object.required: Service definition
  name: string.required: Service name
  metadata: map: Key-value metadata
    - string
  tags: array: Tag sets
    - map:
      - string
  labels: map.nullable: Optional labels
    - string`;

        it('parses map fields into correct AST', () => {
            const schema = parse(input);
            expect(schema.errors).toBeUndefined();

            const service = schema.fields[0] as ObjectField;
            expect(service.fields).toHaveLength(4);

            const metadata = service.fields[1] as MapField;
            expect(metadata.type).toBe('map');
            expect(metadata.valueType).toBe('string');

            const tags = service.fields[2] as ArrayField;
            expect(tags.type).toBe('array');
            expect((tags.itemType as MapField).type).toBe('map');

            const labels = service.fields[3] as MapField;
            expect(labels.type).toBe('map');
            expect(labels.nullable).toBe(true);
        });

        it('exports correct JSON Schema for maps', () => {
            const schema = parse(input);
            const jsonSchema = exportJsonSchema(schema);

            const serviceSchema = jsonSchema.properties!.service as any;
            const metadataSchema = serviceSchema.properties.metadata;
            expect(metadataSchema.type).toBe('object');
            expect(metadataSchema.additionalProperties).toEqual({ type: 'string' });

            // Array of maps
            const tagsSchema = serviceSchema.properties.tags;
            expect(tagsSchema.type).toBe('array');
            expect(tagsSchema.items.type).toBe('object');
            expect(tagsSchema.items.additionalProperties).toEqual({ type: 'string' });

            // Nullable map
            const labelsSchema = serviceSchema.properties.labels;
            expect(labelsSchema.anyOf).toBeDefined();
        });

        it('exports correct TypeScript for maps', () => {
            const schema = parse(input);
            const ts = exportTypeScript(schema);

            expect(ts).toContain('Record<string, string>');
        });

        it('exports correct Pydantic for maps', () => {
            const schema = parse(input);
            const py = exportPydantic(schema);

            // Pydantic export should produce valid Python output
            expect(py).toContain('service');
            expect(py).toContain('BaseModel');
        });

        it('exports correct OpenAPI for maps', () => {
            const schema = parse(input);
            const openapi = exportOpenAPI(schema);

            const rootSchema = openapi.components.schemas.RootSchema;
            expect(rootSchema).toBeDefined();
            expect(rootSchema.properties.service.properties.metadata.additionalProperties).toEqual({ type: 'string' });
        });

        it('exports correct Zod for maps', () => {
            const schema = parse(input);
            const zod = exportZod(schema);

            expect(zod).toContain("import { z } from 'zod';");
            expect(zod).toContain('z.record(z.string(), z.string())');
            // Nullable map
            expect(zod).toContain('.nullable()');
        });

        it('exports LLM schema with map fields omitted', () => {
            const schema = parse(input);
            const result = exportLlmSchema(schema);

            // Map fields should be omitted from LLM output
            const llmSchema = result.schema;
            const serviceProps = llmSchema.properties?.service?.properties;
            expect(serviceProps).toBeDefined();
            expect(serviceProps.name).toBeDefined();
            // Map fields should not be present
            expect(serviceProps.metadata).toBeUndefined();
            expect(serviceProps.labels).toBeUndefined();
            // Array of maps should also be omitted
            expect(serviceProps.tags).toBeUndefined();
            // Warnings should be present
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('Zod Exporter Integration', () => {
        it('exports realistic multi-type schema', () => {
            const input = `$defs:
  Address: object: Address
    street: string.required: Street address
    city: string.required: City
    country: string.required: Country
      ^ enum: [US, CA, UK]

user: object.required: User profile
  id: string.required: User ID
    ^ format: uuid
  name: string.required: Full name
    ^ minLength: 1
    ^ maxLength: 100
  email: string.required: Email
    ^ format: email
  age: integer: Age
    ^ min: 0
    ^ max: 150
  tags: array: Tags
    - string
  address: $ref: #/$defs/Address
  status: string.required: Status
    ^ enum: [active, inactive]
    ^ default: active`;

            const schema = parse(input);
            const output = exportZod(schema);

            // Import
            expect(output).toContain("import { z } from 'zod';");

            // Definition
            expect(output).toContain('export const AddressSchema = z.object(');
            expect(output).toContain('z.enum(["US", "CA", "UK"])');

            // Root schema
            expect(output).toContain('export const Schema = z.object(');

            // Field types
            expect(output).toContain('z.string().uuid()');
            expect(output).toContain('z.string().min(1).max(100)');
            expect(output).toContain('z.string().email()');
            expect(output).toContain('z.number().int().min(0).max(150)');
            expect(output).toContain('z.array(z.string())');
            expect(output).toContain('AddressSchema');
            expect(output).toContain('z.enum(["active", "inactive"])');
            expect(output).toContain('.default("active")');
        });

        it('exports schema with $defs and cross-references', () => {
            const input = `$defs:
  PhoneNumber: object: Phone number
    countryCode: string.required: Country code
    number: string.required: Number
  ContactInfo: object: Contact info
    email: string.required: Email
      ^ format: email
    phones: array: Phone numbers
      - $ref: #/$defs/PhoneNumber

contact: $ref: #/$defs/ContactInfo`;

            const schema = parse(input);
            const output = exportZod(schema);

            expect(output).toContain('export const PhoneNumberSchema = z.object(');
            expect(output).toContain('export const ContactInfoSchema = z.object(');
            expect(output).toContain('PhoneNumberSchema');
            expect(output).toContain('ContactInfoSchema');
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
