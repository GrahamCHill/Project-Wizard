import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AgentError, runTurn } from '../src/agent.ts';
import type { HistoryItem, JsonSchema, Provider, ToolCall, Turn } from '../src/providers.ts';
import { calculate, defaultTools, getTime, validateArguments, type Tool } from '../src/tools.ts';

describe('calculate', () => {
  it('evaluates arithmetic', () => {
    for (const [expression, expected] of [['2 + 3 * 4', '14'], ['(1 + 2) ** 3', '27'], ['7 / 2', '3.5'], ['-4 + +6', '2'], ['10 // 3', '3'], ['10 % 4', '2'], ['2 ** 3 ** 2', '512'], ['-2 ** 2', '-4'], ['1e3 + 1', '1001']]) {
      assert.equal(calculate(expression!), expected, expression);
    }
  });

  it('never runs code', () => {
    for (const expression of ["process.exit(1)", "require('fs')", '[1][0]', '1 ? 2 : 3', '() => 1', "'a' * 3", 'true + 1', 'abs(-1)', 'x', '2 ^ 3']) {
      assert.match(calculate(expression), /^Error:/, expression);
    }
  });

  it('rejects expressions that would hang or overflow', () => {
    assert.equal(calculate('9 ** 9 ** 9'), 'Error: That power is too large.');
    assert.equal(calculate('10 ** 101'), 'Error: That power is too large.');
    assert.equal(calculate('1 / 0'), 'Error: division by zero.');
    assert.match(calculate('(' .repeat(150) + '1' + ')'.repeat(150)), /^Error:/);
    assert.equal(calculate('1'.repeat(300)), 'Error: the expression is too long.');
    assert.match(calculate('1 +'), /^Error:/);
  });
});

describe('validateArguments', () => {
  const schema: JsonSchema = { type: 'object', properties: { a: { type: 'string' }, n: { type: 'integer' }, f: { type: 'number' }, b: { type: 'boolean' } }, required: ['a'] };

  it('accepts matching arguments', () => {
    assert.equal(validateArguments(schema, { a: 'x', n: 1, f: 1.5, b: true }), undefined);
    assert.equal(validateArguments(schema, { a: 'x', f: 2 }), undefined);
  });

  it('reports the first problem', () => {
    const cases: Array<[unknown, string]> = [
      [{}, "Missing required argument 'a'"], [{ a: 1 }, 'must be of type string'], [{ a: 'x', n: 1.5 }, 'must be of type integer'],
      [{ a: 'x', b: 'yes' }, 'must be of type boolean'], [{ a: 'x', extra: 1 }, 'Unexpected argument'], [[], 'must be a JSON object'], [null, 'must be a JSON object']
    ];
    for (const [args, message] of cases) assert.match(validateArguments(schema, args) ?? '', new RegExp(message), JSON.stringify(args));
  });

  it('checks the range of getTime', () => {
    assert.equal(getTime(2, new Date('2026-01-01T10:00:00Z')), '2026-01-01 12:00:00 UTC+0200');
    assert.match(getTime(-5.5, new Date('2026-01-01T10:00:00Z')), /UTC-0530$/);
    assert.match(getTime(15), /^Error:/);
  });
});

class Scripted implements Provider {
  readonly name = 'scripted';
  readonly model = 'scripted';
  calls: Array<{ system?: string; history: HistoryItem[]; tools: string[] }> = [];
  private readonly turns: Turn[];
  constructor(turns: Turn[]) {
    this.turns = turns;
  }
  async streamTurn(system: string | undefined, history: HistoryItem[], tools: Array<{ name: string }>, onText: (text: string) => void): Promise<Turn> {
    this.calls.push({ system, history: [...history], tools: tools.map(tool => tool.name) });
    const turn = this.turns.shift()!;
    onText(turn.text);
    return turn;
  }
  async listModels(): Promise<string[]> {
    return [];
  }
}

const turn = (partial: Partial<Turn>): Turn => ({ text: '', toolCalls: [], stopReason: 'end_turn', provider: 'scripted', model: 'scripted', detail: '', ...partial });
const call = (name: string, args: Record<string, unknown>, id = 'c1'): ToolCall => ({ id, name, arguments: args });

describe('agent', () => {
  it('runs tools until the model answers', async () => {
    const provider = new Scripted([turn({ toolCalls: [call('calculate', { expression: '2+2' })], stopReason: 'tool_use' }), turn({ text: '4' })]);
    const history: HistoryItem[] = [];
    const seen: string[] = [];
    const result = await runTurn(provider, history, '2+2?', defaultTools(), { system: 'be brief', onTool: toolCall => seen.push(toolCall.name) });
    assert.equal(result.text, '4');
    assert.deepEqual(seen, ['calculate']);
    assert.equal(provider.calls[0]!.system, 'be brief');
    assert.deepEqual(provider.calls[0]!.tools, ['calculate', 'get_time']);
    assert.deepEqual(history[2], { role: 'tool', results: [{ id: 'c1', name: 'calculate', content: '4', isError: false }] });
  });

  it('turns failures into error results instead of ending the chat', async () => {
    const broken: Tool = { spec: { name: 'broken', description: 'x', parameters: { type: 'object', properties: {}, required: [] } }, run: () => { throw new RangeError('boom'); } };
    const bad: ToolCall = { id: 'c3', name: 'calculate', arguments: {}, error: 'Tool arguments were not valid JSON: x.' };
    const provider = new Scripted([
      turn({ toolCalls: [call('nope', {}, 'c1'), call('broken', {}, 'c2'), bad, call('calculate', {}, 'c4')], stopReason: 'tool_use' }),
      turn({ text: 'ok' })
    ]);
    const history: HistoryItem[] = [];
    await runTurn(provider, history, 'go', [...defaultTools(), broken]);
    const results = Object.fromEntries((history[2] as Extract<HistoryItem, { role: 'tool' }>).results.map(result => [result.id, [result.content, result.isError]]));
    assert.deepEqual(results.c1, ["Unknown tool 'nope'.", true]);
    assert.deepEqual(results.c2, ['RangeError: boom', true]);
    assert.equal(results.c3![1], true);
    assert.deepEqual(results.c4, ["Missing required argument 'expression'.", true]);
  });

  it('does not run the tools of a truncated turn', async () => {
    const provider = new Scripted([turn({ toolCalls: [call('calculate', { expression: '1' })], stopReason: 'max_tokens' })]);
    const history: HistoryItem[] = [];
    assert.equal((await runTurn(provider, history, 'x', defaultTools())).stopReason, 'max_tokens');
    assert.deepEqual(history.map(item => item.role), ['user', 'assistant']);
  });

  it('stops a model that never finishes', async () => {
    const looping = Array.from({ length: 5 }, (_, index) => turn({ toolCalls: [call('get_time', {}, `c${index}`)], stopReason: 'tool_use' }));
    await assert.rejects(runTurn(new Scripted(looping), [], 'x', defaultTools(), { maxSteps: 3 }), (error: unknown) => error instanceof AgentError && /3 steps/.test(error.message));
  });

  it('works without tools', async () => {
    const provider = new Scripted([turn({ text: 'hi' })]);
    assert.equal((await runTurn(provider, [], 'x')).text, 'hi');
    assert.deepEqual(provider.calls[0]!.tools, []);
  });
});
