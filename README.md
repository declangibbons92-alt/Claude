# Artlist MCP integration

This repo is configured to use the official [Artlist](https://artlist.io/mcp)
remote MCP server so Claude can generate images and video (100+ AI models —
Nano Banana, Seedance, Kling, Omni Flash, etc.) directly in the conversation,
with every generation saved to your Artlist account.

## Configuration

The server is declared in [`.mcp.json`](./.mcp.json) at **project scope**, so it
travels with the repo — anyone who opens this project in Claude Code gets the
same server:

```json
{
  "mcpServers": {
    "artlist": {
      "type": "http",
      "url": "https://mcp.artlist.io/mcp"
    }
  }
}
```

## Using it on your own machine

`.mcp.json` only stores the server URL — **not** your credentials. Auth is
per-machine via OAuth, so the first time you use it on a new computer:

1. Open this repo in Claude Code (or `claude` in this directory).
2. Approve the project MCP server when prompted (project-scoped servers require
   a one-time approval per machine for security).
3. Run `/mcp`, select **artlist**, and complete the sign-in / authorize flow
   against your Artlist account.

After that the connection stays live — it's a one-time setup per machine.

## Requirements

- A paid Artlist plan with AI credits (generations are credit-based; there's no
  separate billing for MCP usage).
