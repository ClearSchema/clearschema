import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import {
  exportJsonSchema,
  exportTypeScript,
  exportPydantic,
  exportOpenAPI,
  exportLlmSchema,
} from '@clearschema/core';
import type { Schema } from '@clearschema/core';

export type Format = 'json-schema' | 'typescript' | 'pydantic' | 'openapi' | 'llm-schema';

const FORMAT_LABELS: Record<Format, string> = {
  'json-schema': 'JSON Schema',
  typescript: 'TypeScript',
  pydantic: 'Pydantic',
  openapi: 'OpenAPI',
  'llm-schema': 'LLM Schema',
};

const ALL_FORMATS: Format[] = ['json-schema', 'typescript', 'pydantic', 'openapi', 'llm-schema'];

function languageForFormat(format: Format) {
  switch (format) {
    case 'json-schema':
    case 'openapi':
    case 'llm-schema':
      return json();
    case 'typescript':
      return javascript({ typescript: true });
    case 'pydantic':
      return python();
    default:
      return json();
  }
}

let outputView: EditorView;
let languageCompartment: Compartment;
let currentFormat: Format = 'json-schema';
let onWarnings: (warnings: string[]) => void = () => {};
let onFormatChange: (format: Format) => void = () => {};

export function createOutputPanel(
  parent: HTMLElement,
  warningCallback: (warnings: string[]) => void,
  formatChangeCallback: (format: Format) => void,
): { tabBar: HTMLElement } {
  onWarnings = warningCallback;
  onFormatChange = formatChangeCallback;
  languageCompartment = new Compartment();

  outputView = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        EditorState.readOnly.of(true),
        languageCompartment.of(languageForFormat(currentFormat)),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    }),
    parent,
  });

  const tabBar = document.createElement('div');
  tabBar.id = 'format-tabs';
  for (const fmt of ALL_FORMATS) {
    const btn = document.createElement('button');
    btn.className = 'format-tab' + (fmt === currentFormat ? ' active' : '');
    btn.textContent = FORMAT_LABELS[fmt];
    btn.dataset['format'] = fmt;
    btn.addEventListener('click', () => {
      setFormat(fmt);
      tabBar.querySelectorAll('.format-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onFormatChange(fmt);
    });
    tabBar.appendChild(btn);
  }

  return { tabBar };
}

export function setFormat(format: Format) {
  currentFormat = format;
  outputView.dispatch({
    effects: languageCompartment.reconfigure(languageForFormat(format)),
  });
}

export function getFormat(): Format {
  return currentFormat;
}

export function setFormatActive(format: Format) {
  currentFormat = format;
  const tabBar = document.getElementById('format-tabs');
  if (tabBar) {
    tabBar.querySelectorAll('.format-tab').forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset['format'] === format);
    });
  }
  outputView.dispatch({
    effects: languageCompartment.reconfigure(languageForFormat(format)),
  });
}

export function updateOutput(schema: Schema | null) {
  if (!schema) {
    setOutputContent('');
    onWarnings([]);
    return;
  }

  try {
    const result = exportSchema(schema, currentFormat);
    setOutputContent(result.text);
    onWarnings(result.warnings);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setOutputContent(`// Export error: ${msg}`);
    onWarnings([]);
  }
}

function exportSchema(
  schema: Schema,
  format: Format,
): { text: string; warnings: string[] } {
  switch (format) {
    case 'json-schema':
      return { text: JSON.stringify(exportJsonSchema(schema), null, 2), warnings: [] };
    case 'typescript':
      return { text: exportTypeScript(schema), warnings: [] };
    case 'pydantic':
      return { text: exportPydantic(schema), warnings: [] };
    case 'openapi': {
      const result = exportOpenAPI(schema, { title: 'Schema', version: '1.0.0' });
      return { text: JSON.stringify(result, null, 2), warnings: [] };
    }
    case 'llm-schema': {
      const result = exportLlmSchema(schema);
      return { text: JSON.stringify(result.schema, null, 2), warnings: result.warnings };
    }
  }
}

function setOutputContent(text: string) {
  outputView.dispatch({
    changes: {
      from: 0,
      to: outputView.state.doc.length,
      insert: text,
    },
  });
}
