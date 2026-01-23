import { Schema } from '../ast/types';
import { Exporter, ExportOptions } from './types';
import { exportJsonSchema } from './json-schema';

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

export class OpenAPIExporter implements Exporter<OpenAPISchema> {
    export(schema: Schema, options?: OpenAPIExportOptions): OpenAPISchema {
        const title = options?.title || 'Generated API';
        const version = options?.version || '1.0.0';
        const description = options?.description;
        const serverUrl = options?.serverUrl;

        // Use JSON Schema exporter for the schemas
        const jsonSchema = exportJsonSchema(schema, {
            schemaVersion: '2020-12',
            includeDescriptions: true,
            includeDefaults: true,
        });

        // Build OpenAPI structure
        const openapi: OpenAPISchema = {
            openapi: '3.1.0',
            info: {
                title,
                version,
            },
            components: {
                schemas: {},
            },
        };

        if (description) {
            openapi.info.description = description;
        }

        if (serverUrl) {
            openapi.servers = [
                {
                    url: serverUrl,
                },
            ];
        }

        // Add definitions to components/schemas
        if (jsonSchema.$defs) {
            openapi.components.schemas = { ...jsonSchema.$defs };
        }

        // Add root schema if it has properties
        if (jsonSchema.properties && Object.keys(jsonSchema.properties).length > 0) {
            openapi.components.schemas.RootSchema = {
                type: jsonSchema.type,
                properties: jsonSchema.properties,
                required: jsonSchema.required,
            };
        }

        return openapi;
    }
}

export function exportOpenAPI(schema: Schema, options?: OpenAPIExportOptions): OpenAPISchema {
    const exporter = new OpenAPIExporter();
    return exporter.export(schema, options);
}
