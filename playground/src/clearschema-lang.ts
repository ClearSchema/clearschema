import { StreamLanguage, StringStream } from '@codemirror/language';

const clearschemaMode = {
  startState() {
    return {};
  },

  token(stream: StringStream): string | null {
    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Comments
    if (stream.match(/#.*$/)) return 'comment';

    // Directives: @namespace, @version, @targets
    if (stream.match(/^@(namespace|version|targets)\b/)) return 'keyword';

    // $defs:
    if (stream.match(/^\$defs:/)) return 'keyword';

    // import:
    if (stream.match(/^import:/)) return 'keyword';

    // Block modifier line: ^ key: value
    if (stream.match(/^\^/)) {
      stream.eatSpace();
      // Modifier name
      if (stream.match(/[\w.]+/)) {
        stream.eatSpace();
        if (stream.eat(':')) {
          stream.eatSpace();
          // Rest is the value
          stream.skipToEnd();
          return 'string';
        }
        return 'attributeName';
      }
      return 'attributeName';
    }

    // Array item: - type
    if (stream.match(/^-\s+/)) {
      // The rest could be a type
      if (stream.match(/\b(string|number|integer|boolean|null|object|array)\b/)) {
        return 'typeName';
      }
      if (stream.match(/\$ref\b/)) return 'typeName';
      if (stream.match(/\b(allOf|anyOf|oneOf)\b/)) return 'typeName';
      stream.skipToEnd();
      return null;
    }

    // Field line: name: type.modifiers: description
    // Try to match field name followed by colon
    if (stream.match(/[\w-]+(?=\s*:)/)) {
      return 'variableName';
    }

    // Colon separator
    if (stream.eat(':')) {
      stream.eatSpace();

      // After colon, try matching types
      if (stream.match(/\b(string|number|integer|boolean|null|object|array)\b/)) {
        // Eat modifiers like .required, .nullable, .tuple
        while (stream.match(/\.(required|nullable|tuple)\b/)) { /* keep eating */ }
        // Check for union types
        while (stream.eat('|')) {
          stream.match(/\b(string|number|integer|boolean|null|object|array)\b/);
          while (stream.match(/\.(required|nullable|tuple)\b/)) { /* keep eating */ }
        }
        return 'typeName';
      }

      if (stream.match(/\$ref\b/)) {
        while (stream.match(/\.(required|nullable)\b/)) { /* keep eating */ }
        return 'typeName';
      }

      if (stream.match(/\b(allOf|anyOf|oneOf)\b/)) {
        while (stream.match(/\.(required|nullable)\b/)) { /* keep eating */ }
        return 'typeName';
      }

      // After type + modifiers, remaining text on the line is description
      if (stream.skipTo(':')) {
        stream.next(); // consume the colon
        stream.eatSpace();
        stream.skipToEnd();
        return 'string';
      }

      // Otherwise just consume to end
      stream.skipToEnd();
      return 'string';
    }

    // Modifiers standalone
    if (stream.match(/\.(required|nullable|tuple)\b/)) return 'modifier';

    // Types standalone
    if (stream.match(/\b(string|number|integer|boolean|null|object|array)\b/)) return 'typeName';
    if (stream.match(/\$ref\b/)) return 'typeName';
    if (stream.match(/\b(allOf|anyOf|oneOf)\b/)) return 'typeName';

    // Union pipe
    if (stream.eat('|')) return 'operator';

    // Numbers
    if (stream.match(/\b\d+(\.\d+)?\b/)) return 'number';

    // Booleans
    if (stream.match(/\b(true|false)\b/)) return 'bool';

    // Quoted strings
    if (stream.eat('"')) {
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"') break;
        if (ch === '\\') stream.next();
      }
      return 'string';
    }

    // Consume unknown character
    stream.next();
    return null;
  },
};

export const clearschemaLanguage = StreamLanguage.define(clearschemaMode);
