import { SourcePosition, SourceLocation } from '../ast/types';

export class ParseError extends Error {
    constructor(
        message: string,
        public location: SourceLocation,
        public source: string,
        public hint?: string
    ) {
        super(message);
        this.name = 'ParseError';
    }

    format(): string {
        const lines = this.source.split(/\r?\n/);
        const line = lines[this.location.start.line - 1] || '';
        const lineNum = this.location.start.line;
        const col = this.location.start.column;

        let output = `${this.name}: ${this.message}\n`;
        output += `  --> line ${lineNum}:${col}\n`;
        output += `   |\n`;
        output += ` ${lineNum} | ${line}\n`;
        output += `   | ${' '.repeat(Math.max(0, col - 1))}${'^'.repeat(Math.max(1, this.location.end.column - col))}\n`;

        if (this.hint) {
            output += `   |\n`;
            output += `  help: ${this.hint}\n`;
        }

        return output;
    }
}

export function pos(line: number, column: number, offset: number = 0): SourcePosition {
    return { line, column, offset };
}

export function loc(start: SourcePosition, end: SourcePosition): SourceLocation {
    return { start, end };
}
