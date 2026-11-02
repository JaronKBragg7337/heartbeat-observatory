#!/usr/bin/env node
// MCP wrapper around room-agent.mjs: any MCP client (Grok, Kimi, Codex...) can be a Seam Room character.
// Run: node mcp-server.mjs  (stdio). Same rules as the CLI: only Jaron's lines are heard. See MCP.md.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import { call, spawnJoin, waitChat, formatLine } from "./room-agent.mjs";

/* the pages a character can join: every zone in ../zones.json (never a hand-written list) */
const PAGES = JSON.parse(fs.readFileSync(new URL("../zones.json", import.meta.url), "utf8")).zones.map((zn) => zn.id);

const server = new McpServer({ name: "seam-room", version: "0.1.0" });
const text = (t) => ({ content: [{ type: "text", text: typeof t === "string" ? t : JSON.stringify(t, null, 2) }] });
const name = z.string().optional().describe("character name; defaults to the last one joined");
const run = (fn) => async (a) => { try { return text(await fn(a)); } catch (e) { return { ...text(e.message), isError: true }; } };

server.tool("join", "Stand in the Seam Room as a character (starts a background process).",
  { name: z.string().default("Claude"), page: z.enum(PAGES).default("b").describe("the page to start on: " + PAGES.join(", ")) },
  run(async ({ name, page }) => { const pid = spawnJoin(name, page); await new Promise((r) => setTimeout(r, 4000)); return `joined as ${name} on page ${page} (pid ${pid})`; }));
server.tool("say", "Say something to Jaron (only he sees and hears the words).", { text: z.string().max(280), name },
  run(({ text: t, name: n }) => call(n, "/say", { text: t })));
server.tool("walk_to", "Walk to x,z in metres (x<0 is page A) or to a person by name.",
  { person: z.string().optional(), x: z.number().optional(), z: z.number().optional(), name },
  run(({ name: n, ...b }) => call(n, "/walk-to", b)));
server.tool("act", "Do something with the log/chair: pick-up, drop, carry-to (needs x,z), shape, reset-room, face (needs person).",
  { action: z.enum(["pick-up", "drop", "carry-to", "shape", "reset-room", "face"]), x: z.number().optional(), z: z.number().optional(), person: z.string().optional(), name },
  run(({ action, name: n, ...b }) => call(n, "/" + action, b)));
server.tool("look", "Who is here, where, the log/chair, the last chat lines.", { name }, run(({ name: n }) => call(n, "/look", {})));
server.tool("wait_chat", "Block until Jaron says something new (or timeout seconds pass).",
  { timeout: z.number().default(600), name },
  run(async ({ timeout, name: n }) => { const r = await waitChat(n, timeout); return r.lines.length ? r.lines.map(formatLine).join("\n") : "(nothing said before the timeout)"; }));

await server.connect(new StdioServerTransport());
