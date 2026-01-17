import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { join } from 'path';
import type { AgentDefinition } from './types.js';

export function loadAgent(agentPath: string): AgentDefinition {
  if (!existsSync(agentPath)) {
    throw new Error(`Agent file not found: ${agentPath}`);
  }

  const content = readFileSync(agentPath, 'utf-8');
  const agent = parseYaml(content) as AgentDefinition;

  // Validate required fields
  if (!agent.name) throw new Error('Agent missing required field: name');
  if (!agent.model) throw new Error('Agent missing required field: model');
  if (!agent.system) throw new Error('Agent missing required field: system');
  if (!agent.prompt) throw new Error('Agent missing required field: prompt');

  // Set defaults
  agent.temperature = agent.temperature ?? 0.1;
  agent.max_tokens = agent.max_tokens ?? 4096;
  agent.tools = agent.tools ?? [];

  return agent;
}

export function loadAgentByName(name: string, agentsDir?: string): AgentDefinition {
  const baseDir = agentsDir || join(process.cwd(), 'agents');
  const agentPath = join(baseDir, `${name}.yaml`);
  return loadAgent(agentPath);
}

export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
  }
  return result;
}
