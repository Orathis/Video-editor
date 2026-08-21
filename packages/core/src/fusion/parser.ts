import type {
  FusionIdentifierValue,
  FusionTableEntry,
  FusionTableValue,
  FusionValue,
} from "./types";
import { FusionParseError } from "./types";

const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_DEPTH = 160;
const MAX_ENTRIES = 1_000_000;

type TokenKind =
  | "identifier"
  | "number"
  | "string"
  | "{"
  | "}"
  | "["
  | "]"
  | "("
  | ")"
  | "="
  | ","
  | ";"
  | "eof";

interface Token {
  kind: TokenKind;
  text: string;
  value?: string | number;
  line: number;
  column: number;
}

class Lexer {
  private offset = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly source: string) {}

  next(): Token {
    this.skipTrivia();
    const line = this.line;
    const column = this.column;
    if (this.offset >= this.source.length) return { kind: "eof", text: "", line, column };
    const char = this.source[this.offset] ?? "";
    if (char === "[" && this.source[this.offset + 1] === "[") {
      return this.readLongString(line, column);
    }
    if ("{}[]()=,;".includes(char)) {
      this.advance();
      return { kind: char as TokenKind, text: char, line, column };
    }
    if (char === '"' || char === "'") return this.readString(char, line, column);
    if (this.isNumberStart(char)) return this.readNumber(line, column);
    if (/[A-Za-z_$]/.test(char)) return this.readIdentifier(line, column);
    throw new FusionParseError(`Unexpected character ${JSON.stringify(char)}`, line, column);
  }

  private skipTrivia(): void {
    for (;;) {
      while (/\s/.test(this.source[this.offset] ?? "")) this.advance();
      if (this.source.slice(this.offset, this.offset + 2) !== "--") return;
      this.advance();
      this.advance();
      if (this.source.slice(this.offset, this.offset + 2) === "[[") {
        this.advance();
        this.advance();
        while (
          this.offset < this.source.length &&
          this.source.slice(this.offset, this.offset + 2) !== "]]"
        ) {
          this.advance();
        }
        if (this.offset < this.source.length) {
          this.advance();
          this.advance();
        }
      } else {
        while (this.offset < this.source.length && this.source[this.offset] !== "\n")
          this.advance();
      }
    }
  }

  private readIdentifier(line: number, column: number): Token {
    const start = this.offset;
    while (/[A-Za-z0-9_.$:-]/.test(this.source[this.offset] ?? "")) this.advance();
    const text = this.source.slice(start, this.offset);
    return { kind: "identifier", text, value: text, line, column };
  }

  private readNumber(line: number, column: number): Token {
    const start = this.offset;
    if (/[+-]/.test(this.source[this.offset] ?? "")) this.advance();
    if (this.source.slice(this.offset, this.offset + 2).toLowerCase() === "0x") {
      this.advance();
      this.advance();
      while (/[0-9a-f]/i.test(this.source[this.offset] ?? "")) this.advance();
    } else {
      while (/\d/.test(this.source[this.offset] ?? "")) this.advance();
      if (this.source[this.offset] === ".") {
        this.advance();
        while (/\d/.test(this.source[this.offset] ?? "")) this.advance();
      }
      if (/[eE]/.test(this.source[this.offset] ?? "")) {
        this.advance();
        if (/[+-]/.test(this.source[this.offset] ?? "")) this.advance();
        while (/\d/.test(this.source[this.offset] ?? "")) this.advance();
      }
    }
    const text = this.source.slice(start, this.offset);
    const value = Number(text);
    if (!Number.isFinite(value)) throw new FusionParseError(`Invalid number ${text}`, line, column);
    return { kind: "number", text, value, line, column };
  }

  private readString(quote: string, line: number, column: number): Token {
    this.advance();
    let value = "";
    while (this.offset < this.source.length) {
      const char = this.source[this.offset] ?? "";
      this.advance();
      if (char === quote) return { kind: "string", text: value, value, line, column };
      if (char !== "\\") {
        value += char;
        continue;
      }
      const escaped = this.source[this.offset] ?? "";
      this.advance();
      const replacements: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        "\\": "\\",
        '"': '"',
        "'": "'",
      };
      value += replacements[escaped] ?? escaped;
    }
    throw new FusionParseError("Unterminated string", line, column);
  }

  private readLongString(line: number, column: number): Token {
    this.advance();
    this.advance();
    const start = this.offset;
    while (
      this.offset < this.source.length &&
      this.source.slice(this.offset, this.offset + 2) !== "]]"
    ) {
      this.advance();
    }
    if (this.offset >= this.source.length)
      throw new FusionParseError("Unterminated long string", line, column);
    const value = this.source.slice(start, this.offset);
    this.advance();
    this.advance();
    return { kind: "string", text: value, value, line, column };
  }

  private isNumberStart(char: string): boolean {
    if (/\d/.test(char)) return true;
    if (char === ".") return /\d/.test(this.source[this.offset + 1] ?? "");
    return /[+-]/.test(char) && /[\d.]/.test(this.source[this.offset + 1] ?? "");
  }

  private advance(): void {
    if (this.source[this.offset] === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.offset++;
  }
}

class Parser {
  private current: Token;
  private nextToken: Token;
  private entryCount = 0;

  constructor(private readonly lexer: Lexer) {
    this.current = lexer.next();
    this.nextToken = lexer.next();
  }

  parse(): FusionTableValue {
    if (this.current.kind === "identifier" && this.current.text === "return") this.advance();
    const value = this.parseValue(0);
    if (!isFusionTable(value)) this.fail("Fusion document must contain a table");
    if (this.current.kind !== "eof") this.fail("Unexpected content after Fusion document");
    return value;
  }

  private parseValue(depth: number): FusionValue {
    if (depth > MAX_DEPTH) this.fail(`Fusion nesting exceeds ${MAX_DEPTH} levels`);
    if (this.current.kind === "number") {
      const value = this.current.value as number;
      this.advance();
      return value;
    }
    if (this.current.kind === "string") {
      const value = this.current.value as string;
      this.advance();
      return value;
    }
    if (this.current.kind === "{") return this.parseTable(null, depth + 1);
    if (this.current.kind !== "identifier") this.fail("Expected a Fusion value");
    const name = this.current.text;
    this.advance();
    if (name === "true") return true;
    if (name === "false") return false;
    if (name === "nil") return null;
    if ((this.current.kind as TokenKind) === "(") {
      if (name !== "ordered") this.fail(`Function calls are not allowed in Fusion data (${name})`);
      this.skipCall(depth + 1);
    }
    if ((this.current.kind as TokenKind) === "{") return this.parseTable(name, depth + 1);
    return { kind: "identifier", name } satisfies FusionIdentifierValue;
  }

  private parseTable(tag: string | null, depth: number): FusionTableValue {
    this.expect("{");
    const entries: FusionTableEntry[] = [];
    while (this.current.kind !== "}") {
      if (this.current.kind === "eof") this.fail("Unterminated Fusion table");
      let key: string | number | null = null;
      if (this.current.kind === "[") {
        this.advance();
        const keyValue = this.parseValue(depth + 1);
        if (typeof keyValue !== "string" && typeof keyValue !== "number") {
          this.fail("Table index must be a string or number");
        }
        key = keyValue;
        this.expect("]");
        this.expect("=");
      } else if (
        (this.current.kind === "identifier" || this.current.kind === "string") &&
        this.nextToken.kind === "="
      ) {
        key = String(this.current.value ?? this.current.text);
        this.advance();
        this.expect("=");
      }
      entries.push({ key, value: this.parseValue(depth + 1) });
      this.entryCount++;
      if (this.entryCount > MAX_ENTRIES)
        this.fail(`Fusion document exceeds ${MAX_ENTRIES} entries`);
      if (this.current.kind === "," || this.current.kind === ";") this.advance();
    }
    this.expect("}");
    return { kind: "table", tag, entries };
  }

  private skipCall(depth: number): void {
    this.expect("(");
    while (this.current.kind !== ")") {
      if (this.current.kind === "eof") this.fail("Unterminated function call");
      this.parseValue(depth + 1);
      if (this.current.kind === ",") this.advance();
    }
    this.expect(")");
  }

  private expect(kind: TokenKind): void {
    if (this.current.kind !== kind) this.fail(`Expected ${kind}, received ${this.current.kind}`);
    this.advance();
  }

  private advance(): void {
    this.current = this.nextToken;
    this.nextToken = this.lexer.next();
  }

  private fail(message: string): never {
    throw new FusionParseError(message, this.current.line, this.current.column);
  }
}

export function isFusionTable(value: FusionValue | undefined): value is FusionTableValue {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "table";
}

export function fusionEntry(
  table: FusionTableValue,
  key: string | number,
): FusionValue | undefined {
  return table.entries.find((entry) => entry.key === key)?.value;
}

export function fusionPositional(table: FusionTableValue): FusionValue[] {
  return table.entries.filter((entry) => entry.key === null).map((entry) => entry.value);
}

export function parseFusionValue(source: string): FusionTableValue {
  if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) {
    throw new FusionParseError(`Fusion source exceeds ${MAX_SOURCE_BYTES} bytes`, 1, 1);
  }
  return new Parser(new Lexer(source.replace(/^\uFEFF/, ""))).parse();
}
