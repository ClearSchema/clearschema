import { parse } from '../../../src/parser/parser';
import { exportPydantic } from '../../../src/exporters/pydantic';
import { Schema, MatchField, ObjectField, RefField } from '../../../src/ast/types';

describe('Pydantic Exporter', () => {
    describe('primitive types', () => {
        it('exports string field', () => {
            const schema = parse('name: string.required: User name');
            const output = exportPydantic(schema);

            expect(output).toContain('name: str');
            expect(output).toContain('from pydantic import BaseModel');
        });

        it('exports optional field', () => {
            const schema = parse('age: integer: Age');
            const output = exportPydantic(schema);

            expect(output).toContain('int');
            expect(output).toContain('None');
        });

        it('exports number as float', () => {
            const schema = parse('price: number.required: Price');
            const output = exportPydantic(schema);

            expect(output).toContain('price: float');
        });

        it('exports boolean field', () => {
            const schema = parse('active: boolean.required: Active');
            const output = exportPydantic(schema);

            expect(output).toContain('active: bool');
        });
    });

    describe('smart type mapping', () => {
        it('exports email format as EmailStr', () => {
            const schema = parse(`email: string.required: Email
  ^ format: email`);
            const output = exportPydantic(schema);

            expect(output).toContain('email: EmailStr');
            expect(output).toContain('from pydantic import EmailStr');
        });

        it('exports uri format as HttpUrl', () => {
            const schema = parse(`website: string: Website
  ^ format: uri`);
            const output = exportPydantic(schema);

            expect(output).toContain('HttpUrl');
        });

        it('exports uuid format as UUID', () => {
            const schema = parse(`id: string.required: ID
  ^ format: uuid`);
            const output = exportPydantic(schema);

            expect(output).toContain('UUID');
        });
    });

    describe('field constraints', () => {
        it('exports string constraints', () => {
            const schema = parse(`name: string.required: Name
  ^ min: 2
  ^ max: 100`);
            const output = exportPydantic(schema);

            expect(output).toContain('min_length=2');
            expect(output).toContain('max_length=100');
        });

        it('exports number constraints', () => {
            const schema = parse(`age: integer.required: Age
  ^ min: 0
  ^ max: 150`);
            const output = exportPydantic(schema);

            expect(output).toContain('ge=0');
            expect(output).toContain('le=150');
        });

        it('exports field description', () => {
            const schema = parse('name: string.required: Full name');
            const output = exportPydantic(schema);

            expect(output).toContain('description="Full name"');
        });

        it('exports default value', () => {
            const schema = parse(`active: boolean: Active status
  ^ default: true`);
            const output = exportPydantic(schema);

            expect(output).toContain('default=true');
        });
    });

    describe('complex types', () => {
        it('exports object as class', () => {
            const schema = parse(`$defs:
  User: object: User schema
    name: string.required: Name
    email: string.required: Email`);
            const output = exportPydantic(schema);

            expect(output).toContain('class User(BaseModel):');
            expect(output).toContain('"""User schema"""');
            expect(output).toContain('name: str');
            expect(output).toContain('email: str');
        });

        it('exports array as List', () => {
            const schema = parse(`tags: array.required: Tags
  - string`);
            const output = exportPydantic(schema);

            expect(output).toContain('List[str]');
            expect(output).toContain('from typing import List');
        });

        it('exports tuple as Tuple', () => {
            const schema = parse(`coords: array.tuple.required: Coordinates
  - number
  - number`);
            const output = exportPydantic(schema);

            expect(output).toContain('Tuple[float, float]');
            expect(output).toContain('from typing import Tuple');
        });
    });

    describe('union types', () => {
        it('exports union type', () => {
            const schema = parse('id: string|number.required: ID');
            const output = exportPydantic(schema);

            expect(output).toContain('Union[str, float]');
            expect(output).toContain('from typing import Union');
        });
    });

    describe('map types', () => {
        it('exports map with string values as Dict[str, str]', () => {
            const schema = parse(`metadata: map.required: Metadata
  - string`);
            const output = exportPydantic(schema);

            expect(output).toContain('Dict[str, str]');
            expect(output).toContain('from typing import Dict');
        });

        it('exports map with float values as Dict[str, float]', () => {
            const schema = parse(`scores: map.required: Scores
  - number`);
            const output = exportPydantic(schema);

            expect(output).toContain('Dict[str, float]');
        });

        it('exports map with object values as Dict[str, dict]', () => {
            const schema = parse(`items: map.required: Items
  - object:`);
            const output = exportPydantic(schema);

            expect(output).toContain('Dict[str, dict]');
        });

        it('exports optional map as Optional[Dict[str, str]]', () => {
            // Construct a schema with an optional map field without description
            // to trigger the Optional wrapping path
            const schema = {
                location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                imports: [],
                definitions: [],
                fields: [
                    {
                        name: 'metadata',
                        type: 'map' as const,
                        description: '',
                        required: false,
                        nullable: false,
                        rawModifiers: {},
                        modifiers: [],
                        valueType: 'string',
                        location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                    }
                ],
            } as any;
            const output = exportPydantic(schema);

            expect(output).toContain('Optional[Dict[str, str]]');
            expect(output).toContain('from typing import Dict');
            expect(output).toContain('from typing import Optional');
        });

        it('exports map defined in $defs as type alias', () => {
            const schema = parse(`$defs:
  Config: map: Configuration
    - string`);
            const output = exportPydantic(schema);

            expect(output).toContain('Config = Dict[str, str]');
            expect(output).toContain('from typing import Dict');
        });

        it('exports map with $ref value as Dict[str, RefClassName]', () => {
            // Construct schema manually since parser doesn't preserve $ref target in map valueType
            const schema = {
                location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                imports: [],
                definitions: [
                    {
                        name: 'Address',
                        field: {
                            name: 'Address',
                            type: 'object' as const,
                            description: 'Address',
                            fields: [
                                { name: 'street', type: 'string' as const, description: '', required: true, nullable: false, rawModifiers: {}, modifiers: [], location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } } }
                            ],
                            required: false,
                            nullable: false,
                            rawModifiers: {},
                            modifiers: [],
                            location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                        },
                        location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                    }
                ],
                fields: [
                    {
                        name: 'addresses',
                        type: 'map' as const,
                        description: 'Addresses',
                        required: true,
                        nullable: false,
                        rawModifiers: {},
                        modifiers: [],
                        valueType: {
                            name: '',
                            type: 'ref' as const,
                            ref: '#/$defs/Address',
                            description: '',
                            required: false,
                            nullable: false,
                            rawModifiers: {},
                            modifiers: [],
                            location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                        },
                        location: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
                    }
                ],
            } as any;
            const output = exportPydantic(schema);

            expect(output).toContain('Dict[str, Address]');
            expect(output).toContain('from typing import Dict');
        });
    });

    describe('match (discriminated union)', () => {
        const loc = { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } };

        function makeObjectVariant(fields: { name: string; type: string; required: boolean; description: string }[]): ObjectField {
            return {
                name: '',
                type: 'object',
                fields: fields.map(f => ({
                    name: f.name,
                    type: f.type as any,
                    description: f.description,
                    required: f.required,
                    nullable: false,
                    rawModifiers: {},
                    modifiers: [],
                    location: loc,
                })),
                description: '',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            };
        }

        function makeMatchField(discriminator: string, variants: Record<string, ObjectField | RefField>, description = ''): MatchField {
            return {
                name: 'event',
                type: 'match',
                discriminator,
                variants,
                description,
                required: true,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            };
        }

        function makeSchema(field: MatchField): Schema {
            return {
                fields: [field],
                definitions: [],
                imports: [],
                location: loc,
            } as any;
        }

        it('exports 2 inline variants as model classes with Literal type and Annotated union', () => {
            const matchField = makeMatchField('kind', {
                created: makeObjectVariant([
                    { name: 'createdAt', type: 'string', required: false, description: 'Timestamp' },
                ]),
                deleted: makeObjectVariant([
                    { name: 'deletedAt', type: 'string', required: false, description: 'Timestamp' },
                ]),
            });

            const output = exportPydantic(makeSchema(matchField));

            // Should have variant model classes
            expect(output).toContain('class CreatedVariant(BaseModel):');
            expect(output).toContain("kind: Literal['created']");
            expect(output).toContain('createdAt: Optional[str] = None');
            expect(output).toContain('class DeletedVariant(BaseModel):');
            expect(output).toContain("kind: Literal['deleted']");
            expect(output).toContain('deletedAt: Optional[str] = None');

            // Should have Annotated union with Discriminator
            expect(output).toContain("Annotated[CreatedVariant | DeletedVariant, Discriminator('kind')]");

            // Should have correct imports
            expect(output).toContain('from typing import Annotated, Literal');
            expect(output).toContain('from pydantic import Discriminator');
        });

        it('converts kebab-case and snake_case variant keys to PascalCase class names (Fix #3)', () => {
            const matchField = makeMatchField('method', {
                'credit-card': makeObjectVariant([
                    { name: 'cardNumber', type: 'string', required: true, description: 'Card number' },
                ]),
                'bank_transfer': makeObjectVariant([
                    { name: 'accountId', type: 'string', required: true, description: 'Account ID' },
                ]),
            });

            const output = exportPydantic(makeSchema(matchField));

            // Should produce valid PascalCase Python class names
            expect(output).toContain('class CreditCardVariant(BaseModel):');
            expect(output).toContain('class BankTransferVariant(BaseModel):');
            // Should NOT contain hyphenated or snake_case class names
            expect(output).not.toContain('class credit-cardVariant');
            expect(output).not.toContain('class bank_transferVariant');
        });

        it('exports $ref variant using ref name in union', () => {
            const refVariant: RefField = {
                name: '',
                type: 'ref',
                ref: '#/$defs/ExternalEvent',
                description: '',
                required: false,
                nullable: false,
                rawModifiers: {},
                modifiers: [],
                location: loc,
            };

            const matchField = makeMatchField('type', {
                inline: makeObjectVariant([
                    { name: 'data', type: 'string', required: true, description: 'Data' },
                ]),
                external: refVariant,
            });

            const output = exportPydantic(makeSchema(matchField));

            // Should have the inline variant class
            expect(output).toContain('class InlineVariant(BaseModel):');
            expect(output).toContain("type: Literal['inline']");

            // Should have Annotated union with ref name
            expect(output).toContain("Annotated[InlineVariant | ExternalEvent, Discriminator('type')]");
        });
    });

    describe('references', () => {
        it('exports references', () => {
            const schema = parse(`$defs:
  User: object: User
    name: string: Name

user: $ref: #/$defs/User`);
            const output = exportPydantic(schema);

            expect(output).toContain('class User(BaseModel):');
            expect(output).toContain('user: User');
        });
    });
});
