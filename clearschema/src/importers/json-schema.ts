import {
    Schema,
    Field,
    FieldTypeName,
    StringField,
    NumberField,
    BooleanField,
    NullField,
    ObjectField,
    ArrayField,
    MapField,
    TupleArrayField,
    UnionField,
    RefField,
    CompositionField,
    MatchField,
    SchemaDefinition,
    SourceLocation,
    Modifier,
    BaseField,
} from '../ast/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ImportResult {
    schema: Schema;
    warnings: string[];
}

export interface JsonSchemaImportOptions {
    /** Fallback draft when `$schema` URI and heuristics are inconclusive. Default: '2020-12' */
    defaultDraft?: '2020-12' | '2019-09' | 'draft-07';
}

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

function syntheticLocation(): SourceLocation {
    return {
        start: { line: 0, column: 0, offset: 0 },
        end: { line: 0, column: 0, offset: 0 },
    };
}

function createBaseField(
    name: string,
    type: FieldTypeName,
    description: string,
): BaseField {
    return {
        name,
        type,
        description,
        required: false,
        nullable: false,
        rawModifiers: {},
        modifiers: [] as Modifier[],
        location: syntheticLocation(),
    };
}

/** Returns true when `obj` is `{ type: "null" }` with no other meaningful keys. */
function isNullOnlySchema(obj: any): boolean {
    if (obj == null || typeof obj !== 'object') return false;
    const keys = Object.keys(obj).filter(k => k !== 'type');
    return obj.type === 'null' && keys.length === 0;
}

/** Returns true when `obj` is a simple `{ type: "<primitive>" }` with no extra keys. */
function isSimplePrimitiveSchema(obj: any): boolean {
    if (obj == null || typeof obj !== 'object') return false;
    const keys = Object.keys(obj).filter(k => k !== 'type');
    const primitives: string[] = ['string', 'number', 'integer', 'boolean', 'null'];
    return primitives.includes(obj.type) && keys.length === 0;
}

// Unsupported keywords that we want to warn about
const UNSUPPORTED_KEYWORDS = [
    'patternProperties',
    'if',
    'then',
    'else',
    'dependentSchemas',
    'not',
    'examples',
];

// ---------------------------------------------------------------------------
// Importer class
// ---------------------------------------------------------------------------

export class JsonSchemaImporter {
    private warnings: string[] = [];

    import(jsonSchema: any, options?: JsonSchemaImportOptions): ImportResult {
        this.warnings = [];

        const draft = this.detectDraft(jsonSchema, options);
        const definitions = this.importDefinitions(jsonSchema, draft);
        const requiredSet = new Set<string>(
            Array.isArray(jsonSchema.required) ? jsonSchema.required : [],
        );

        const fields = this.importFields(jsonSchema.properties ?? {}, requiredSet);

        // Warn on unsupported top-level keywords
        this.warnUnsupported(jsonSchema, '(root)');

        const schema: Schema = {
            imports: [],
            definitions,
            fields,
            location: syntheticLocation(),
        };

        return { schema, warnings: [...this.warnings] };
    }

    // -----------------------------------------------------------------------
    // Draft detection
    // -----------------------------------------------------------------------

    private detectDraft(
        jsonSchema: any,
        options?: JsonSchemaImportOptions,
    ): string {
        const uri = jsonSchema.$schema;
        if (typeof uri === 'string') {
            if (uri.includes('2020-12')) return '2020-12';
            if (uri.includes('2019-09')) return '2019-09';
            if (uri.includes('draft-07')) return 'draft-07';
        }

        // Heuristic: presence of $defs / definitions
        const hasDefs = jsonSchema.$defs !== undefined;
        const hasDefinitions = jsonSchema.definitions !== undefined;

        if (hasDefs && hasDefinitions) return '2019-09';
        if (hasDefs) return '2020-12';
        if (hasDefinitions) return 'draft-07';

        return options?.defaultDraft ?? '2020-12';
    }

    // -----------------------------------------------------------------------
    // Definitions
    // -----------------------------------------------------------------------

    private importDefinitions(jsonSchema: any, _draft: string): SchemaDefinition[] {
        const defs: SchemaDefinition[] = [];
        const defsObj = jsonSchema.$defs ?? jsonSchema.definitions ?? {};

        for (const [name, value] of Object.entries(defsObj)) {
            const field = this.importField(name, value as any);
            defs.push({
                name,
                field,
                location: syntheticLocation(),
            });
        }

        return defs;
    }

    // -----------------------------------------------------------------------
    // Fields
    // -----------------------------------------------------------------------

    private importFields(
        properties: Record<string, any>,
        requiredSet: Set<string>,
    ): Field[] {
        const fields: Field[] = [];
        for (const [name, value] of Object.entries(properties)) {
            const field = this.importField(name, value as any);
            field.required = requiredSet.has(name);
            fields.push(field);
        }
        return fields;
    }

    // -----------------------------------------------------------------------
    // Single field import (main dispatcher)
    // -----------------------------------------------------------------------

    private importField(name: string, obj: any): Field {
        if (obj == null || typeof obj !== 'object') {
            this.warnings.push(`Field "${name}": schema value is not an object`);
            return { ...createBaseField(name, 'object', ''), fields: [] } as ObjectField;
        }

        // Warn on unsupported keywords
        this.warnUnsupported(obj, name);

        // $ref
        if (obj.$ref !== undefined) {
            return this.importRef(name, obj);
        }

        // anyOf disambiguation
        if (Array.isArray(obj.anyOf)) {
            return this.importAnyOf(name, obj);
        }

        // allOf / oneOf
        if (Array.isArray(obj.allOf)) {
            return this.importComposition(name, obj, 'allOf');
        }
        if (Array.isArray(obj.oneOf)) {
            // Tier 1: Explicit OpenAPI discriminator annotation
            if (obj.discriminator?.propertyName) {
                return this.importDiscriminatedUnion(name, obj, obj.discriminator.propertyName);
            }

            // Tier 2: All variants share a property with a const value
            const sharedProp = this.findSharedConstProperty(obj.oneOf);
            if (sharedProp) {
                return this.importDiscriminatedUnion(name, obj, sharedProp);
            }

            return this.importComposition(name, obj, 'oneOf');
        }

        // Tuple detection (2020-12)
        if (Array.isArray(obj.prefixItems) && obj.items === false) {
            return this.importTuple(name, obj);
        }

        // Tuple detection (Draft-07): items as array
        if (Array.isArray(obj.items) && obj.additionalItems === false) {
            return this.importTupleDraft07(name, obj);
        }

        const type = obj.type;

        switch (type) {
            case 'string':
                return this.importString(name, obj);
            case 'number':
            case 'integer':
                return this.importNumber(name, obj);
            case 'boolean':
                return this.importBoolean(name, obj);
            case 'null':
                return this.importNull(name, obj);
            case 'object':
                return this.importObjectOrMap(name, obj);
            case 'array':
                return this.importArray(name, obj);
            default:
                if (type !== undefined) {
                    this.warnings.push(
                        `Field "${name}": unrecognized type "${type}", falling back to ObjectField`,
                    );
                }
                return {
                    ...createBaseField(name, 'object', obj.description ?? ''),
                    fields: [],
                    ...this.universalModifiers(obj),
                } as ObjectField;
        }
    }

    // -----------------------------------------------------------------------
    // Primitive types
    // -----------------------------------------------------------------------

    private importString(name: string, obj: any): StringField {
        const field: StringField = {
            ...createBaseField(name, 'string', obj.description ?? ''),
            type: 'string',
            ...this.universalModifiers(obj),
        };
        if (obj.minLength !== undefined) field.minLength = obj.minLength;
        if (obj.maxLength !== undefined) field.maxLength = obj.maxLength;
        if (obj.pattern !== undefined) field.pattern = obj.pattern;
        if (obj.format !== undefined) field.format = obj.format;
        return field;
    }

    private importNumber(name: string, obj: any): NumberField {
        const numType = obj.type as 'number' | 'integer';
        const field: NumberField = {
            ...createBaseField(name, numType, obj.description ?? ''),
            type: numType,
            ...this.universalModifiers(obj),
        };
        if (obj.minimum !== undefined) field.min = obj.minimum;
        if (obj.maximum !== undefined) field.max = obj.maximum;
        if (obj.exclusiveMinimum !== undefined) field.exclusiveMin = obj.exclusiveMinimum;
        if (obj.exclusiveMaximum !== undefined) field.exclusiveMax = obj.exclusiveMaximum;
        if (obj.multipleOf !== undefined) field.multipleOf = obj.multipleOf;
        return field;
    }

    private importBoolean(name: string, obj: any): BooleanField {
        return {
            ...createBaseField(name, 'boolean', obj.description ?? ''),
            type: 'boolean',
            ...this.universalModifiers(obj),
        };
    }

    private importNull(name: string, obj: any): NullField {
        return {
            ...createBaseField(name, 'null', obj.description ?? ''),
            type: 'null',
            ...this.universalModifiers(obj),
        };
    }

    // -----------------------------------------------------------------------
    // Object / Map
    // -----------------------------------------------------------------------

    private importObjectOrMap(name: string, obj: any): ObjectField | MapField {
        const hasProperties =
            obj.properties !== undefined &&
            Object.keys(obj.properties).length > 0;
        const hasAdditionalProperties =
            obj.additionalProperties !== undefined &&
            obj.additionalProperties !== false &&
            typeof obj.additionalProperties === 'object';

        // Map: additionalProperties schema, no real properties
        if (hasAdditionalProperties && !hasProperties) {
            return this.importMap(name, obj);
        }

        // Object with both properties and additionalProperties schema -> warn
        if (hasAdditionalProperties && hasProperties) {
            this.warnings.push(
                `Field "${name}": object has both "properties" and "additionalProperties" schema; additionalProperties will be dropped`,
            );
        }

        return this.importObject(name, obj);
    }

    private importObject(name: string, obj: any): ObjectField {
        const requiredSet = new Set<string>(
            Array.isArray(obj.required) ? obj.required : [],
        );
        const fields = this.importFields(obj.properties ?? {}, requiredSet);

        return {
            ...createBaseField(name, 'object', obj.description ?? ''),
            type: 'object',
            fields,
            ...this.universalModifiers(obj),
        };
    }

    private importMap(name: string, obj: any): MapField {
        const valueSchema = obj.additionalProperties;
        let valueType: Field | FieldTypeName;

        if (
            typeof valueSchema === 'object' &&
            valueSchema.type &&
            Object.keys(valueSchema).length === 1
        ) {
            // Simple type shorthand
            valueType = valueSchema.type as FieldTypeName;
        } else {
            valueType = this.importField('(value)', valueSchema);
        }

        return {
            ...createBaseField(name, 'map', obj.description ?? ''),
            type: 'map',
            valueType,
            ...this.universalModifiers(obj),
        };
    }

    // -----------------------------------------------------------------------
    // Array / Tuple
    // -----------------------------------------------------------------------

    private importArray(name: string, obj: any): ArrayField {
        let itemType: Field | FieldTypeName;

        if (obj.items) {
            if (
                typeof obj.items === 'object' &&
                !Array.isArray(obj.items) &&
                obj.items.type &&
                Object.keys(obj.items).length === 1
            ) {
                itemType = obj.items.type as FieldTypeName;
            } else if (typeof obj.items === 'object' && !Array.isArray(obj.items)) {
                itemType = this.importField('(item)', obj.items);
            } else {
                itemType = 'string'; // fallback
            }
        } else {
            itemType = 'string'; // fallback
        }

        const field: ArrayField = {
            ...createBaseField(name, 'array', obj.description ?? ''),
            type: 'array',
            itemType,
            ...this.universalModifiers(obj),
        };
        if (obj.minItems !== undefined) field.minItems = obj.minItems;
        if (obj.maxItems !== undefined) field.maxItems = obj.maxItems;
        if (obj.uniqueItems !== undefined) field.uniqueItems = obj.uniqueItems;
        return field;
    }

    private importTuple(name: string, obj: any): TupleArrayField {
        const items = (obj.prefixItems as any[]).map((item, i) =>
            this.importField(`(item${i})`, item),
        );
        return {
            ...createBaseField(name, 'array.tuple', obj.description ?? ''),
            type: 'array.tuple',
            items,
            ...this.universalModifiers(obj),
        };
    }

    private importTupleDraft07(name: string, obj: any): TupleArrayField {
        const items = (obj.items as any[]).map((item, i) =>
            this.importField(`(item${i})`, item),
        );
        return {
            ...createBaseField(name, 'array.tuple', obj.description ?? ''),
            type: 'array.tuple',
            items,
            ...this.universalModifiers(obj),
        };
    }

    // -----------------------------------------------------------------------
    // $ref
    // -----------------------------------------------------------------------

    private importRef(name: string, obj: any): RefField {
        let ref: string = obj.$ref;

        // Normalize #/definitions/ to #/$defs/
        ref = ref.replace(/^#\/definitions\//, '#/$defs/');

        // Warn on external refs
        if (!ref.startsWith('#')) {
            this.warnings.push(
                `Field "${name}": external $ref "${ref}" cannot be resolved; stored as-is`,
            );
        }

        return {
            ...createBaseField(name, 'ref', obj.description ?? ''),
            type: 'ref',
            ref,
            ...this.universalModifiers(obj),
        };
    }

    // -----------------------------------------------------------------------
    // anyOf disambiguation
    // -----------------------------------------------------------------------

    private importAnyOf(name: string, obj: any): Field {
        const elements: any[] = obj.anyOf;

        // Empty anyOf — treat as composition (degenerate case)
        if (elements.length === 0) {
            return this.importComposition(name, obj, 'anyOf');
        }

        // Case 1: Nullable — exactly 2 elements, one is { type: "null" }
        if (elements.length === 2) {
            const nullIndex = elements.findIndex(isNullOnlySchema);
            if (nullIndex !== -1) {
                const otherIndex = nullIndex === 0 ? 1 : 0;
                const other = elements[otherIndex];
                const field = this.importField(name, other);
                field.nullable = true;

                // Merge outer-level modifiers (inner takes precedence)
                if (obj.description !== undefined && !field.description) {
                    field.description = obj.description;
                }
                if (obj.default !== undefined && field.default === undefined) {
                    field.default = obj.default;
                }
                if (obj.const !== undefined && field.const === undefined) {
                    field.const = obj.const;
                }
                if (obj.enum !== undefined && field.enum === undefined) {
                    field.enum = obj.enum;
                }

                return field;
            }
        }

        // Case 2: Union — all elements are simple { type: "<primitive>" }
        if (elements.every(isSimplePrimitiveSchema)) {
            const types = elements.map((e: any) => e.type as FieldTypeName);
            return {
                ...createBaseField(name, 'union', obj.description ?? ''),
                type: 'union',
                types,
                ...this.universalModifiers(obj),
            } as UnionField;
        }

        // Case 3: CompositionField
        return this.importComposition(name, obj, 'anyOf');
    }

    // -----------------------------------------------------------------------
    // Composition (allOf / anyOf / oneOf)
    // -----------------------------------------------------------------------

    private importComposition(
        name: string,
        obj: any,
        compositionType: 'allOf' | 'anyOf' | 'oneOf',
    ): CompositionField {
        const elements: any[] = obj[compositionType];
        const schemas = elements.map((el, i) =>
            this.importField(`${name}[${i}]`, el),
        ) as (Field | RefField)[];

        return {
            ...createBaseField(name, compositionType, obj.description ?? ''),
            type: compositionType,
            schemas,
            ...this.universalModifiers(obj),
        };
    }

    // -----------------------------------------------------------------------
    // Discriminated union (match)
    // -----------------------------------------------------------------------

    private findSharedConstProperty(variants: any[]): string | null {
        if (variants.length === 0) return null;

        // Filter to inline variants (skip $ref variants)
        const inlineVariants = variants.filter(
            (v: any) =>
                v != null &&
                typeof v === 'object' &&
                v.$ref === undefined &&
                v.properties != null &&
                typeof v.properties === 'object',
        );

        // Need at least one inline variant to detect a discriminator
        if (inlineVariants.length === 0) return null;

        // Find a property name present in ALL inline variants with a const value
        const firstProps = Object.keys(inlineVariants[0].properties);
        for (const propName of firstProps) {
            const propSchema = inlineVariants[0].properties[propName];
            const hasConst =
                propSchema?.const !== undefined ||
                (Array.isArray(propSchema?.enum) && propSchema.enum.length === 1);

            if (!hasConst) continue;

            const allMatch = inlineVariants.every((v: any) => {
                const p = v.properties?.[propName];
                if (!p) return false;
                return (
                    p.const !== undefined ||
                    (Array.isArray(p.enum) && p.enum.length === 1)
                );
            });

            if (allMatch) return propName;
        }

        return null;
    }

    private importDiscriminatedUnion(
        name: string,
        obj: any,
        discriminatorField: string,
    ): MatchField | CompositionField {
        const elements: any[] = obj.oneOf;
        const variants: Record<string, ObjectField | RefField> = {};

        for (const element of elements) {
            if (element.$ref !== undefined) {
                // $ref variant — we cannot extract the const key, use the ref basename
                const ref = this.importRef(name, element);
                const baseName = ref.ref.split('/').pop() ?? ref.ref;
                variants[baseName] = ref;
                continue;
            }

            // Extract variant key from discriminator property
            const discProp = element.properties?.[discriminatorField];
            let variantKey: string;
            if (discProp?.const !== undefined) {
                variantKey = String(discProp.const);
            } else if (Array.isArray(discProp?.enum) && discProp.enum.length === 1) {
                variantKey = String(discProp.enum[0]);
            } else {
                // Cannot determine variant key, fall back to generic composition
                return this.importComposition(name, obj, 'oneOf');
            }

            // Import the variant schema as an object, stripping the discriminator property
            const strippedProperties = { ...element.properties };
            delete strippedProperties[discriminatorField];

            const strippedRequired = Array.isArray(element.required)
                ? element.required.filter((r: string) => r !== discriminatorField)
                : [];

            const strippedElement = {
                ...element,
                properties: strippedProperties,
                required: strippedRequired,
            };

            const imported = this.importObject(variantKey, strippedElement);
            variants[variantKey] = imported;
        }

        return {
            ...createBaseField(name, 'match', obj.description ?? ''),
            type: 'match',
            discriminator: discriminatorField,
            variants,
            ...this.universalModifiers(obj),
        } as MatchField;
    }

    // -----------------------------------------------------------------------
    // Universal modifiers
    // -----------------------------------------------------------------------

    private universalModifiers(obj: any): Pick<Partial<BaseField>, 'const' | 'enum' | 'default'> {
        const mods: Pick<Partial<BaseField>, 'const' | 'enum' | 'default'> = {};
        if (obj.const !== undefined) mods.const = obj.const;
        if (obj.enum !== undefined) mods.enum = obj.enum;
        if (obj.default !== undefined) mods.default = obj.default;
        return mods;
    }

    // -----------------------------------------------------------------------
    // Unsupported keyword warnings
    // -----------------------------------------------------------------------

    private warnUnsupported(obj: any, fieldName: string): void {
        for (const keyword of UNSUPPORTED_KEYWORDS) {
            if (obj[keyword] !== undefined) {
                this.warnings.push(
                    `Field "${fieldName}": unsupported keyword "${keyword}" ignored`,
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Free function wrapper
// ---------------------------------------------------------------------------

export function importJsonSchema(
    input: any,
    options?: JsonSchemaImportOptions,
): ImportResult {
    const importer = new JsonSchemaImporter();
    return importer.import(input, options);
}
