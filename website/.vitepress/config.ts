import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'ClearSchema',
  description: 'A human-readable schema definition language',
  base: '/ClearSchema/',

  themeConfig: {
    search: {
      provider: 'local',
    },

    nav: [
      { text: 'Getting Started', link: '/getting-started/introduction' },
      { text: 'Guide', link: '/guide/types' },
      { text: 'Exporters', link: '/exporters/json-schema' },
      { text: 'Playground', link: '/playground' },
      { text: 'Changelog', link: '/changelog' },
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/introduction' },
            { text: 'Installation', link: '/getting-started/installation' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'CLI Reference', link: '/reference/cli' },
            { text: 'API Reference', link: '/reference/api' },
            { text: 'MCP Server', link: '/reference/mcp' },
          ],
        },
      ],
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Types', link: '/guide/types' },
            { text: 'Modifiers', link: '/guide/modifiers' },
            { text: 'References', link: '/guide/references' },
            { text: 'Imports', link: '/guide/imports' },
            { text: 'Composition', link: '/guide/composition' },
            { text: 'Discriminated Unions', link: '/guide/match' },
            { text: 'Maps', link: '/guide/maps' },
          ],
        },
      ],
      '/exporters/': [
        {
          text: 'Exporters',
          items: [
            { text: 'JSON Schema', link: '/exporters/json-schema' },
            { text: 'TypeScript', link: '/exporters/typescript' },
            { text: 'Pydantic', link: '/exporters/pydantic' },
            { text: 'Zod', link: '/exporters/zod' },
            { text: 'OpenAPI', link: '/exporters/openapi' },
            { text: 'LLM Schema', link: '/exporters/llm-schema' },
            { text: 'ClearSchema', link: '/exporters/clearschema' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ClearSchema/ClearSchema' },
    ],
  },

  vite: {
    resolve: {
      alias: {
        'fs/promises': '/dev/null',
        fs: '/dev/null',
        path: '/dev/null',
      },
    },
  },
});
