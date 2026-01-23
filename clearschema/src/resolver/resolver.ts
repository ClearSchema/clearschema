import { Schema, ImportDeclaration, SchemaDefinition, Field, RefField } from '../ast/types';
import { parse } from '../parser/parser';

export interface ResolverOptions {
    fileLoader?: (path: string) => Promise<string>;
    basePath?: string;
}

export interface ResolvedSchema extends Schema {
    resolvedImports: Map<string, Schema>;
}

/**
 * Resolve imports in a schema by loading external files
 */
export async function resolveImports(
    schema: Schema,
    options: ResolverOptions = {}
): Promise<ResolvedSchema> {
    const fileLoader = options.fileLoader || defaultFileLoader;
    const basePath = options.basePath || './';
    const loadedFiles = new Map<string, Schema>();
    const loadingStack: string[] = [];

    async function loadImport(importDecl: ImportDeclaration, currentPath: string): Promise<Schema> {
        const resolvedPath = resolvePath(importDecl.path, basePath, currentPath);

        // Check for circular imports
        if (loadingStack.includes(resolvedPath)) {
            throw new Error(`Circular import detected: ${[...loadingStack, resolvedPath].join(' -> ')}`);
        }

        // Return cached if already loaded
        if (loadedFiles.has(resolvedPath)) {
            return loadedFiles.get(resolvedPath)!;
        }

        loadingStack.push(resolvedPath);

        try {
            const content = await fileLoader(resolvedPath);
            const importedSchema = parse(content);

            // Recursively resolve imports in the imported file
            if (importedSchema.imports.length > 0) {
                const resolved = await resolveImports(importedSchema, {
                    ...options,
                    basePath: getDirectoryPath(resolvedPath),
                });
                loadedFiles.set(resolvedPath, resolved);
                return resolved;
            }

            loadedFiles.set(resolvedPath, importedSchema);
            return importedSchema;
        } finally {
            loadingStack.pop();
        }
    }

    // Load all imports
    for (const importDecl of schema.imports) {
        await loadImport(importDecl, basePath);
    }

    // Merge definitions from imports
    const mergedDefinitions = [...schema.definitions];
    const definitionNames = new Set(schema.definitions.map(d => d.name));

    for (const importDecl of schema.imports) {
        const resolvedPath = resolvePath(importDecl.path, basePath, basePath);
        const importedSchema = loadedFiles.get(resolvedPath);

        if (!importedSchema) continue;

        // Handle wildcard imports
        if (importDecl.definitions.includes('*')) {
            for (const def of importedSchema.definitions) {
                if (definitionNames.has(def.name)) {
                    throw new Error(
                        `Import conflict: definition "${def.name}" already exists. ` +
                        `Imported from ${importDecl.path}`
                    );
                }
                mergedDefinitions.push(def);
                definitionNames.add(def.name);
            }
        } else {
            // Import specific definitions
            for (const defName of importDecl.definitions) {
                const def = importedSchema.definitions.find(d => d.name === defName);
                if (!def) {
                    throw new Error(
                        `Import error: definition "${defName}" not found in ${importDecl.path}`
                    );
                }
                if (definitionNames.has(def.name)) {
                    throw new Error(
                        `Import conflict: definition "${def.name}" already exists. ` +
                        `Imported from ${importDecl.path}`
                    );
                }
                mergedDefinitions.push(def);
                definitionNames.add(def.name);
            }
        }

        // Mark import as resolved
        importDecl.resolved = true;
    }

    return {
        ...schema,
        definitions: mergedDefinitions,
        resolvedImports: loadedFiles,
    };
}

/**
 * Resolve $ref references within a schema
 */
export function resolveReferences(schema: Schema): Schema {
    const definitionsMap = new Map<string, SchemaDefinition>();
    for (const def of schema.definitions) {
        definitionsMap.set(def.name, def);
    }

    function resolveField(field: Field): Field {
        if (field.type === 'ref') {
            const refField = field as RefField;
            const refPath = refField.ref;

            // Parse reference: #/$defs/TypeName or TypeName
            let defName: string;
            const match = refPath.match(/#\/\$defs\/(.+)$/);
            if (match) {
                defName = match[1];
            } else {
                defName = refPath;
            }

            const definition = definitionsMap.get(defName);
            if (!definition) {
                throw new Error(`Reference error: definition "${defName}" not found`);
            }

            // Resolve the referenced field
            refField.resolvedRef = resolveField(definition.field);
            return refField;
        }

        // Recursively resolve nested fields
        if (field.type === 'object') {
            return {
                ...field,
                fields: field.fields.map(f => resolveField(f)),
            };
        }

        if (field.type === 'array' && typeof field.itemType !== 'string') {
            return {
                ...field,
                itemType: resolveField(field.itemType),
            };
        }

        if (field.type === 'array.tuple') {
            return {
                ...field,
                items: field.items.map(f => resolveField(f)),
            };
        }

        if (field.type === 'allOf' || field.type === 'anyOf' || field.type === 'oneOf') {
            return {
                ...field,
                schemas: field.schemas.map(s => resolveField(s)),
            };
        }

        return field;
    }

    return {
        ...schema,
        definitions: schema.definitions.map(def => ({
            ...def,
            field: resolveField(def.field),
        })),
        fields: schema.fields.map(f => resolveField(f)),
    };
}

// Helper functions
function resolvePath(importPath: string, basePath: string, currentPath: string): string {
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
        return `${currentPath}/${importPath}`;
    }
    return `${basePath}/${importPath}`;
}

function getDirectoryPath(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') || '.';
}

async function defaultFileLoader(path: string): Promise<string> {
    // Node.js file loader
    const fs = await import('fs/promises');
    return fs.readFile(path, 'utf-8');
}
