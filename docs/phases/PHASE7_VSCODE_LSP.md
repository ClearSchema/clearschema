# Phase 7: VS Code Extension & LSP

**Goal:** First-class editor support for real-world usability.

**Portfolio Value:** Table stakes for adoption

---

## Deliverables

- [ ] TextMate grammar for syntax highlighting (~100 lines)
- [ ] Basic VS Code extension scaffolding
- [ ] LSP server implementation:
  - [ ] Diagnostics (real-time error reporting)
  - [ ] Autocomplete for types (`string`, `number`, `object`, etc.)
  - [ ] Autocomplete for modifiers (`minLength`, `format`, etc.)
  - [ ] Hover documentation for types and modifiers
  - [ ] Go to definition for `$ref` references
  - [ ] Document symbols (outline view)
- [ ] VS Code marketplace publishing
- [ ] Extension README and screenshots

**Note:** VS Code extension will be a separate repo. Keep core package simple.

**Estimated Scope:** ~1500-2000 lines for full LSP

---

## TextMate Grammar

### Syntax Highlighting Rules

```json
{
  "name": "ClearSchema",
  "scopeName": "source.clearschema",
  "fileTypes": ["cs"],
  "patterns": [
    {
      "name": "comment.line.number-sign.clearschema",
      "match": "#.*$"
    },
    {
      "name": "keyword.control.clearschema",
      "match": "\\b(namespace|version|targets|import|\\$defs)\\b:"
    },
    {
      "name": "storage.type.clearschema",
      "match": "\\b(string|number|integer|boolean|null|object|array|array\\.tuple)\\b"
    },
    {
      "name": "storage.modifier.clearschema",
      "match": "\\.(required|nullable)\\b"
    },
    {
      "name": "keyword.operator.modifier.clearschema",
      "match": "^\\s*\\^"
    },
    {
      "name": "variable.other.reference.clearschema",
      "match": "\\$ref:\\s*[#/\\w]+"
    },
    {
      "name": "string.quoted.double.clearschema",
      "begin": "\"",
      "end": "\""
    },
    {
      "name": "constant.numeric.clearschema",
      "match": "\\b-?\\d+(\\.\\d+)?\\b"
    },
    {
      "name": "constant.language.clearschema",
      "match": "\\b(true|false|null)\\b"
    }
  ]
}
```

---

## VS Code Extension Structure

```
clearschema-vscode/
├── package.json           # Extension manifest
├── syntaxes/
│   └── clearschema.tmLanguage.json
├── language-configuration.json
├── src/
│   ├── extension.ts       # Extension entry point
│   └── server/
│       ├── server.ts      # LSP server
│       ├── diagnostics.ts # Error reporting
│       ├── completion.ts  # Autocomplete
│       ├── hover.ts       # Hover documentation
│       └── symbols.ts     # Document symbols
├── client/
│   └── src/
│       └── extension.ts   # LSP client
└── README.md
```

---

## LSP Server Implementation

### Server Setup

```typescript
// server/server.ts
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeResult,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: ['.', '^', ':', ' ']
      },
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
    }
  };
});

documents.onDidChangeContent(change => {
  validateDocument(change.document);
});

documents.listen(connection);
connection.listen();
```

### Diagnostics (Real-time Error Reporting)

```typescript
// server/diagnostics.ts
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { parse, ParseError } from 'clearschema';

export function validateDocument(document: TextDocument): Diagnostic[] {
  const text = document.getText();
  const diagnostics: Diagnostic[] = [];

  try {
    const schema = parse(text);

    if (schema.errors) {
      for (const error of schema.errors) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: error.location.start.line - 1, character: error.location.start.column - 1 },
            end: { line: error.location.end.line - 1, character: error.location.end.column - 1 }
          },
          message: error.message,
          source: 'clearschema'
        });
      }
    }
  } catch (error) {
    if (error instanceof ParseError) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: error.location.start.line - 1, character: error.location.start.column - 1 },
          end: { line: error.location.end.line - 1, character: error.location.end.column - 1 }
        },
        message: error.message,
        source: 'clearschema'
      });
    }
  }

  return diagnostics;
}
```

### Autocomplete

```typescript
// server/completion.ts
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';

const typeCompletions: CompletionItem[] = [
  { label: 'string', kind: CompletionItemKind.TypeParameter, detail: 'Text value' },
  { label: 'number', kind: CompletionItemKind.TypeParameter, detail: 'Numeric value (float)' },
  { label: 'integer', kind: CompletionItemKind.TypeParameter, detail: 'Whole number' },
  { label: 'boolean', kind: CompletionItemKind.TypeParameter, detail: 'True/false' },
  { label: 'null', kind: CompletionItemKind.TypeParameter, detail: 'Null value' },
  { label: 'object', kind: CompletionItemKind.TypeParameter, detail: 'Nested structure' },
  { label: 'array', kind: CompletionItemKind.TypeParameter, detail: 'Collection of items' },
  { label: 'array.tuple', kind: CompletionItemKind.TypeParameter, detail: 'Fixed-length array' },
];

const stringModifiers: CompletionItem[] = [
  { label: 'minLength', kind: CompletionItemKind.Property, detail: 'Minimum string length' },
  { label: 'maxLength', kind: CompletionItemKind.Property, detail: 'Maximum string length' },
  { label: 'pattern', kind: CompletionItemKind.Property, detail: 'Regex pattern' },
  { label: 'format', kind: CompletionItemKind.Property, detail: 'Format (email, uri, etc.)' },
];

const numberModifiers: CompletionItem[] = [
  { label: 'min', kind: CompletionItemKind.Property, detail: 'Minimum value' },
  { label: 'max', kind: CompletionItemKind.Property, detail: 'Maximum value' },
  { label: 'exclusiveMin', kind: CompletionItemKind.Property, detail: 'Exclusive minimum' },
  { label: 'exclusiveMax', kind: CompletionItemKind.Property, detail: 'Exclusive maximum' },
  { label: 'multipleOf', kind: CompletionItemKind.Property, detail: 'Must be multiple of' },
];

export function getCompletions(context: CompletionContext): CompletionItem[] {
  // Determine context and return appropriate completions
  if (context.isAfterColon && !context.hasType) {
    return typeCompletions;
  }
  if (context.isModifierLine) {
    if (context.fieldType === 'string') return stringModifiers;
    if (context.fieldType === 'number' || context.fieldType === 'integer') return numberModifiers;
    // ... more
  }
  return [];
}
```

### Hover Documentation

```typescript
// server/hover.ts
import { Hover, MarkupContent, MarkupKind } from 'vscode-languageserver/node';

const typeDocumentation: Record<string, string> = {
  string: `**string**\n\nText value.\n\n**Modifiers:**\n- minLength\n- maxLength\n- pattern\n- format`,
  number: `**number**\n\nNumeric value (integer or float).\n\n**Modifiers:**\n- min\n- max\n- exclusiveMin\n- exclusiveMax\n- multipleOf`,
  // ... more
};

const modifierDocumentation: Record<string, string> = {
  minLength: `**minLength**\n\nMinimum string length.\n\n**Example:**\n\`\`\`yaml\nname: string: Name\n  ^ minLength: 2\n\`\`\``,
  format: `**format**\n\nString format validation.\n\n**Supported:** email, uri, uuid, date-time, date, time, ipv4, ipv6, hostname`,
  // ... more
};

export function getHover(word: string): Hover | null {
  const doc = typeDocumentation[word] || modifierDocumentation[word];
  if (doc) {
    return {
      contents: { kind: MarkupKind.Markdown, value: doc }
    };
  }
  return null;
}
```

### Go to Definition

```typescript
// server/definition.ts
import { Definition, Location } from 'vscode-languageserver/node';

export function getDefinition(document: TextDocument, position: Position): Definition | null {
  const text = document.getText();
  const schema = parse(text);

  // Find word at position
  const word = getWordAtPosition(text, position);

  // Check if it's a $ref reference
  if (isRefAtPosition(text, position)) {
    const refPath = extractRefPath(text, position);

    // Find definition in $defs
    const def = schema.definitions.find(d => refPath.endsWith(d.name));
    if (def) {
      return Location.create(document.uri, {
        start: { line: def.location.start.line - 1, character: 0 },
        end: { line: def.location.end.line - 1, character: 0 }
      });
    }
  }

  return null;
}
```

### Document Symbols (Outline)

```typescript
// server/symbols.ts
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node';

export function getDocumentSymbols(document: TextDocument): DocumentSymbol[] {
  const text = document.getText();
  const schema = parse(text);
  const symbols: DocumentSymbol[] = [];

  // Add definitions
  for (const def of schema.definitions) {
    symbols.push({
      name: def.name,
      kind: SymbolKind.Class,
      range: locationToRange(def.location),
      selectionRange: locationToRange(def.location),
      children: getFieldSymbols(def.field)
    });
  }

  // Add top-level fields
  for (const field of schema.fields) {
    symbols.push(fieldToSymbol(field));
  }

  return symbols;
}

function fieldToSymbol(field: Field): DocumentSymbol {
  return {
    name: field.name,
    kind: fieldKind(field.type),
    detail: field.type,
    range: locationToRange(field.location),
    selectionRange: locationToRange(field.location),
    children: field.type === 'object' ? getFieldSymbols(field) : undefined
  };
}
```

---

## Extension Manifest

```json
{
  "name": "clearschema",
  "displayName": "ClearSchema",
  "description": "Language support for ClearSchema schema definition files",
  "version": "1.0.0",
  "publisher": "clearschema",
  "engines": {
    "vscode": "^1.75.0"
  },
  "categories": ["Programming Languages"],
  "activationEvents": [
    "onLanguage:clearschema"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "languages": [{
      "id": "clearschema",
      "aliases": ["ClearSchema", "clearschema"],
      "extensions": [".cs"],
      "configuration": "./language-configuration.json"
    }],
    "grammars": [{
      "language": "clearschema",
      "scopeName": "source.clearschema",
      "path": "./syntaxes/clearschema.tmLanguage.json"
    }]
  }
}
```

---

## Acceptance Criteria

- [ ] Syntax highlighting works for all ClearSchema constructs
- [ ] Real-time error diagnostics appear as you type
- [ ] Autocomplete suggests types after `:`
- [ ] Autocomplete suggests modifiers after `^`
- [ ] Hover shows documentation for types and modifiers
- [ ] Go to definition works for `$ref` references
- [ ] Outline view shows document structure
- [ ] Extension publishes to VS Code marketplace
- [ ] Extension has good README with screenshots

---

## Future Enhancements

- Code actions (quick fixes)
- Rename symbol support
- Find all references
- Format document
- Code snippets
- Multi-file workspace support
