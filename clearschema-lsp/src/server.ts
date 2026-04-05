import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    InitializeParams,
    InitializeResult,
    CompletionParams,
    CompletionItem,
    HoverParams,
    Hover,
    DefinitionParams,
    Definition,
    DocumentSymbolParams,
    DocumentSymbol,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentState } from './utils';
import { getCompletions } from './completion';
import { getHover } from './hover';
import { getDefinition } from './definition';
import { getDocumentSymbols } from './symbols';

// Create the LSP connection (supports stdio and IPC)
const connection = createConnection(ProposedFeatures.all);

// Document manager — handles incremental sync internally
const documents = new TextDocuments(TextDocument);

// Per-document state (cached AST, diagnostics)
const documentStates = new Map<string, DocumentState>();

// Debounce timers for diagnostics per document URI
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

connection.onInitialize((_params: InitializeParams): InitializeResult => {
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                triggerCharacters: ['.', '^', ':', ' '],
            },
            hoverProvider: true,
            definitionProvider: true,
            documentSymbolProvider: true,
        },
    };
});

/**
 * Validate a document: parse it, cache the schema, and send diagnostics.
 */
function validateDocument(document: TextDocument): void {
    const uri = document.uri;

    let state = documentStates.get(uri);
    if (!state) {
        state = new DocumentState();
        documentStates.set(uri, state);
    }

    const diagnostics = state.update(document.getText());
    connection.sendDiagnostics({ uri, diagnostics });
}

// Debounced validation on content change
documents.onDidChangeContent((change) => {
    const uri = change.document.uri;

    // Clear any pending validation for this document
    const existing = debounceTimers.get(uri);
    if (existing) {
        clearTimeout(existing);
    }

    // Schedule validation after 300ms debounce
    const timer = setTimeout(() => {
        debounceTimers.delete(uri);
        validateDocument(change.document);
    }, 300);

    debounceTimers.set(uri, timer);
});

// Clean up state when a document is closed
documents.onDidClose((event) => {
    const uri = event.document.uri;
    documentStates.delete(uri);

    const timer = debounceTimers.get(uri);
    if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(uri);
    }

    // Clear diagnostics for the closed document
    connection.sendDiagnostics({ uri, diagnostics: [] });
});

// --- Stub handlers (Units 2-5 will implement these) ---

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];

    const text = doc.getText();
    const allLines = text.split('\n');
    const lineNumber = params.position.line;
    const lineText = allLines[lineNumber] ?? '';
    const character = params.position.character;

    const state = documentStates.get(params.textDocument.uri);
    const schema = state ? state.getSchema() : null;

    return getCompletions(lineText, character, allLines, lineNumber, schema);
});

connection.onHover((params: HoverParams): Hover | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const text = doc.getText();
    const lines = text.split('\n');
    const lineText = lines[params.position.line] ?? '';

    const state = documentStates.get(params.textDocument.uri);
    const schema = state ? state.getSchema() : null;

    return getHover(lineText, params.position.character, schema);
});

connection.onDefinition((params: DefinitionParams): Definition | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const text = doc.getText();
    const lines = text.split('\n');
    const lineText = lines[params.position.line] ?? '';

    const state = documentStates.get(params.textDocument.uri);
    const schema = state ? state.getSchema() : null;

    return getDefinition(lineText, params.position.character, schema, params.textDocument.uri);
});

connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
    const state = documentStates.get(params.textDocument.uri);
    const schema = state ? state.getSchema() : null;

    return getDocumentSymbols(schema);
});

// Wire up document management and start the connection
documents.listen(connection);
connection.listen();
