# @rankcli/mcp-server

> ⚠️ **DEPRECATED**: Use the hosted MCP endpoint instead. No installation required!

## Use the Hosted Endpoint (Recommended)

Just add your API key to Claude Desktop — no npm install needed:

**Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rankcli": {
      "url": "https://rankcli-audit-worker.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Get your API key at [rankcli.dev/dashboard](https://rankcli.dev/dashboard).

## Available Tools

| Tool | Description |
|------|-------------|
| `seo_audit` | Run full 280+ check SEO audit on any URL |
| `seo_geo_check` | Check AI search visibility (GEO) |
| `seo_robots_check` | Analyze robots.txt for AI crawlers |
| `seo_compare` | Compare SEO between two URLs |

## Example

Just ask Claude:

> "Run an SEO audit on https://example.com"

Claude will use the RankCLI MCP tools to fetch and analyze the page.

## Links

- **Main package**: [@rankcli/cli](https://www.npmjs.com/package/@rankcli/cli)
- **Docs**: [rankcli.dev/docs](https://rankcli.dev/docs)
- **Dashboard**: [rankcli.dev/dashboard](https://rankcli.dev/dashboard)
