#!/usr/bin/env node
/**
 * RankCLI MCP Server
 *
 * Model Context Protocol server for AI assistants to perform SEO analysis.
 * Exposes RankCLI's full analysis capabilities to Claude, GPT, and other AI tools.
 *
 * Usage:
 *   npx @rankcli/mcp-server
 *
 * Configuration in Claude Desktop:
 *   {
 *     "mcpServers": {
 *       "rankcli": {
 *         "command": "npx",
 *         "args": ["@rankcli/mcp-server"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import Conf from 'conf';

import { ANALYSIS_TOOLS, handleAnalysisTool } from './server.js';

// Backend for the optional rankcli_connect bridge - the only thing in this
// server that ever contacts rankcli.dev, and only when explicitly invoked.
const SUPABASE_URL = process.env.RANKCLI_SUPABASE_URL || 'https://bspljbxwbjiqueeyzyat.supabase.co';

// Same projectName as packages/cli's Conf store, so connecting here also
// signs in the `rankcli` CLI on this machine, and vice versa - one account,
// shared across surfaces.
interface LocalConfigSchema {
  apiKey?: string;
  apiKeyName?: string;
  email?: string;
  // An in-flight connect attempt from a previous rankcli_connect call that
  // hasn't been approved yet, so a retry checks it instead of starting over.
  pendingConnectId?: string;
  pendingConnectUrl?: string;
  pendingConnectExpiresAt?: number;
  pendingConnectCode?: string;
}
// No `schema` option here deliberately - the CLI's Conf store on this same
// file declares a wider schema (accessToken, refreshToken, ...), and this
// server should never risk validating those fields away.
const localConfig = new Conf<LocalConfigSchema>({ projectName: 'rankcli' });

// The two account-linking tools, local-stdio-only: they read/write a Conf
// file on this machine, which only makes sense for a single-user local
// process - never registered on the shared remote HTTP server (see
// server.ts / packages/audit-worker).
const ACCOUNT_TOOLS: Tool[] = [
  {
    name: 'rankcli_connect',
    description: `Link this AI assistant to a RankCLI account (rankcli.dev). This is the only tool in this server that contacts rankcli.dev, and only when you call it - every other tool runs fully locally. Connecting unlocks GitHub auto-fix PRs, scheduled monitoring, and a dashboard with history across audits; it does not change how the other tools work. Opens a browser tab for the user to approve (or reuses an existing session if already logged in). Safe to call anytime - if already connected, it just reports who's connected.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'rankcli_disconnect',
    description: `Unlink this AI assistant from its RankCLI account. Only affects this local connection - does not delete the RankCLI account or revoke other API keys.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

const TOOLS: Tool[] = [...ANALYSIS_TOOLS, ...ACCOUNT_TOOLS];

// Create server
const server = new Server(
  {
    name: 'rankcli',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const analysisResult = await handleAnalysisTool(name, args);
    if (analysisResult) return analysisResult;

    switch (name) {
      case 'rankcli_connect': {
        const result = await connectToRankCLI();
        return {
          content: [{ type: 'text', text: result.text }],
          ...(result.isError ? { isError: true } : {}),
        };
      }

      case 'rankcli_disconnect': {
        const wasConnected = !!localConfig.get('apiKey');
        localConfig.delete('apiKey');
        localConfig.delete('apiKeyName');
        localConfig.delete('email');
        return {
          content: [
            {
              type: 'text',
              text: wasConnected
                ? 'Disconnected. This assistant no longer has access to your RankCLI dashboard.'
                : 'Not connected - nothing to do.',
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// rankcli_connect / rankcli_disconnect support
//
// Device-flow-style bridge: mint a connect id, hand the user a rankcli.dev
// URL to approve it (via URL-mode elicitation when the client supports it,
// otherwise a plain link in the tool response), then poll for the resulting
// API key and store it in the same local Conf store the CLI reads - so
// connecting here also signs in `rankcli` on this machine.
async function pollConnectStatus(
  connectId: string,
  timeoutMs: number
): Promise<{ apiKey: string; apiKeyName?: string; email?: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mcp-connect-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectId }),
      });
      const status = await res.json();
      if (status.status === 'claimed' && status.apiKey) {
        return { apiKey: status.apiKey, apiKeyName: status.apiKeyName, email: status.email };
      }
      if (status.status === 'expired' || status.status === 'not_found') {
        return null;
      }
    } catch {
      // transient network error - keep polling until the deadline
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return null;
}

function clearPendingConnect(): void {
  localConfig.delete('pendingConnectId');
  localConfig.delete('pendingConnectUrl');
  localConfig.delete('pendingConnectExpiresAt');
  localConfig.delete('pendingConnectCode');
}

// rankcli.dev/connect shows the same code before its Approve button, so the
// user can tell this request apart from a link someone else sent them.
function codeLine(userCode: string | undefined): string {
  return userCode ? `\n\nApprove only if the page shows this code: ${userCode}` : '';
}

async function connectToRankCLI(): Promise<{ text: string; isError?: boolean }> {
  // Purely local check, deliberately not validate-api-key: that endpoint
  // 403s any free-tier key by design (no REST API access on the free plan),
  // which would wrongly read as "revoked" for the exact audience this
  // feature targets. A stored key means connected, full stop - if it's
  // later actually revoked, whatever call relies on it will surface that.
  const existingKey = localConfig.get('apiKey');
  if (existingKey) {
    const email = localConfig.get('email') || 'your account';
    return { text: `Already connected as ${email}. Run rankcli_disconnect first to switch accounts.` };
  }

  // A previous call may already have a connect link waiting on approval -
  // check it instead of silently abandoning it and starting a new one.
  const pendingId = localConfig.get('pendingConnectId');
  const pendingUrl = localConfig.get('pendingConnectUrl');
  const pendingExpiresAt = localConfig.get('pendingConnectExpiresAt');
  if (pendingId && pendingUrl && pendingExpiresAt) {
    if (Date.now() >= pendingExpiresAt) {
      clearPendingConnect();
    } else {
      const claimed = await pollConnectStatus(pendingId, 3000);
      if (claimed) {
        localConfig.set('apiKey', claimed.apiKey);
        localConfig.set('apiKeyName', claimed.apiKeyName);
        localConfig.set('email', claimed.email);
        clearPendingConnect();
        return { text: `Connected as ${claimed.email}! Your dashboard, GitHub auto-fix PRs, and audit history are now linked to this AI assistant.` };
      }
      const minutesLeft = Math.max(1, Math.round((pendingExpiresAt - Date.now()) / 60_000));
      return {
        text: `Still waiting for approval. Open this link if you haven't yet, then run rankcli_connect again:\n\n${pendingUrl}${codeLine(localConfig.get('pendingConnectCode'))}\n\nExpires in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      };
    }
  }

  let startData: { connectId: string; userCode?: string; url: string; expiresInSeconds: number };
  try {
    const startRes = await fetch(`${SUPABASE_URL}/functions/v1/mcp-connect-start`, { method: 'POST' });
    if (!startRes.ok) throw new Error(`status ${startRes.status}`);
    startData = await startRes.json();
  } catch (err) {
    return {
      text: `Could not reach rankcli.dev to start the connection (${err instanceof Error ? err.message : 'network error'}). Try again in a moment.`,
      isError: true,
    };
  }
  const { connectId, userCode, url, expiresInSeconds } = startData;
  const expiresMinutes = Math.round(expiresInSeconds / 60);
  localConfig.set('pendingConnectId', connectId);
  localConfig.set('pendingConnectUrl', url);
  localConfig.set('pendingConnectExpiresAt', Date.now() + expiresInSeconds * 1000);
  if (userCode) localConfig.set('pendingConnectCode', userCode);

  const supportsUrlElicitation = !!server.getClientCapabilities()?.elicitation?.url;

  if (supportsUrlElicitation) {
    try {
      const result = await server.elicitInput({
        mode: 'url',
        message: `Connect your RankCLI account to enable GitHub auto-fix PRs, scheduled monitoring, and a dashboard with audit history.${codeLine(userCode)}`,
        url,
        elicitationId: connectId,
      });
      if (result.action === 'accept') {
        // A short synchronous wait, not a background timer outliving this
        // call - MCP has no guarantee this process (or even this specific
        // connection) is still around later to receive an out-of-band
        // notification, and nothing here needs one: the same pending-check
        // path a few lines above already makes a second rankcli_connect
        // call resume exactly where this leaves off.
        const claimed = await pollConnectStatus(connectId, 10_000);
        if (claimed) {
          localConfig.set('apiKey', claimed.apiKey);
          localConfig.set('apiKeyName', claimed.apiKeyName);
          localConfig.set('email', claimed.email);
          clearPendingConnect();
          return { text: `Connected as ${claimed.email}! Your dashboard, GitHub auto-fix PRs, and audit history are now linked to this AI assistant.` };
        }
        return { text: `Opened rankcli.dev in your browser. Still waiting for approval - run rankcli_connect again once you've approved it (expires in ${expiresMinutes} minutes).` };
      }
      clearPendingConnect();
      return { text: 'Connection cancelled.' };
    } catch (err) {
      console.error('rankcli_connect: elicitation failed, falling back to link:', err);
      // Fall through to the plain-link path below.
    }
  }

  return {
    text: `Open this link to connect your RankCLI account:\n\n${url}${codeLine(userCode)}\n\nThen run rankcli_connect again to finish (link expires in ${expiresMinutes} minutes).`,
  };
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('RankCLI MCP Server running on stdio');
}

main().catch(console.error);
