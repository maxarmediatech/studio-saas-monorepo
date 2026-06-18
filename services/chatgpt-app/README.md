# Stuwiz ChatGPT App

MCP server facade for connecting Stuwiz to ChatGPT Apps.

## Local run

```bash
pnpm install
pnpm --filter @repo/chatgpt-app dev
```

The MCP endpoint is:

```txt
http://localhost:8787/mcp
```

## Environment

```bash
CHATGPT_APP_PORT=8787
STUWIZ_API_BASE_URL=http://localhost:3000
STUWIZ_MCP_BEARER_TOKEN=
CHATGPT_APP_WIDGET_DOMAIN=http://localhost:8787
```

## Current tools

Read-only first pass:

- `get_studio_dashboard`
- `search_studio`
- `list_bookings`
- `list_invoices`
- `list_tasks`

## Next integration step

Replace `STUWIZ_MCP_BEARER_TOKEN` with a proper ChatGPT OAuth connection flow. The tool error path already returns `mcp/www_authenticate` so ChatGPT can trigger account linking once the OAuth endpoints are added.
