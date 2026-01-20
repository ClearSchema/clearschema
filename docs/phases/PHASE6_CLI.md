# Phase 6: CLI & Tooling

**Goal:** CLI, validation, documentation.

**Portfolio Value:** Shows developer tooling skills

---

## Deliverables

- [ ] CLI tool for parsing and export
- [ ] Schema validation command
- [ ] Format conversion commands
- [ ] Watch mode for development
- [ ] Optional target declaration with linting
- [ ] Comprehensive CLI documentation
- [ ] npm package publication

---

## CLI Design

### Command Structure

```bash
clearschema [command] [options]

Commands:
  parse <file>       Parse a ClearSchema file and output AST
  export <file>      Export to target format (default: json-schema)
  validate <file>    Validate a ClearSchema file
  lint <file>        Check for issues and best practices
  format <file>      Format a ClearSchema file
  init               Create a new ClearSchema project

Options:
  -o, --output       Output file (default: stdout)
  -t, --target       Export target: json-schema, typescript, pydantic, openapi
  -w, --watch        Watch mode - re-run on file changes
  --json             Output as JSON (for parse command)
  --version          Show version
  --help             Show help
```

### Example Usage

```bash
# Parse and see AST
clearschema parse schema.cs --json

# Export to JSON Schema
clearschema export schema.cs -t json-schema -o schema.json

# Export to TypeScript
clearschema export schema.cs -t typescript -o types.ts

# Export to Pydantic
clearschema export schema.cs -t pydantic -o models.py

# Validate schema
clearschema validate schema.cs

# Watch mode
clearschema export schema.cs -t json-schema -o schema.json --watch

# Lint for issues
clearschema lint schema.cs
```

---

## Implementation Guidance

### CLI Framework

Use `commander` or `yargs` for argument parsing:

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { parse } from '../parser/parser';
import { exportJsonSchema } from '../exporters/json-schema';
import { exportTypeScript } from '../exporters/typescript';
import { exportPydantic } from '../exporters/pydantic';

const program = new Command();

program
  .name('clearschema')
  .description('Human-readable schema definition language')
  .version('1.0.0');

program
  .command('export <file>')
  .description('Export schema to target format')
  .option('-t, --target <format>', 'Export format', 'json-schema')
  .option('-o, --output <file>', 'Output file')
  .option('-w, --watch', 'Watch for changes')
  .action(async (file, options) => {
    await handleExport(file, options);
  });

program.parse();
```

### Export Handler

```typescript
async function handleExport(file: string, options: ExportOptions) {
  const input = await fs.readFile(file, 'utf-8');
  const schema = parse(input);

  let output: string;
  switch (options.target) {
    case 'json-schema':
      output = JSON.stringify(exportJsonSchema(schema), null, 2);
      break;
    case 'typescript':
      output = exportTypeScript(schema);
      break;
    case 'pydantic':
      output = exportPydantic(schema);
      break;
    default:
      throw new Error(`Unknown target: ${options.target}`);
  }

  if (options.output) {
    await fs.writeFile(options.output, output);
    console.log(`Written to ${options.output}`);
  } else {
    console.log(output);
  }
}
```

### Watch Mode

```typescript
import chokidar from 'chokidar';

async function handleExportWatch(file: string, options: ExportOptions) {
  // Initial export
  await handleExport(file, options);

  // Watch for changes
  const watcher = chokidar.watch(file);
  watcher.on('change', async () => {
    console.log(`\nFile changed, re-exporting...`);
    try {
      await handleExport(file, options);
    } catch (error) {
      console.error('Export failed:', error.message);
    }
  });

  console.log(`Watching ${file} for changes...`);
}
```

### Validation Command

```typescript
program
  .command('validate <file>')
  .description('Validate a ClearSchema file')
  .action(async (file) => {
    try {
      const input = await fs.readFile(file, 'utf-8');
      const schema = parse(input);

      if (schema.errors && schema.errors.length > 0) {
        console.log(`Found ${schema.errors.length} error(s):\n`);
        for (const error of schema.errors) {
          console.log(error.format());
        }
        process.exit(1);
      }

      console.log('✓ Schema is valid');
    } catch (error) {
      console.error('Validation failed:', error.message);
      process.exit(1);
    }
  });
```

### Lint Command

```typescript
interface LintResult {
  level: 'error' | 'warning' | 'info';
  message: string;
  location: SourceLocation;
  rule: string;
}

const lintRules = [
  // Warn about missing descriptions
  (schema: Schema): LintResult[] => {
    const results: LintResult[] = [];
    for (const field of schema.fields) {
      if (!field.description) {
        results.push({
          level: 'warning',
          message: `Field '${field.name}' is missing a description`,
          location: field.location,
          rule: 'require-description'
        });
      }
    }
    return results;
  },
  // ... more rules
];
```

---

## Package Configuration

### package.json

```json
{
  "name": "clearschema",
  "version": "1.0.0",
  "description": "Human-readable schema definition language",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "clearschema": "dist/cli/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": [
    "schema",
    "json-schema",
    "typescript",
    "pydantic",
    "codegen",
    "validation"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/username/clearschema"
  },
  "license": "MIT",
  "engines": {
    "node": ">=16"
  }
}
```

### npm Publishing

```bash
# Build and test
npm run build
npm test

# Publish
npm publish
```

---

## Test Specifications

### CLI Tests

```typescript
describe('CLI', () => {
  it('exports to JSON Schema', async () => {
    const result = await exec('clearschema export fixtures/user.cs -t json-schema');

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveProperty('$schema');
  });

  it('validates valid schema', async () => {
    const result = await exec('clearschema validate fixtures/valid.cs');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('valid');
  });

  it('reports validation errors', async () => {
    const result = await exec('clearschema validate fixtures/invalid.cs');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('error');
  });

  it('outputs to file with -o', async () => {
    await exec('clearschema export fixtures/user.cs -o output.json');

    const output = await fs.readFile('output.json', 'utf-8');
    expect(JSON.parse(output)).toHaveProperty('$schema');
  });
});
```

---

## Acceptance Criteria

- [ ] CLI installs globally via npm
- [ ] `clearschema export` works with all targets
- [ ] `clearschema validate` reports errors clearly
- [ ] `clearschema lint` catches common issues
- [ ] Watch mode works reliably
- [ ] Exit codes are correct (0 for success, 1 for errors)
- [ ] Help text is comprehensive
- [ ] npm package publishes successfully
- [ ] All tests pass
