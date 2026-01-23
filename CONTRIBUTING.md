# Contributing to ClearSchema

Thank you for your interest in contributing to ClearSchema! This document provides guidelines for contributing to the project.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/clearschema/clearschema.git
cd clearschema/clearschema

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage

# Build the project
npm run build

# Run the CLI locally
node dist/cli/index.js ../examples/user.cs
```

## Project Structure

```
clearschema/
├── src/
│   ├── ast/           # AST type definitions
│   ├── lexer/         # Lexer (tokenization)
│   ├── parser/        # Parser (AST generation)
│   ├── exporters/     # Export targets (JSON Schema, TypeScript, etc.)
│   ├── cli/           # Command-line interface
│   └── index.ts       # Public API
├── tests/
│   ├── unit/          # Unit tests
│   └── integration/   # Integration tests
├── docs/              # Documentation
└── examples/          # Example schemas
```

## Testing

ClearSchema follows a **TDD (Test-Driven Development)** approach:

1. Write tests first
2. Implement the feature
3. Ensure all tests pass
4. Maintain >90% code coverage

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- primitives.test.ts

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

- Place unit tests in `tests/unit/`
- Place integration tests in `tests/integration/`
- Use descriptive test names
- Follow the existing test structure

Example test:

```typescript
describe('Parser - Primitive Types', () => {
  it('parses string field', () => {
    const schema = parse('name: string: User name');

    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0].type).toBe('string');
    expect(schema.fields[0].description).toBe('User name');
  });
});
```

## Code Style

- Use TypeScript strict mode
- Follow existing code formatting
- Run ESLint: `npm run lint`
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Adding New Features

### 1. New Type Support

To add a new type (e.g., `date`):

1. Update `src/ast/types.ts` with the new type interface
2. Update `src/lexer/lexer.ts` if new tokens are needed
3. Update `src/parser/parser.ts` to parse the new type
4. Update all exporters to handle the new type
5. Add tests for the new type
6. Update documentation

### 2. New Exporter

To add a new exporter (e.g., Pydantic):

1. Create `src/exporters/pydantic.ts`
2. Implement the `Exporter<string>` interface
3. Add export function: `exportPydantic(schema, options)`
4. Update `src/index.ts` to export the new exporter
5. Add comprehensive tests in `tests/unit/exporters/`
6. Update README and documentation

### 3. New CLI Command

To add a new CLI command:

1. Update `src/cli/index.ts` with the new command logic
2. Update help text
3. Test manually with various inputs
4. Update README with new command usage

## Commit Guidelines

We follow conventional commits:

```
feat: add Pydantic exporter
fix: correct tuple array parsing
docs: update README with new examples
test: add tests for union types
refactor: simplify parser error handling
```

### Commit Message Format

```
<type>: <subject>

<body>

Co-Authored-By: Your Name <your.email@example.com>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions or modifications
- `refactor`: Code refactoring
- `chore`: Maintenance tasks

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Add tests
5. Ensure all tests pass: `npm test`
6. Ensure code coverage remains >90%
7. Update documentation
8. Commit with conventional commits
9. Push to your fork
10. Open a Pull Request

### PR Checklist

- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Code coverage >90%
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (if applicable)
- [ ] Commit messages follow conventions
- [ ] No lint errors

## Documentation

When adding features:

1. Update the relevant phase documentation in `docs/phases/`
2. Update README.md with examples
3. Add examples to `examples/` directory
4. Update CHANGELOG.md

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues and documentation first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
