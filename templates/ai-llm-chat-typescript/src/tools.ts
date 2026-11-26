// Example tools and the validation that runs before any tool does.
//
// The model chooses a tool's arguments, so treat them as untrusted input: check them against the tool's
// schema first, and keep each tool's own checks strict (see `calculate`).
import type { JsonSchema, ToolSpec } from './providers.ts';

export interface Tool {
  spec: ToolSpec;
  run(args: Record<string, unknown>): string;
}

const typeChecks: Record<string, (value: unknown) => boolean> = {
  string: value => typeof value === 'string',
  number: value => typeof value === 'number' && Number.isFinite(value),
  integer: value => Number.isInteger(value),
  boolean: value => typeof value === 'boolean',
  array: value => Array.isArray(value),
  object: value => typeof value === 'object' && value !== null && !Array.isArray(value)
};

/** Returns a message that describes the first problem, or undefined when the arguments fit the schema. */
export function validateArguments(schema: JsonSchema, args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return 'Arguments must be a JSON object.';
  const record = args as Record<string, unknown>;
  for (const name of schema.required) {
    if (!(name in record)) return `Missing required argument '${name}'.`;
  }
  for (const [name, value] of Object.entries(record)) {
    const property = schema.properties[name];
    if (!property) return `Unexpected argument '${name}'.`;
    const check = property.type ? typeChecks[property.type] : undefined;
    if (check && !check(value)) return `Argument '${name}' must be of type ${property.type}.`;
  }
  return undefined;
}

// --- calculate -----------------------------------------------------------------------------------------
// A small recursive-descent parser, so a model-written expression can never run code.

const MAX_EXPRESSION = 200;
const MAX_POWER = 100;
const MAX_DEPTH = 50;

class CalculatorError extends Error {}

class Parser {
  private readonly source: string;
  private position = 0;
  private depth = 0;

  constructor(source: string) {
    this.source = source;
  }

  parse(): number {
    const value = this.expression();
    this.space();
    if (this.position < this.source.length) throw new CalculatorError('Only numbers and + - * / // % ** with parentheses are allowed.');
    return value;
  }

  private space(): void {
    while (this.source[this.position] === ' ' || this.source[this.position] === '\t') this.position++;
  }

  private peek(...options: string[]): string | undefined {
    this.space();
    return options.find(option => this.source.startsWith(option, this.position));
  }

  private expression(): number {
    let left = this.term();
    for (let op = this.peek('+', '-'); op; op = this.peek('+', '-')) {
      this.position += 1;
      const right = this.term();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private term(): number {
    let left = this.unary();
    for (let op = this.peek('//', '*', '/', '%'); op; op = this.peek('//', '*', '/', '%')) {
      if (op === '*' && this.source.startsWith('**', this.position)) break;
      this.position += op.length;
      const right = this.unary();
      if (op !== '*' && right === 0) throw new CalculatorError('division by zero.');
      left = op === '*' ? left * right : op === '/' ? left / right : op === '//' ? Math.floor(left / right) : ((left % right) + right) % right;
    }
    return left;
  }

  private unary(): number {
    const sign = this.peek('+', '-');
    if (sign) {
      this.position += 1;
      this.enter();
      const value = this.unary();
      this.depth--;
      return sign === '-' ? -value : value;
    }
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    if (this.peek('**')) {
      this.position += 2;
      this.enter();
      const exponent = this.unary();
      this.depth--;
      if (Math.abs(exponent) > MAX_POWER || Math.abs(base) > 1e6) throw new CalculatorError('That power is too large.');
      return base ** exponent;
    }
    return base;
  }

  private primary(): number {
    this.space();
    if (this.source[this.position] === '(') {
      this.position++;
      this.enter();
      const value = this.expression();
      this.depth--;
      this.space();
      if (this.source[this.position] !== ')') throw new CalculatorError('could not read that expression.');
      this.position++;
      return value;
    }
    const number = /^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(this.source.slice(this.position));
    if (!number) throw new CalculatorError('Only numbers and + - * / // % ** with parentheses are allowed.');
    this.position += number[0].length;
    return Number(number[0]);
  }

  private enter(): void {
    if (++this.depth > MAX_DEPTH) throw new CalculatorError('the expression is nested too deeply.');
  }
}

export function calculate(expression: string): string {
  if (expression.length > MAX_EXPRESSION) return 'Error: the expression is too long.';
  try {
    const value = new Parser(expression.trim()).parse();
    if (!Number.isFinite(value)) return 'Error: the result is too large.';
    return String(value);
  } catch (error) {
    return error instanceof CalculatorError ? `Error: ${error.message}` : 'Error: could not read that expression.';
  }
}

// --- get_time ------------------------------------------------------------------------------------------

export function getTime(utcOffsetHours = 0, now = new Date()): string {
  if (!(utcOffsetHours >= -14 && utcOffsetHours <= 14)) return 'Error: utc_offset_hours must be between -14 and 14.';
  const shifted = new Date(now.getTime() + utcOffsetHours * 3_600_000);
  const stamp = shifted.toISOString().slice(0, 19).replace('T', ' ');
  const minutes = Math.round(Math.abs(utcOffsetHours) * 60);
  const sign = utcOffsetHours < 0 ? '-' : '+';
  return `${stamp} UTC${sign}${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}`;
}

export function defaultTools(): Tool[] {
  return [
    {
      spec: {
        name: 'calculate',
        description: 'Evaluate an arithmetic expression such as (3 + 4) * 12 / 5.',
        parameters: { type: 'object', properties: { expression: { type: 'string', description: 'The expression.' } }, required: ['expression'] }
      },
      run: args => calculate(args.expression as string)
    },
    {
      spec: {
        name: 'get_time',
        description: 'Get the current date and time at a UTC offset.',
        parameters: {
          type: 'object',
          properties: { utc_offset_hours: { type: 'number', description: 'Hours from UTC, for example 2 or -5.5. Defaults to 0.' } },
          required: []
        }
      },
      run: args => getTime((args.utc_offset_hours as number | undefined) ?? 0)
    }
  ];
}
