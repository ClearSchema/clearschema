---
date: 2026-04-04
topic: browser-playground
---

# Browser Playground

## Problem Frame

ClearSchema v0.3.0 is live on npm but has zero discoverability. Potential users must install the package before they can evaluate the DSL. A browser playground eliminates this friction entirely — anyone can try ClearSchema in seconds by visiting a URL. The project's zero-runtime-dependency, pure-TypeScript architecture means the full parser and all exporters run natively in the browser with no WASM or server-side processing.

## Requirements

**Core Playground**

- R1. The playground is a single-page web app at `clearschema.dev` hosted via GitHub Pages
- R2. Left panel: ClearSchema DSL editor with syntax highlighting
- R3. Right panel: live output that updates as the user types (debounced)
- R4. Format selector (tabs or dropdown) to switch between all 5 export formats: JSON Schema, TypeScript, Pydantic, OpenAPI, LLM Schema
- R5. The output panel shows formatted, syntax-highlighted output for the selected format
- R6. Parse errors display in a visible error panel showing line number, column, and message — not silently swallowed
- R6a. If the schema contains `import` statements, the playground displays a warning that imports are not supported in the browser context

**Sharing**

- R7. Playground state (editor content + selected format) is encoded in the URL fragment (hash)
- R8. A "Share" button copies the current URL to the clipboard
- R9. Loading a URL with a hash fragment restores the editor content and selected format

**Examples**

- R10. An examples dropdown loads pre-built schemas from the existing `examples/` directory: user.clear, ecommerce.clear, llm-tool-definition.clear, llm-structured-response.clear, llm-agent-output.clear
- R11. Selecting an example replaces the editor content and updates the URL hash

**Polish**

- R12. The playground loads with a sensible default example (e.g., user.clear) so the page is never blank on first visit
- R13. Minimal header with project name, GitHub link, npm install command, and the examples dropdown
- R14. Responsive layout — usable on desktop (side-by-side panels) and tablet (stacked panels). No mobile-specific layout, but must not crash or break rendering on mobile browsers

## Success Criteria

- Visiting `clearschema.dev` shows a working playground with live compilation in under 2 seconds
- All 5 export formats produce correct output matching the CLI
- Sharing a URL with hash-encoded content correctly restores state in a new browser tab
- Parse errors are visible and helpful, not silent
- The playground works in Chrome, Firefox, and Safari (latest versions)

## Scope Boundaries

- No backend or server-side processing — everything runs in the browser
- No user accounts, saving, or persistence beyond URL sharing
- No collaborative/real-time editing
- No LSP features (autocomplete, hover, go-to-definition) — just syntax highlighting
- No mobile-specific layout (must not break rendering, but no optimization effort)
- No custom themes or settings panel for v1

## Key Decisions

- **Domain: clearschema.dev** — Developer-oriented TLD, professional, owned by the project
- **Playground IS the site** — No landing page or marketing chrome. The editor is the first thing visitors see. Fastest to build, most impactful first impression
- **URL hash sharing** — No backend needed. Schema + format encoded in fragment. Works like TypeScript Playground
- **Existing examples** — Reuse the 5 example files already in the repo rather than writing new ones
- **GitHub Pages hosting** — Free, auto-deploys, zero ops

## Dependencies / Assumptions

- `clearschema.dev` DNS must be configured to point to GitHub Pages
- The parser, lexer, exporters, and AST modules are confirmed browser-safe (only `cli/index.ts` uses Node-specific APIs). **Caveat:** `resolver/resolver.ts` contains a `defaultFileLoader` that dynamically imports `fs/promises` — the playground bundle must either tree-shake this or exclude `resolveImports` from the browser entry point
- GitHub Pages supports custom domains with HTTPS via Let's Encrypt

## Outstanding Questions

### Resolve Before Planning

(None — all product decisions resolved)

### Deferred to Planning

- [Affects R2][Needs research] Which code editor component to use (Monaco, CodeMirror 6, or a lighter alternative) — balance bundle size vs. features
- [Affects R5][Technical] How to syntax-highlight the output panel (different languages per format: JSON, TypeScript, Python, YAML)
- [Affects R7][Technical] URL hash encoding strategy — base64, LZ-string compression, or URI encoding. Large schemas may exceed URL length limits
- [Affects R1][Technical] Build tooling for the playground (Vite, esbuild, or plain bundling) and GitHub Actions workflow for deployment
- [Affects R14][Technical] CSS layout approach for responsive panels (CSS Grid, flexbox, or a split-pane library)

## Next Steps

-> `/ce:plan` for structured implementation planning
