import { Schema } from '../ast/types';
import { Exporter, ExportOptions } from './types';
import { exportJsonSchema } from './json-schema';

export interface LlmSchemaResult {
    schema: any;
    warnings: string[];
}

export interface LlmSchemaExportOptions extends ExportOptions {
    maxDepth?: number;
    maxProperties?: number;
}

const UNSUPPORTED_KEYWORDS = [
    'default',
    'examples',
    'const',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'pattern',
    'minItems',
    'maxItems',
    'format',
];

export class LlmSchemaExporter implements Exporter<LlmSchemaResult> {
    export(schema: Schema, options?: LlmSchemaExportOptions): LlmSchemaResult {
        const maxDepth = options?.maxDepth ?? 5;
        const maxProperties = options?.maxProperties ?? 100;
        const warnings: string[] = [];

        // Export to standard JSON Schema (skip resolveReferences to avoid
        // stack overflow on circular refs — we handle inlining ourselves)
        const jsonSchema = exportJsonSchema(schema, {
            schemaVersion: '2020-12',
            includeDescriptions: true,
            includeDefaults: true,
        });

        // Step c: Post-process
        const defs = jsonSchema.$defs || {};

        // Inline all $ref references
        const result = this.inlineRefs(jsonSchema, defs, new Set(), warnings);

        // Remove $defs from the result
        delete result.$defs;

        // Remove $schema since LLM structured output doesn't need it
        delete result.$schema;

        // Remove $id
        delete result.$id;

        // Omit map fields (not supported in LLM structured output)
        this.omitMapFields(result, '', warnings);

        // Set additionalProperties: false on all objects and ensure all props in required
        this.enforceStrictObjects(result, warnings);

        // Strip unsupported keywords
        this.stripUnsupportedKeywords(result, '', warnings);

        // Validate nesting depth
        const depth = this.measureObjectDepth(result, 0);
        if (depth > maxDepth) {
            warnings.push(
                `Object nesting depth is ${depth}, which exceeds the recommended limit of ${maxDepth}`
            );
        }

        // Validate total property count
        const propCount = this.countProperties(result);
        if (propCount > maxProperties) {
            warnings.push(
                `Total property count is ${propCount}, which exceeds the recommended limit of ${maxProperties}`
            );
        }

        return { schema: result, warnings };
    }

    private inlineRefs(
        node: any,
        defs: Record<string, any>,
        visited: Set<string>,
        warnings: string[]
    ): any {
        if (node === null || node === undefined || typeof node !== 'object') {
            return node;
        }

        if (Array.isArray(node)) {
            return node.map((item) => this.inlineRefs(item, defs, visited, warnings));
        }

        // If this node is a $ref, inline it
        if (node.$ref && typeof node.$ref === 'string') {
            const refPath = node.$ref;
            const match = refPath.match(/#\/\$defs\/(.+)$/);
            if (match) {
                const defName = match[1];
                if (visited.has(defName)) {
                    throw new Error(
                        'Recursive schemas are not supported in LLM structured output mode'
                    );
                }
                const def = defs[defName];
                if (!def) {
                    warnings.push(`Could not resolve $ref "${refPath}"`);
                    return node;
                }
                // Deep clone the definition and continue inlining
                const cloned = JSON.parse(JSON.stringify(def));
                const newVisited = new Set(visited);
                newVisited.add(defName);
                return this.inlineRefs(cloned, defs, newVisited, warnings);
            }
            // Non-$defs ref — leave as-is but warn
            warnings.push(`Could not resolve $ref "${refPath}"`);
            return node;
        }

        // Recurse into all properties
        const result: any = {};
        for (const key of Object.keys(node)) {
            result[key] = this.inlineRefs(node[key], defs, visited, warnings);
        }
        return result;
    }

    private isMapSchema(node: any): boolean {
        if (node === null || node === undefined || typeof node !== 'object') {
            return false;
        }
        // Direct map: { type: 'object', additionalProperties: <schema>, no properties }
        if (
            node.type === 'object' &&
            typeof node.additionalProperties !== 'boolean' &&
            node.additionalProperties !== undefined &&
            !node.properties
        ) {
            return true;
        }
        // Nullable map via anyOf wrapper: e.g. { anyOf: [{ type: 'null' }, <mapSchema>] }
        if (Array.isArray(node.anyOf)) {
            return node.anyOf.some((variant: any) => this.isMapSchema(variant));
        }
        return false;
    }

    private omitMapFields(node: any, path: string, warnings: string[]): void {
        if (node === null || node === undefined || typeof node !== 'object') {
            return;
        }

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                this.omitMapFields(node[i], `${path}[${i}]`, warnings);
            }
            return;
        }

        // If this node has properties, check each property for map schemas
        if (node.properties && typeof node.properties === 'object') {
            const keysToRemove: string[] = [];

            for (const key of Object.keys(node.properties)) {
                const prop = node.properties[key];

                // Check if property itself is a map
                if (this.isMapSchema(prop)) {
                    keysToRemove.push(key);
                    continue;
                }

                // Check if property is an array whose items is a map
                if (
                    prop &&
                    prop.type === 'array' &&
                    prop.items &&
                    this.isMapSchema(prop.items)
                ) {
                    keysToRemove.push(key);
                    continue;
                }
            }

            for (const key of keysToRemove) {
                const fieldPath = path ? `${path}.${key}` : key;
                warnings.push(
                    `Omitted map field '${fieldPath}': map/dictionary types are not supported in LLM structured output mode`
                );
                delete node.properties[key];
                if (Array.isArray(node.required)) {
                    node.required = node.required.filter((r: string) => r !== key);
                }
            }

            // Recurse into remaining properties
            for (const key of Object.keys(node.properties)) {
                const childPath = path ? `${path}.${key}` : key;
                this.omitMapFields(node.properties[key], childPath, warnings);
            }
        }

        // Recurse into array items
        if (node.items && typeof node.items === 'object' && !Array.isArray(node.items)) {
            this.omitMapFields(node.items, `${path}.items`, warnings);
        }

        // Recurse into anyOf/allOf/oneOf
        for (const compositionKey of ['anyOf', 'allOf', 'oneOf']) {
            if (Array.isArray(node[compositionKey])) {
                for (let i = 0; i < node[compositionKey].length; i++) {
                    this.omitMapFields(
                        node[compositionKey][i],
                        `${path}.${compositionKey}[${i}]`,
                        warnings
                    );
                }
            }
        }
    }

    private enforceStrictObjects(node: any, warnings: string[]): void {
        if (node === null || node === undefined || typeof node !== 'object') {
            return;
        }

        if (Array.isArray(node)) {
            for (const item of node) {
                this.enforceStrictObjects(item, warnings);
            }
            return;
        }

        // If this is an object type schema, enforce strictness
        if (node.type === 'object' && node.properties) {
            node.additionalProperties = false;
            node.required = Object.keys(node.properties);
        }

        // Recurse into all values
        for (const key of Object.keys(node)) {
            if (key === 'additionalProperties' && typeof node[key] === 'boolean') {
                continue;
            }
            this.enforceStrictObjects(node[key], warnings);
        }
    }

    private stripUnsupportedKeywords(node: any, path: string, warnings: string[]): void {
        if (node === null || node === undefined || typeof node !== 'object') {
            return;
        }

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                this.stripUnsupportedKeywords(node[i], `${path}[${i}]`, warnings);
            }
            return;
        }

        for (const keyword of UNSUPPORTED_KEYWORDS) {
            if (keyword in node) {
                const fieldPath = path || 'root';
                warnings.push(`Dropped '${keyword}' constraint from ${fieldPath}`);
                delete node[keyword];
            }
        }

        // Recurse
        for (const key of Object.keys(node)) {
            const childPath = path ? `${path}.${key}` : key;
            this.stripUnsupportedKeywords(node[key], childPath, warnings);
        }
    }

    private measureObjectDepth(node: any, currentLevel: number): number {
        if (node === null || node === undefined || typeof node !== 'object') {
            return currentLevel;
        }

        if (Array.isArray(node)) {
            let maxDepth = currentLevel;
            for (const item of node) {
                maxDepth = Math.max(maxDepth, this.measureObjectDepth(item, currentLevel));
            }
            return maxDepth;
        }

        // If this is an object-type schema node, it counts as a level
        const isObjectSchema = node.type === 'object' && node.properties;
        const level = isObjectSchema ? currentLevel + 1 : currentLevel;

        let maxDepth = level;
        if (node.properties) {
            for (const key of Object.keys(node.properties)) {
                maxDepth = Math.max(
                    maxDepth,
                    this.measureObjectDepth(node.properties[key], level)
                );
            }
        }

        // Also check items (arrays)
        if (node.items && typeof node.items === 'object' && !Array.isArray(node.items)) {
            maxDepth = Math.max(maxDepth, this.measureObjectDepth(node.items, level));
        }

        // Check anyOf, allOf, oneOf
        for (const compositionKey of ['anyOf', 'allOf', 'oneOf']) {
            if (Array.isArray(node[compositionKey])) {
                for (const item of node[compositionKey]) {
                    maxDepth = Math.max(maxDepth, this.measureObjectDepth(item, level));
                }
            }
        }

        return maxDepth;
    }

    private countProperties(node: any): number {
        if (node === null || node === undefined || typeof node !== 'object') {
            return 0;
        }

        if (Array.isArray(node)) {
            let count = 0;
            for (const item of node) {
                count += this.countProperties(item);
            }
            return count;
        }

        let count = 0;
        if (node.properties) {
            count += Object.keys(node.properties).length;
            for (const key of Object.keys(node.properties)) {
                count += this.countProperties(node.properties[key]);
            }
        }

        // Count in items
        if (node.items && typeof node.items === 'object' && !Array.isArray(node.items)) {
            count += this.countProperties(node.items);
        }

        // Count in compositions
        for (const compositionKey of ['anyOf', 'allOf', 'oneOf']) {
            if (Array.isArray(node[compositionKey])) {
                for (const item of node[compositionKey]) {
                    count += this.countProperties(item);
                }
            }
        }

        return count;
    }
}

export function exportLlmSchema(schema: Schema, options?: LlmSchemaExportOptions): LlmSchemaResult {
    const exporter = new LlmSchemaExporter();
    return exporter.export(schema, options);
}
