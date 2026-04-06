---
title: "feat: Browser playground at clearschema.dev"
type: feat
status: completed
date: 2026-04-04
origin: docs/brainstorms/2026-04-04-browser-playground-requirements.md
---

# feat: Browser playground at clearschema.dev

## Overview

Build a browser-based playground at clearschema.dev where users can write ClearSchema DSL and see live output in all 5 export formats. Hosted on GitHub Pages, no backend, shareable via URL hash. The parser and all exporters run natively in the browser.

## Problem Frame

ClearSchema v0.3.0 is live on npm but has zero discoverability. A playground lets anyone try the DSL in seconds without installing anything. The zero-dep, pure-TypeScript architecture makes this uniquely cheap to build. (see origin: `docs/brainstorms/2026-04-04-browser-playground-requirements.md`)

## Requirements Trace

- R1. Single-page web app at clearschema.dev via GitHub Pages
- R2. Left panel: ClearSchema editor with syntax highlighting
- R3. Right panel: live output, debounced on keystrokes
- R4. Format selector for all 5 formats (JSON Schema, TypeScript, Pydantic, OpenAPI, LLM Schema)
- R5. Syntax-highlighted output per format
- R6. Parse errors in a visible error panel with line/column/message
- R6a. Warning for import statements (unsupported in browser)
- R7. URL hash encoding of editor content + format
- R8. Share button copies URL to clipboard
- R9. URL hash restores state on load
- R10. Examples dropdown with 5 existing example files
- R11. Selecting example replaces editor and updates hash
- R12. Default example (user.clear) on first visit
- R13. Minimal header: project name, GitHub link, npm command, examples dropdown
- R14. Responsive: side-by-side on desktop, stacked on tablet, not broken on mobile

## Scope Boundaries

- No backend or server-side processing
- No user accounts or persistence beyond URL sharing
- No LSP features — just syntax highlighting
- No mobile-specific layout
- No custom themes or settings

## Context & Research

### Relevant Code and Patterns

- **Public API**: `clearschema/src/index.ts` exports `parse`, `exportJsonSchema`, `exportTypeScript`, `exportPydantic`, `exportOpenAPI`, `exportLlmSchema`, plus `ParseError` and all AST types
- **TextMate grammar**: `vscode-clearschema/syntaxes/clearschema.tmLanguage.json` — complete grammar for ClearSchema syntax (comments, directives, imports, fields, modifiers, types)
- **Example files** (all confirmed present): `examples/user.clear` (529B), `examples/ecommerce.clear` (1619B), `examples/llm-tool-definition.clear` (489B), `examples/llm-structured-response.clear` (575B), `examples/llm-agent-output.clear` (720B)
- **fs/promises caveat**: `resolver/resolver.ts` has `defaultFileLoader` with dynamic `import('fs/promises')`. Playground must not trigger this — import only specific functions, not the barrel, or configure bundler to stub `fs`

### External References

- **CodeMirror 6**: Modular editor, ~40-45KB gzipped. Built-in language support for JSON, TypeScript, Python, YAML. Custom highlighting via Lezer grammars or StreamLanguage
- **lz-string**: ~5KB, `compressToEncodedURIComponent()`/`decompressFromEncodedURIComponent()` — industry standard for playground URL sharing (TypeScript Playground, Svelte REPL, Babel REPL)
- **Vite 8**: `vanilla-ts` template, zero-config TypeScript, tree-shaking via Rolldown

## Key Technical Decisions

- **Editor: CodeMirror 6** — Purpose-built for custom DSLs, modular (~40KB gzipped vs Monaco ~500KB+), built-in read-only mode. Use for both input and output panels (one dependency, consistent styling)
- **ClearSchema highlighting: CodeMirror StreamLanguage** — Write a simple regex-based highlighting mode for ClearSchema (comments, directives, types, modifiers, field names). Faster to build than a full Lezer grammar; sufficient for v1. The TextMate grammar at `vscode-clearschema/syntaxes/clearschema.tmLanguage.json` serves as the reference for token categories
- **Output highlighting: CodeMirror language packages** — `@codemirror/lang-json` for JSON Schema/OpenAPI/LLM Schema output, `@codemirror/lang-javascript` for TypeScript, `@codemirror/lang-python` for Pydantic. No YAML package needed (OpenAPI outputs JSON)
- **URL encoding: lz-string** — `compressToEncodedURIComponent()` for hash encoding. Handles schemas up to ~10KB before URL limits become an issue. Graceful fallback: if decompression fails on load, show the default example
- **Build: Vite vanilla-ts** — No framework needed for a two-panel SPA. Tree-shaking excludes unused ClearSchema internals
- **Layout: CSS Grid** — Two-column grid for desktop, single column for tablet/mobile via media query. No split-pane library needed for v1
- **Debounce: 300ms** — Standard for live compilation. Format switching re-exports immediately (no debounce)
- **Browser import strategy**: Import specific functions (`parse`, `exportJsonSchema`, etc.) rather than the barrel `@clearschema/core`. Additionally, configure Vite to stub Node built-ins: `resolve: { alias: { 'fs/promises': false, 'fs': false, 'path': false } }` as a safety net in case tree-shaking doesn't eliminate the dynamic `import('fs/promises')` in resolver.ts. Verify the build runs error-free in browser during Unit 1

## Open Questions

### Resolved During Planning

- **Editor component**: CodeMirror 6 (see Key Technical Decisions)
- **Output highlighting**: CodeMirror language packages for JSON, TypeScript, Python
- **URL encoding**: lz-string compressToEncodedURIComponent
- **Build tooling**: Vite vanilla-ts
- **Layout**: CSS Grid with media query breakpoint
- **Example files**: All 5 confirmed present in examples/

### Deferred to Implementation

- **Exact CodeMirror theme**: Use a dark theme (e.g., `oneDark`) or light theme — determine by visual testing
- **ClearSchema StreamLanguage token rules**: The exact regex patterns for highlighting — reference the TextMate grammar but implement as CodeMirror StreamLanguage
- **fs/promises bundling**: Whether Vite tree-shakes the dynamic import or needs explicit stub configuration — verify during build setup
- **CNAME file**: GitHub Pages custom domain requires a `CNAME` file in the build output — verify the Vite build includes it

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────┐
│  Header: Logo | Examples ▾ | Share | GitHub | npm│
├────────────────────┬────────────────────────────┤
│                    │  Format: [JSON][TS][Py]... │
│  CodeMirror 6      │                            │
│  (editable)        │  CodeMirror 6              │
│                    │  (read-only)               │
│  ClearSchema DSL   │  Exported output           │
│  input             │  (syntax highlighted)      │
│                    │                            │
├────────────────────┴────────────────────────────┤
│  Error panel (collapsible, shows parse errors)  │
└─────────────────────────────────────────────────┘

Data flow:
  User types → 300ms debounce → parse(input)
    → if errors: show in error panel
    → if success: export(schema, selectedFormat) → update output panel
  User switches format → immediate re-export (no debounce)
  User clicks Share → lz-string compress → copy URL to clipboard
  Page loads with hash → lz-string decompress → restore editor + format
```

## Implementation Units

- [ ] **Unit 1: Project Scaffold and Build Pipeline**

**Goal:** Set up the playground directory with Vite, install dependencies, configure build for GitHub Pages deployment.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `playground/package.json`
- Create: `playground/index.html`
- Create: `playground/src/main.ts`
- Create: `playground/vite.config.ts`
- Create: `playground/tsconfig.json`
- Create: `.github/workflows/deploy-playground.yml`

**Approach:**
- Initialize with Vite vanilla-ts template structure in a `playground/` directory at the repo root
- Dependencies: `@clearschema/core` (the published npm package), `codemirror`, `@codemirror/lang-json`, `@codemirror/lang-javascript`, `@codemirror/lang-python`, `lz-string`
- Vite config: set `base: '/'` for custom domain, configure build output to `playground/dist/`
- GitHub Actions workflow: on push to main (when playground/ changes), build and deploy to GitHub Pages. Use `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`
- Create `playground/public/CNAME` containing `clearschema.dev` (Vite copies public/ contents to dist/ at build time)
- Verify the build works and tree-shakes correctly (no `fs` errors)

**Test expectation:** None — pure scaffolding. Verified by successful `npm run build`.

**Verification:**
- `cd playground && npm run build` produces a `dist/` directory with index.html and JS bundle
- Bundle size is under 200KB gzipped (CodeMirror + ClearSchema + lz-string)
- No `fs` or `path` errors during build

---

- [ ] **Unit 2: Editor Panel with ClearSchema Highlighting**

**Goal:** Implement the left panel with a CodeMirror 6 editor and custom ClearSchema syntax highlighting.

**Requirements:** R2, R6, R6a

**Dependencies:** Unit 1

**Files:**
- Create: `playground/src/editor.ts`
- Create: `playground/src/clearschema-lang.ts`
- Modify: `playground/src/main.ts`
- Modify: `playground/index.html`

**Approach:**
- Create a CodeMirror 6 editor instance with basic setup (line numbers, bracket matching, active line highlighting)
- Write a ClearSchema StreamLanguage definition in `clearschema-lang.ts` — reference `vscode-clearschema/syntaxes/clearschema.tmLanguage.json` for token categories: comments (`#`), directives (`@namespace`, `@version`, `@targets`), `$defs`, `import:`, field names, types (`string`, `number`, `integer`, `boolean`, `null`, `object`, `array`), modifiers (`.required`, `.nullable`), block modifiers (`^`), `$ref`
- Wire the editor's `onChange` to call `parse()` from `@clearschema/core`
- If `parse()` returns errors, display them in an error panel below the editor (line, column, message)
- If the parsed schema contains import declarations (check `schema.imports` array), show a warning banner: "Import statements are not supported in the browser playground"
- Export a function to get/set editor content programmatically (needed for examples and URL restore)

**Patterns to follow:**
- `vscode-clearschema/syntaxes/clearschema.tmLanguage.json` — token categories and patterns

**Test scenarios:**
- Happy path: Typing valid ClearSchema → no errors shown, parse result available
- Happy path: ClearSchema keywords (string, object, $defs, @namespace) are highlighted with distinct colors
- Error path: Typing invalid syntax → error panel shows line number, column, and message
- Error path: Schema with `import:` statement → warning banner displayed
- Edge case: Empty editor → no errors, no output (or placeholder message)
- Edge case: Whitespace-only input → treated as empty, no crash

**Verification:**
- Editor renders with syntax highlighting
- Typing produces parse results accessible to the output panel
- Parse errors display with line/column/message
- Import warning appears when applicable

---

- [ ] **Unit 3: Output Panel with Format Tabs**

**Goal:** Implement the right panel with format tabs and live syntax-highlighted export output.

**Requirements:** R3, R4, R5

**Dependencies:** Unit 2

**Files:**
- Create: `playground/src/output.ts`
- Modify: `playground/src/main.ts`

**Approach:**
- Create format tabs (JSON Schema, TypeScript, Pydantic, OpenAPI, LLM Schema) as a tab bar above the output panel
- Output panel is a CodeMirror 6 instance in read-only mode
- When the active format changes, swap the CodeMirror language extension: `lang-json` for JSON Schema/OpenAPI/LLM Schema, `lang-javascript` for TypeScript, `lang-python` for Pydantic
- Wire the compilation pipeline: editor onChange (debounced 300ms) → `parse()` → `export*(schema)` for the selected format → update output panel content
- Format switching triggers immediate re-export (no debounce) using the last parsed schema
- LLM Schema format: call `exportLlmSchema()`, display `result.schema` as JSON, show any `result.warnings` in the error panel (appended below parse errors if any)
- Handle export errors gracefully (show in error panel, don't crash)

**Patterns to follow:**
- Existing exporter API: `exportJsonSchema(schema)`, `exportTypeScript(schema)`, `exportPydantic(schema)`, `exportOpenAPI(schema, {title, version})`, `exportLlmSchema(schema)`

**Test scenarios:**
- Happy path: Type valid schema → JSON Schema output appears formatted and highlighted
- Happy path: Switch to TypeScript tab → output updates immediately with TypeScript interface code
- Happy path: Switch to Pydantic tab → output shows Python class with proper highlighting
- Happy path: Switch to LLM Schema tab → output shows strict JSON Schema, any warnings appear in error panel
- Edge case: Schema with parse errors → output panel shows last successful output or is empty, error panel shows errors
- Edge case: Very large schema (ecommerce.clear) → output renders without lag
- Integration: Full pipeline — type in editor → debounce → parse → export → output updates with correct format

**Verification:**
- All 5 format tabs produce correct output matching CLI output
- Format switching is instant (no debounce)
- Typing triggers debounced recompilation at ~300ms

---

- [ ] **Unit 4: URL Hash Sharing**

**Goal:** Encode playground state in the URL fragment and restore it on page load.

**Requirements:** R7, R8, R9

**Dependencies:** Units 2, 3

**Files:**
- Create: `playground/src/sharing.ts`
- Modify: `playground/src/main.ts`

**Approach:**
- State to encode: editor content (string) + selected format (string)
- Encode: JSON.stringify state object → lz-string `compressToEncodedURIComponent()` → set `window.location.hash`
- Decode: read `window.location.hash` → lz-string `decompressFromEncodedURIComponent()` → JSON.parse → restore editor content and format tab
- Update hash on every editor change (debounced, same timer as compilation) and on format switch
- Share button: copy `window.location.href` to clipboard using `navigator.clipboard.writeText()`, show brief "Copied!" feedback
- Graceful fallback: if hash decompression or JSON.parse fails (corrupt/invalid hash), load the default example instead of crashing

**Test scenarios:**
- Happy path: Type schema, click Share → URL contains hash, opening URL in new tab restores exact content and format
- Happy path: Switch format → URL hash updates, restoring preserves the selected format
- Edge case: Load page with empty hash → loads default example
- Edge case: Load page with corrupt/invalid hash → loads default example (no crash)
- Edge case: Large schema (ecommerce.clear) → hash is within reasonable URL length, restores correctly
- Error path: `navigator.clipboard.writeText()` fails (non-HTTPS or denied) → show fallback message

**Verification:**
- Round-trip: encode → decode produces identical content and format
- Share button copies correct URL
- Corrupt hash degrades gracefully to default example

---

- [ ] **Unit 5: Examples, Header, Polish, and Deployment**

**Goal:** Add the examples dropdown, header chrome, responsive layout, and GitHub Pages deployment.

**Requirements:** R10, R11, R12, R13, R14

**Dependencies:** Units 2, 3, 4

**Files:**
- Create: `playground/src/examples.ts`
- Create: `playground/src/styles.css`
- Modify: `playground/index.html`
- Modify: `playground/src/main.ts`

**Approach:**
- **Examples**: Import example files as string constants at build time using Vite raw imports (e.g., `import userExample from '../../examples/user.clear?raw'`). This embeds ~5KB into the JS bundle (gzips to ~1.5KB) and guarantees instant availability without network requests. Examples dropdown in the header. Selecting an example sets editor content and updates URL hash. No confirmation dialog for overwriting — this matches user expectations for example loaders
- **Default load**: On page load with no hash, load `user.clear` content and set format to JSON Schema
- **Header**: Single row — "ClearSchema" title (links to GitHub), examples dropdown, Share button, `npm i @clearschema/core` as a copyable code snippet, GitHub icon link
- **Layout**: CSS Grid — `grid-template-columns: 1fr 1fr` for desktop. Media query at 768px switches to `grid-template-rows: 1fr 1fr` (stacked). Error panel spans full width below both panels
- **Styling**: Clean, minimal dark theme. Consistent with CodeMirror's oneDark or similar. No custom theme picker
- **Deployment**: Verify the GitHub Actions workflow from Unit 1 deploys correctly. Ensure CNAME file for clearschema.dev is in the output. Configure DNS (A records or CNAME to GitHub Pages)

**Patterns to follow:**
- Existing example files in `examples/` for content

**Test scenarios:**
- Happy path: Examples dropdown shows 5 options, selecting one loads the schema and compiles
- Happy path: Default example (user.clear) loads on first visit, output panel shows JSON Schema
- Happy path: Header displays all elements — title, examples, Share, npm command, GitHub link
- Edge case: Tablet viewport (768px) → panels stack vertically
- Edge case: Mobile viewport (375px) → rendering is not broken (may be cramped but functional)
- Integration: Load page → see default example compiled → select different example → output updates → click Share → URL works in new tab

**Verification:**
- All 5 examples load and compile correctly
- GitHub Pages deployment succeeds at clearschema.dev
- Page loads in under 2 seconds on desktop Chrome
- Layout works on desktop (side-by-side) and tablet (stacked)

## System-Wide Impact

- **Interaction graph**: Playground imports `@clearschema/core` from npm — it's a consumer, not a modifier. Changes to the core package require a new npm publish before the playground picks them up
- **Unchanged invariants**: The playground does not modify the core package, CLI, VS Code extension, or any existing code. It is an additive, standalone web app in a new `playground/` directory
- **API surface parity**: The playground exposes all 5 export formats available via the CLI. If a 6th exporter is added, the playground's format tabs should be updated

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `fs/promises` dynamic import breaks browser bundle | Import specific functions instead of barrel, or configure Vite to stub `fs`. Verify during Unit 1 build |
| CodeMirror bundle larger than expected | The modular architecture keeps core small (~40KB gzipped). Monitor with `vite-bundle-visualizer` during Unit 1 |
| DNS propagation delay for clearschema.dev | Configure DNS early (before implementation). GitHub Pages HTTPS provisioning can take up to 24 hours |
| lz-string URLs too long for edge cases | Largest example (ecommerce.clear, 1619B) compresses well. Add graceful fallback for decode failures. Accept that very large schemas may not be shareable via URL |

## Documentation / Operational Notes

- Update `README.md` to link to the playground at clearschema.dev
- Configure `clearschema.dev` DNS A records to GitHub Pages IPs (or CNAME to `clearschema.github.io`)

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-04-browser-playground-requirements.md](docs/brainstorms/2026-04-04-browser-playground-requirements.md)
- ClearSchema public API: `clearschema/src/index.ts`
- TextMate grammar reference: `vscode-clearschema/syntaxes/clearschema.tmLanguage.json`
- CodeMirror 6: https://codemirror.net/
- lz-string: https://github.com/pieroxy/lz-string
- Vite: https://vite.dev/
