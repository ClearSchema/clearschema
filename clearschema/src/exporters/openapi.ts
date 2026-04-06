import { Schema, MatchField, ObjectField, Field } from '../ast/types';
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

        // Inject discriminator annotations for MatchField nodes
        this.injectDiscriminators(schema, openapi);

        return openapi;
    }
    private injectDiscriminators(schema: Schema, openapi: OpenAPISchema): void {
        // Process root fields
        for (const field of schema.fields) {
            this.injectDiscriminatorForField(field, openapi.components.schemas.RootSchema?.properties);
        }

        // Process definitions
        for (const def of schema.definitions) {
            if (def.field.type === 'object') {
                const schemaObj = openapi.components.schemas[def.name];
                if (schemaObj?.properties) {
                    for (const childField of (def.field as any).fields) {
                        this.injectDiscriminatorForField(childField, schemaObj.properties);
                    }
                }
            } else if (def.field.type === 'match') {
                const matchField = def.field as MatchField;
                const schemaObj = openapi.components.schemas[def.name];
                if (schemaObj?.oneOf) {
                    schemaObj.discriminator = { propertyName: matchField.discriminator };
                }
            }
        }
    }

    private injectDiscriminatorForField(field: Field, properties?: Record<string, any>): void {
        if (!properties) return;

        if (field.type === 'match') {
            const matchField = field as MatchField;
            const prop = properties[field.name];
            if (prop?.oneOf) {
                prop.discriminator = { propertyName: matchField.discriminator };
            }
        }

        // Recurse into object fields to find nested match fields
        if (field.type === 'object') {
            const objectField = field as ObjectField;
            const parentProp = properties[field.name];
            if (parentProp?.properties) {
                for (const childField of objectField.fields) {
                    this.injectDiscriminatorForField(childField, parentProp.properties);
                }
            }
        }
    }
}

export function exportOpenAPI(schema: Schema, options?: OpenAPIExportOptions): OpenAPISchema {
    const exporter = new OpenAPIExporter();
    return exporter.export(schema, options);
}
