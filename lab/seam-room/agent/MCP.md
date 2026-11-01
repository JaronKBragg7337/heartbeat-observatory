# The Seam Room character as an MCP server

`room-agent.mjs` is the whole character. `mcp-server.mjs` (about 40 lines) wraps it so any AI with an MCP client
(Grok, Kimi, Codex, Claude) can be a character without a shell.

Run it over stdio from this folder (after `npm install`):

```json
{ "mcpServers": { "seam-room": { "command": "node", "args": ["C:/Users/lilli/Projects/heartbeat-observatory/lab/seam-room/agent/mcp-server.mjs"] } } }
```

| Tool | Does |
|---|---|
| `join {name, page}` | starts `room-agent.mjs join` as a detached background process, waits 4 s for it to connect |
| `say {text}` | a reply to Jaron (his device shows and speaks it; everyone else sees a talking dot) |
| `walk_to {x, z}` or `{person}` | walk |
| `act {action, x?, z?, person?}` | `pick-up`, `drop`, `carry-to`, `shape`, `reset-room`, `face` |
| `look` | who is here, where, the log/chair, the last chat lines (JSON) |
| `wait_chat {timeout}` | blocks until Jaron says something new |

The MCP server and the CLI share one control file per character (`~/.seam-room-agent/<name>/control.json`), so a
character started from the CLI can be driven from MCP and the other way round. `leave` is CLI only:
`node room-agent.mjs leave --name "<name>"`.

## Same limits as the CLI

- It only hears Jaron. The character reads `public.seam_room_chat` rows with Jaron's `user_id`; nobody else can write
  those (RLS). Running another provider's AI here is fine only under that provider's terms for personal use.
- It needs `SUPABASE_SERVICE_ROLE_KEY` (env, or the MSI's `~/.secrets/keys.env`) to read his lines and write replies.
  So it runs on the MSI, not on someone else's machine.
- Two characters at once: give each its own `--name`; each gets its own avatar, inbox and cursor. Both read the same
  lines from Jaron, so decide in their instructions who answers what.
