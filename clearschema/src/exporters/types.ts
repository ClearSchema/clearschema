export interface ExportOptions {
    [key: string]: any;
}

export interface Exporter<T> {
    export(schema: any, options?: ExportOptions): T;
}

export interface JsonSchemaExportOptions extends ExportOptions {
    schemaVersion?: '2020-12' | '2019-09' | 'draft-07';
    includeDescriptions?: boolean;
    includeDefaults?: boolean;
    rootId?: string;
}

export interface TypeScriptExportOptions extends ExportOptions {
    useInterfaces?: boolean;
    exportKeyword?: 'export' | 'declare' | '';
    includeComments?: boolean;
}

export interface PydanticExportOptions extends ExportOptions {
    includeComments?: boolean;
    useTyping?: boolean;
}

export interface OpenAPIExportOptions extends ExportOptions {
    title?: string;
    version?: string;
    description?: string;
    serverUrl?: string;
}

export interface OpenAPISchema {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers?: Array<{
        url: string;
        description?: string;
    }>;
    components: {
        schemas: Record<string, any>;
    };
}

export interface JsonSchema {
    $schema?: string;
    $id?: string;
    $defs?: Record<string, JsonSchemaField>;
    type?: string | string[];
    properties?: Record<string, JsonSchemaField>;
    required?: string[];
    items?: JsonSchemaField | JsonSchemaField[] | boolean;
    prefixItems?: JsonSchemaField[];
    anyOf?: JsonSchemaField[];
    allOf?: JsonSchemaField[];
    oneOf?: JsonSchemaField[];
    $ref?: string;
    description?: string;
    default?: any;
    const?: any;
    enum?: any[];
    [key: string]: any;
}

export type JsonSchemaField = JsonSchema;
