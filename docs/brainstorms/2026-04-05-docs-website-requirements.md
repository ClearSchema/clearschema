---
date: 2026-04-05
topic: docs-website
---

# ClearSchema Documentation Website

## Problem Frame

ClearSchema has extensive documentation scattered across README.md, docs/*.md, and phase docs — but it's all trapped in GitHub markdown. The existing browser playground deploys to GitHub Pages as a standalone converter with no surrounding context. Potential users landing on the project have no polished, navigable docs site — the standard expectation for any serious developer tool. A proper documentation website is the highest-leverage adoption move now that all core features are shipped (6 exporters, importer, LSP, playground, CLI).

## Requirements

**Site Infrastructure**

- R1. VitePress-based static site in a new `website/` directory with its own `package.json`
- R2. GitHub Actions workflow replacing the existing `deploy-playground.yml` — GitHub Pages only supports one deployment source per repo, so the VitePress site replaces the standalone playground deployment
- R3. Built-in full-text search (VitePress local search)
- R4. Responsive design with dark/light mode support (VitePress defaults)
- R5. Clean, professional landing page with hero section, live example, feature highlights, and use case cards

**Documentation Content**

- R6. Getting Started guide: install, first schema, first export (end-to-end in under 2 minutes)
- R7. Installation page covering npm, CLI global install, and programmatic usage
- R8. CLI Reference: all commands, flags, and examples (`clearschema`, `clearschema import`)
- R9. API Reference: all public exports with signatures and examples (`parse`, `exportJsonSchema`, `exportTypeScript`, `exportPydantic`, `exportOpenAPI`, `exportZod`, `exportLlmSchema`, `importJsonSchema`, `exportClearSchema`, `resolveReferences`, `resolveImports`). Note: this is new writing, not migration — the README covers these briefly but not with per-function docs.

**Syntax Guide**

- R10. Types page: primitives, objects, arrays, tuples, maps, unions with examples
- R11. Modifiers page: inline modifiers, block modifiers, type-prefixed modifiers, all constraint types
- R12. References page: `$defs`, `$ref`, cross-file imports, wildcard imports
- R13. Composition page: `allOf`, `anyOf`, `oneOf`, union types

**Exporter Reference**

- R14. One page per exporter (6 total): JSON Schema, TypeScript, Pydantic, Zod, OpenAPI, LLM Schema
- R15. Each exporter page includes: what it produces, CLI usage, API usage, options/configuration, output examples, and format-specific notes (e.g., Zod peer dep, LLM schema constraints)

**Playground Integration**

- R16. Playground embedded as a full-width page (no sidebar) within the VitePress site at `/playground`
- R17. Existing playground code (CodeMirror editor, format tabs, shareable URLs) wrapped as a client-only Vue component via thin wrapper — mount the vanilla TS app inside `onMounted`, handle cleanup on `onUnmounted`, scope CSS to avoid VitePress style collisions. Not a Vue rewrite.
- R18. Playground accessible from top-level navigation on every page
- R19. Add Zod format tab to the playground (currently missing — only has JSON Schema, TypeScript, Pydantic, OpenAPI, LLM Schema)

**Content Migration**

- R20. Content sourced from existing README.md, docs/GRAMMAR.md, docs/ARCHITECTURE.md, and CHANGELOG.md — reorganized by topic, not copied verbatim
- R21. CHANGELOG.md rendered as a page at `/changelog`

## Success Criteria

- Every major section from README.md has a corresponding page in the docs site with better navigation
- A new user can go from landing page to working schema export in under 2 minutes following the Getting Started guide
- The playground is reachable in one click from any page
- The site builds and deploys automatically on push to main
- Lighthouse performance score >90

## Scope Boundaries

- No custom domain setup (GitHub Pages default URL is fine for now)
- No blog or announcement section
- No i18n / multi-language support
- No versioned docs (single version reflecting latest)
- No user accounts, comments, or community features
- VS Code extension / LSP docs are out of scope for initial launch (can reference briefly)
- No interactive inline code editors within documentation pages — the playground is its own dedicated page

## Key Decisions

- **VitePress over Docusaurus/Starlight**: Same Vite toolchain as existing playground, smallest bundle, built-in search, fast builds
- **Embedded playground over separate app**: Unified navigation, single deployment, feels like one product
- **Thin wrapper for playground, not Vue rewrite**: The existing playground uses imperative DOM construction with module-level singletons. A thin wrapper (mount in `onMounted`, cleanup in `onUnmounted`, scope CSS) is feasible and avoids reimplementation. Must be client-only to avoid VitePress SSR issues.
- **New `website/` directory**: VitePress site lives in its own directory with its own `package.json`, separate from `clearschema/` (core lib) and `playground/` (legacy, superseded)
- **Replace existing GitHub Pages deployment**: One deployment source per repo — the VitePress site replaces `deploy-playground.yml`
- **Full content at launch**: Most content already exists in README and docs/ — primarily a reorganization effort, except for API Reference (R9) which requires new writing
- **Content structure**: Three sidebar sections (Docs, Guide, Exporters) plus top-level Playground and Changelog

## Dependencies / Assumptions

- VitePress Vite config must replicate the `fs`/`path`/`fs/promises` → `/dev/null` aliases from the existing playground's `vite.config.ts` for `@clearschema/core` browser compatibility
- `@clearschema/core` resolved from local source (not npm) so that all exporters (including Zod, which may not be published yet) are available
- VitePress supports full-width custom layouts for the playground page (confirmed: custom layout via frontmatter)

## Outstanding Questions

### Deferred to Planning

- [Affects R5][Needs research] VitePress custom landing page layout — extent of customization needed vs default theme
- [Affects R14][Technical] Whether exporter pages should auto-generate from source or be hand-written markdown
- [Affects R17][Technical] Specific lifecycle cleanup needed for CodeMirror instances on route navigation

## Next Steps

→ `/ce:plan` for structured implementation planning
