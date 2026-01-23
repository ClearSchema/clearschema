import { parse } from '../../../src/parser/parser';
import { exportPydantic } from '../../../src/exporters/pydantic';

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
  ^ minLength: 2
  ^ maxLength: 100`);
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
