// The chat loop: send the history, run any tools the model asks for, and repeat until it answers.
import type { HistoryItem, Provider, ToolCall, ToolResult, Turn } from './providers.ts';
import { validateArguments, type Tool } from './tools.ts';

export class AgentError extends Error {}

/** Runs one tool call and returns a result record. A failure becomes an error result the model can read. */
export function execute(call: ToolCall, tools: Map<string, Tool>): ToolResult {
  const result = (content: string, isError: boolean): ToolResult => ({ id: call.id, name: call.name, content, isError });
  if (call.error) return result(call.error, true);
  const tool = tools.get(call.name);
  if (!tool) return result(`Unknown tool '${call.name}'.`, true);
  const problem = validateArguments(tool.spec.parameters, call.arguments);
  if (problem) return result(problem, true);
  try {
    const output = String(tool.run(call.arguments));
    return result(output, output.startsWith('Error:'));
  } catch (error) {
    // A broken tool must not end the conversation.
    return result(`${(error as Error).name}: ${(error as Error).message}`, true);
  }
}

export interface RunOptions {
  system?: string;
  onText?: (text: string) => void;
  onTool?: (call: ToolCall) => void;
  maxSteps?: number;
}

/** Adds `userText` to `history` and runs the model until it stops asking for tools. */
export async function runTurn(provider: Provider, history: HistoryItem[], userText: string, tools: Tool[] = [], options: RunOptions = {}): Promise<Turn> {
  const { system, onText = () => {}, onTool = () => {}, maxSteps = 8 } = options;
  const byName = new Map(tools.map(tool => [tool.spec.name, tool]));
  const specs = tools.map(tool => tool.spec);
  history.push({ role: 'user', text: userText });
  for (let step = 0; step < maxSteps; step++) {
    const turn = await provider.streamTurn(system, history, specs, onText);
    history.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls, native: turn.native, provider: turn.provider });
    if (turn.stopReason !== 'tool_use' || turn.toolCalls.length === 0) return turn;
    const results: ToolResult[] = [];
    for (const call of turn.toolCalls) {
      onTool(call);
      results.push(execute(call, byName));
    }
    history.push({ role: 'tool', results });
  }
  throw new AgentError(`The model kept calling tools for ${maxSteps} steps. Ask again or raise maxSteps.`);
}
