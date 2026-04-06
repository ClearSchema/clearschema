import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { ViewUpdate } from '@codemirror/view';
import { clearschemaLanguage } from './clearschema-lang';

let editorView: EditorView | null = null;

export type OnChangeCallback = (content: string) => void;

export function createEditor(
  parent: HTMLElement,
  initialContent: string,
  onChange: OnChangeCallback,
): EditorView {
  const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString());
    }
  });

  editorView = new EditorView({
    state: EditorState.create({
      doc: initialContent,
      extensions: [
        basicSetup,
        clearschemaLanguage,
        updateListener,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    }),
    parent,
  });

  return editorView;
}

export function getEditorContent(): string {
  return editorView!.state.doc.toString();
}

export function setEditorContent(content: string): void {
  editorView!.dispatch({
    changes: {
      from: 0,
      to: editorView!.state.doc.length,
      insert: content,
    },
  });
}

export function destroyEditor(): void {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
}
