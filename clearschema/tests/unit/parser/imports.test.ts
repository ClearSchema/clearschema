import { parse } from '../../../src/parser/parser';

describe('Parser - Imports', () => {
    it('parses import declaration', () => {
        const input = `import: ./common/types.cs
  - User
  - Address`;

        const schema = parse(input);

        expect(schema.imports).toHaveLength(1);
        expect(schema.imports[0].path).toBe('./common/types.cs');
        expect(schema.imports[0].definitions).toEqual(['User', 'Address']);
        expect(schema.imports[0].resolved).toBe(false);
    });

    it('parses wildcard import', () => {
        const input = `import: ./common/types.cs
  - *`;

        const schema = parse(input);

        expect(schema.imports).toHaveLength(1);
        expect(schema.imports[0].definitions).toEqual(['*']);
    });

    it('parses multiple imports', () => {
        const input = `import: ./common/types.cs
  - User
import: ./models/product.cs
  - Product`;

        const schema = parse(input);

        expect(schema.imports).toHaveLength(2);
        expect(schema.imports[0].path).toBe('./common/types.cs');
        expect(schema.imports[1].path).toBe('./models/product.cs');
    });

    it('parses schema with imports and fields', () => {
        const input = `import: ./common/types.cs
  - User

primaryUser: $ref: User`;

        const schema = parse(input);

        expect(schema.imports).toHaveLength(1);
        expect(schema.fields).toHaveLength(1);
    });
});
