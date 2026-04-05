import { parse } from '@clearschema/core';
import type { Schema } from '@clearschema/core';
import { createEditor, getEditorContent, setEditorContent, destroyEditor } from './editor';
import { createOutputPanel, updateOutput, getFormat, setFormatActive, destroyOutputPanel } from './output';
import type { Format } from './output';
import { decodeState, updateHash, copyShareUrl } from './sharing';
import { examples, defaultExample } from './examples';

let lastSchema: Schema | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let dropdownClickListener: ((e: MouseEvent) => void) | null = null;
let mountContainer: HTMLElement | null = null;

// --- Error/Warning display ---

let errorPanel: HTMLDivElement;
let importWarning: HTMLDivElement;

function showErrors(errors: Array<{ line: number; column: number; message: string }>) {
  errorPanel.innerHTML = '';
  if (errors.length === 0) {
    errorPanel.hidden = true;
    return;
  }
  errorPanel.hidden = false;
  for (const err of errors) {
    const div = document.createElement('div');
    div.className = 'error-item';
    div.textContent = `Line ${err.line}, Col ${err.column}: ${err.message}`;
    errorPanel.appendChild(div);
  }
}

function showWarnings(warnings: string[]) {
  // Remove previous warnings (keep error items)
  errorPanel.querySelectorAll('.warning-item').forEach((el) => el.remove());
  for (const w of warnings) {
    const div = document.createElement('div');
    div.className = 'warning-item';
    div.textContent = `Warning: ${w}`;
    errorPanel.appendChild(div);
    errorPanel.hidden = false;
  }
}

// --- Compilation pipeline ---

function handleChange(content: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    compile(content);
    updateHash(content, getFormat());
  }, 300);
}

function compile(content: string) {
  if (!content.trim()) {
    lastSchema = null;
    showErrors([]);
    importWarning.hidden = true;
    updateOutput(null);
    return;
  }

  try {
    const schema = parse(content);
    lastSchema = schema;
    importWarning.hidden = !(schema.imports && schema.imports.length > 0);
    showErrors([]);
    updateOutput(schema);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'location' in err) {
      const parseErr = err as { message: string; location: { start: { line: number; column: number } } };
      showErrors([{
        line: parseErr.location.start.line,
        column: parseErr.location.start.column,
        message: parseErr.message,
      }]);
    } else if (err instanceof Error) {
      showErrors([{ line: 1, column: 1, message: err.message }]);
    } else {
      showErrors([{ line: 1, column: 1, message: String(err) }]);
    }
  }
}

function handleFormatChange(format: Format) {
  updateOutput(lastSchema);
  updateHash(getEditorContent(), format);
}

function loadContent(code: string, format?: Format) {
  setEditorContent(code);
  if (format) setFormatActive(format);
  compile(code);
  updateHash(code, format ?? getFormat());
}

function showToast(message: string) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  if (mountContainer) {
    mountContainer.appendChild(toast);
  } else {
    document.body.appendChild(toast);
  }
  setTimeout(() => toast.remove(), 2000);
}

// --- Build header ---

function buildHeader(): HTMLElement {
  const header = document.createElement('header');
  header.id = 'header';

  // Logo
  const logo = document.createElement('a');
  logo.className = 'logo';
  logo.textContent = 'ClearSchema';
  logo.href = 'https://github.com/ClearSchema/clearschema';
  logo.target = '_blank';
  logo.rel = 'noopener';
  header.appendChild(logo);

  // Examples dropdown
  const examplesWrapper = document.createElement('div');
  examplesWrapper.className = 'examples-wrapper';

  const examplesBtn = document.createElement('button');
  examplesBtn.className = 'examples-btn';
  examplesBtn.textContent = 'Examples \u25BE';

  const dropdown = document.createElement('div');
  dropdown.className = 'examples-dropdown';

  for (const example of examples) {
    const btn = document.createElement('button');
    btn.textContent = example.name;
    btn.addEventListener('click', () => {
      loadContent(example.content);
      dropdown.classList.remove('open');
    });
    dropdown.appendChild(btn);
  }

  examplesBtn.addEventListener('click', () => {
    dropdown.classList.toggle('open');
  });

  // Close dropdown on click outside
  dropdownClickListener = (e: MouseEvent) => {
    if (!examplesWrapper.contains(e.target as Node)) {
      dropdown.classList.remove('open');
    }
  };
  document.addEventListener('click', dropdownClickListener);

  examplesWrapper.appendChild(examplesBtn);
  examplesWrapper.appendChild(dropdown);
  header.appendChild(examplesWrapper);

  // Share button
  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-btn';
  shareBtn.textContent = 'Share';
  shareBtn.addEventListener('click', async () => {
    const ok = await copyShareUrl();
    showToast(ok ? 'Link copied!' : 'Could not copy link');
  });
  header.appendChild(shareBtn);

  // Spacer
  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  header.appendChild(spacer);

  // npm snippet
  const npm = document.createElement('code');
  npm.className = 'npm-snippet';
  npm.textContent = 'npm i @clearschema/core';
  npm.title = 'Click to copy';
  npm.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('npm i @clearschema/core');
      showToast('Copied!');
    } catch { /* ignore */ }
  });
  header.appendChild(npm);

  // GitHub link
  const ghLink = document.createElement('a');
  ghLink.className = 'github-link';
  ghLink.href = 'https://github.com/ClearSchema/clearschema';
  ghLink.target = '_blank';
  ghLink.rel = 'noopener';
  ghLink.title = 'View on GitHub';
  ghLink.innerHTML = '<svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
  header.appendChild(ghLink);

  return header;
}

// --- Public API ---

export function mount(container: HTMLElement): void {
  mountContainer = container;

  errorPanel = document.createElement('div');
  errorPanel.id = 'error-panel';
  errorPanel.hidden = true;

  importWarning = document.createElement('div');
  importWarning.id = 'import-warning';
  importWarning.textContent = 'Import statements are not supported in the browser playground';
  importWarning.hidden = true;

  // Header
  container.appendChild(buildHeader());

  // Main layout
  const main = document.createElement('div');
  main.id = 'main-layout';

  const editorContainer = document.createElement('div');
  editorContainer.id = 'editor-panel';

  const outputContainer = document.createElement('div');
  outputContainer.id = 'output-panel';

  const outputEditorContainer = document.createElement('div');
  outputEditorContainer.id = 'output-editor';

  const { tabBar } = createOutputPanel(outputEditorContainer, showWarnings, handleFormatChange);
  outputContainer.appendChild(tabBar);
  outputContainer.appendChild(outputEditorContainer);

  main.appendChild(editorContainer);
  main.appendChild(outputContainer);

  container.appendChild(main);
  container.appendChild(importWarning);
  container.appendChild(errorPanel);

  // Restore from URL hash or load default example
  const restored = decodeState();
  const initialContent = restored?.code ?? defaultExample.content;
  const initialFormat = restored?.format ?? 'json-schema';

  if (initialFormat !== 'json-schema') {
    setFormatActive(initialFormat);
  }

  createEditor(editorContainer, initialContent, handleChange);

  // Trigger initial compile
  compile(initialContent);
  updateHash(initialContent, initialFormat);
}

export function destroy(): void {
  destroyEditor();
  destroyOutputPanel();

  if (dropdownClickListener) {
    document.removeEventListener('click', dropdownClickListener);
    dropdownClickListener = null;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  lastSchema = null;

  if (mountContainer) {
    while (mountContainer.firstChild) {
      mountContainer.removeChild(mountContainer.firstChild);
    }
    mountContainer = null;
  }
}
