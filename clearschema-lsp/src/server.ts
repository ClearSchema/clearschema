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

connection.onCompletion((_params: CompletionParams): CompletionItem[] => {
    // Unit 2: Autocomplete
    return [];
});

connection.onHover((_params: HoverParams): Hover | null => {
    // Unit 3: Hover documentation
    return null;
});

connection.onDefinition((_params: DefinitionParams): Definition | null => {
    // Unit 4: Go-to-definition
    return null;
});

connection.onDocumentSymbol((_params: DocumentSymbolParams): DocumentSymbol[] => {
    // Unit 5: Document symbols
    return [];
});

// Wire up document management and start the connection
documents.listen(connection);
connection.listen();
