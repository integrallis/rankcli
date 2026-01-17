import Anthropic from '@anthropic-ai/sdk';
import type { AgentDefinition, ToolResult, SEOAnalysisResult } from './types.js';
import { tools } from './tools/index.js';
import { interpolatePrompt } from './loader.js';

export interface ExecuteOptions {
  variables?: Record<string, string>;
  onToolCall?: (name: string, params: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: ToolResult) => void;
  cwd?: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  toolCalls?: { name: string; params: unknown; result: ToolResult }[];
}

// Map agent tool definitions to Anthropic API tool format
function mapToolsToAnthropic(agentTools: AgentDefinition['tools']): Anthropic.Tool[] {
  const toolSchemas: Record<string, Anthropic.Tool> = {
    crawl_url: {
      name: 'crawl_url',
      description: 'Fetch and parse HTML from a URL',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'URL to crawl' }
        },
        required: ['url']
      }
    },
    extract_meta: {
      name: 'extract_meta',
      description: 'Extract all meta tags from HTML',
      input_schema: {
        type: 'object' as const,
        properties: {
          html: { type: 'string', description: 'HTML content' },
          url: { type: 'string', description: 'Base URL' }
        },
        required: ['html', 'url']
      }
    },
    analyze_headings: {
      name: 'analyze_headings',
      description: 'Extract and analyze heading hierarchy',
      input_schema: {
        type: 'object' as const,
        properties: {
          html: { type: 'string', description: 'HTML content' }
        },
        required: ['html']
      }
    },
    extract_images: {
      name: 'extract_images',
      description: 'Extract all images with their attributes',
      input_schema: {
        type: 'object' as const,
        properties: {
          html: { type: 'string', description: 'HTML content' }
        },
        required: ['html']
      }
    },
    extract_links: {
      name: 'extract_links',
      description: 'Extract all links from the page',
      input_schema: {
        type: 'object' as const,
        properties: {
          html: { type: 'string', description: 'HTML content' },
          baseUrl: { type: 'string', description: 'Base URL for determining internal/external' }
        },
        required: ['html', 'baseUrl']
      }
    },
    extract_schema: {
      name: 'extract_schema',
      description: 'Extract JSON-LD structured data',
      input_schema: {
        type: 'object' as const,
        properties: {
          html: { type: 'string', description: 'HTML content' }
        },
        required: ['html']
      }
    },
    check_robots: {
      name: 'check_robots',
      description: 'Fetch and parse robots.txt',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'Base URL of the site' }
        },
        required: ['url']
      }
    },
    check_sitemap: {
      name: 'check_sitemap',
      description: 'Fetch and parse sitemap.xml',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'Base URL of the site' }
        },
        required: ['url']
      }
    },
    read_file: {
      name: 'read_file',
      description: 'Read a file from the codebase',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'File path to read' },
          cwd: { type: 'string', description: 'Working directory' }
        },
        required: ['path']
      }
    },
    write_file: {
      name: 'write_file',
      description: 'Write content to a file',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' },
          cwd: { type: 'string', description: 'Working directory' }
        },
        required: ['path', 'content']
      }
    },
    list_files: {
      name: 'list_files',
      description: 'List files in a directory',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Directory path' },
          pattern: { type: 'string', description: 'File pattern to match' },
          recursive: { type: 'boolean', description: 'Search recursively' },
          cwd: { type: 'string', description: 'Working directory' }
        },
        required: ['path']
      }
    },
    detect_framework: {
      name: 'detect_framework',
      description: 'Detect the web framework used in a project',
      input_schema: {
        type: 'object' as const,
        properties: {
          cwd: { type: 'string', description: 'Project directory' }
        },
        required: []
      }
    },
    find_html_entry: {
      name: 'find_html_entry',
      description: 'Find the HTML entry point file',
      input_schema: {
        type: 'object' as const,
        properties: {
          cwd: { type: 'string', description: 'Project directory' }
        },
        required: []
      }
    },
    find_page_files: {
      name: 'find_page_files',
      description: 'Find all page/route files in the project',
      input_schema: {
        type: 'object' as const,
        properties: {
          cwd: { type: 'string', description: 'Project directory' },
          framework: { type: 'string', description: 'Framework name' }
        },
        required: []
      }
    },
    analyze_url: {
      name: 'analyze_url',
      description: 'Run a complete SEO analysis on a URL',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'URL to analyze' }
        },
        required: ['url']
      }
    },
  };

  return agentTools
    .filter(t => toolSchemas[t.name])
    .map(t => toolSchemas[t.name]);
}

export async function executeAgent(
  agent: AgentDefinition,
  options: ExecuteOptions = {}
): Promise<ExecutionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'ANTHROPIC_API_KEY environment variable not set' };
  }

  const client = new Anthropic({ apiKey });
  const { variables = {}, onToolCall, onToolResult, cwd } = options;

  // Interpolate the prompt with variables
  const userPrompt = interpolatePrompt(agent.prompt, variables);

  // Map agent tools to Anthropic format
  const anthropicTools = mapToolsToAnthropic(agent.tools);

  const toolCalls: { name: string; params: unknown; result: ToolResult }[] = [];

  try {
    // Initial message
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userPrompt }
    ];

    let response = await client.messages.create({
      model: agent.model,
      max_tokens: agent.max_tokens,
      temperature: agent.temperature,
      system: agent.system,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      messages,
    });

    // Process tool calls in a loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const toolName = toolUse.name;
        const toolParams = toolUse.input as Record<string, unknown>;

        // Add cwd to file-related tools
        if (['read_file', 'write_file', 'list_files', 'detect_framework', 'find_html_entry', 'find_page_files'].includes(toolName)) {
          if (cwd && !toolParams.cwd) {
            toolParams.cwd = cwd;
          }
        }

        onToolCall?.(toolName, toolParams);

        const toolFn = tools[toolName];
        let result: ToolResult;

        if (toolFn) {
          result = await toolFn(toolParams);
        } else {
          result = { success: false, error: `Unknown tool: ${toolName}` };
        }

        onToolResult?.(toolName, result);
        toolCalls.push({ name: toolName, params: toolParams, result });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await client.messages.create({
        model: agent.model,
        max_tokens: agent.max_tokens,
        temperature: agent.temperature,
        system: agent.system,
        tools: anthropicTools,
        messages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    const responseText = textBlocks.map(b => b.text).join('\n');

    // Try to parse JSON from the response
    let data: unknown;
    try {
      // Look for JSON in the response
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
                        responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        data = JSON.parse(jsonStr);
      } else {
        data = responseText;
      }
    } catch {
      data = responseText;
    }

    return { success: true, data, toolCalls };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Agent execution failed',
      toolCalls,
    };
  }
}

// Simplified direct analysis function that doesn't need Claude API
export async function runDirectAnalysis(url: string): Promise<SEOAnalysisResult> {
  const { analyzeUrl } = await import('./tools/analyzer.js');
  const result = await analyzeUrl({ url });

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Analysis failed');
  }

  return result.data as SEOAnalysisResult;
}
