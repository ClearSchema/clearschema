export interface SourcePosition {
    line: number;
    column: number;
    offset: number;
}

export interface SourceLocation {
    start: SourcePosition;
    end: SourcePosition;
}

export interface ASTNode {
    location: SourceLocation;
}

export type PrimitiveType = 'string' | 'number' | 'integer' | 'boolean' | 'null';
export type ComplexType = 'object' | 'array' | 'array.tuple' | 'map';
export type CompositionType = 'allOf' | 'anyOf' | 'oneOf';
export type FieldTypeName = PrimitiveType | ComplexType | 'union' | 'ref' | CompositionType;

export interface Modifier extends ASTNode {
    name: string;
    value: ModifierValue;
    typePrefix?: string;
}

export type ModifierValue =
    | string
    | number
    | boolean
    | null
    | ModifierValue[]
    | { [key: string]: ModifierValue };

export interface BaseField extends ASTNode {
    name: string;
    type: FieldTypeName;
    description: string;

    // Universal modifiers (first-class)
    required: boolean;
    nullable: boolean;
    default?: any;
    const?: any;
    enum?: any[];

    // Raw modifiers for unsupported/extension lookups
    rawModifiers: Record<string, any>;

    // Kept for backward compat/completeness during parsing
    modifiers: Modifier[];
}

export interface StringField extends BaseField {
    type: 'string';
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
}

export interface NumberField extends BaseField {
    type: 'number' | 'integer';
    min?: number;
    max?: number;
    exclusiveMin?: number;
    exclusiveMax?: number;
    multipleOf?: number;
}

export interface BooleanField extends BaseField {
    type: 'boolean';
}

export interface NullField extends BaseField {
    type: 'null';
}

export interface ObjectField extends BaseField {
    type: 'object';
    fields: Field[];
}

export interface ArrayField extends BaseField {
    type: 'array';
    itemType: Field | FieldTypeName;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
}

export interface MapField extends BaseField {
    type: 'map';
    valueType: Field | FieldTypeName;
}

export interface TupleArrayField extends BaseField {
    type: 'array.tuple';
    items: Field[];
}

export interface UnionField extends BaseField {
    type: 'union';
    types: FieldTypeName[];
}

export interface RefField extends BaseField {
    type: 'ref';
    ref: string;
    resolvedRef?: Field;
}

export interface CompositionField extends BaseField {
    type: CompositionType;
    schemas: (Field | RefField)[];
}

export type Field =
    | StringField
    | NumberField
    | BooleanField
    | NullField
    | ObjectField
    | ArrayField
    | MapField
    | TupleArrayField
    | UnionField
    | RefField
    | CompositionField;

export interface SchemaDefinition extends ASTNode {
    name: string;
    field: Field;
}

export interface ImportDeclaration extends ASTNode {
    path: string;
    definitions: string[];
    resolved?: boolean;
}

export interface Schema extends ASTNode {
    namespace?: string;
    version?: string;
    targets?: string[];
    imports: ImportDeclaration[];
    definitions: SchemaDefinition[];
    fields: Field[];
    errors?: Error[];
}
