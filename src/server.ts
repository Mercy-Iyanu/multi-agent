import express from "express";
import cors from "cors";
import { connectMcp, disconnectMcp, listTools } from "./mcp-client.js";
import { chat, type Message } from "./llm.js";
import { reviewFlightOptions } from "./review/engine.js";
import type { ToolExecutionContext } from "./types.js";
import type { McpTool } from "./mcp-client.js";

interface SessionData {
  context: ToolExecutionContext;
  reviewedFlightSessions: Set<string>;
}

const sessions = new Map<string, SessionData>();
let mcpTools: McpTool[] = [];

function getSession(id: string): SessionData {
  if (!sessions.has(id)) {
    sessions.set(id, {
      context: { hotel: {}, flight: {}, car: {} },
      reviewedFlightSessions: new Set(),
    });
  }
  return sessions.get(id)!;
}

function extractPassengerCount(messages: Message[]): number {
  for (const m of [...messages].reverse()) {
    if (m.role !== "user") continue;
    const familyOf = m.content.match(/family\s+of\s+(\d+)/i);
    if (familyOf) return parseInt(familyOf[1], 10);
    const standard = m.content.match(/(\d+)\s*(adult|passenger|people|person|travell?er)/i);
    if (standard) return parseInt(standard[1], 10);
  }
  return 1;
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const {
    message,
    history = [],
    sessionId = "default",
  } = req.body as {
    message: string;
    history: Message[];
    sessionId?: string;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const { context, reviewedFlightSessions } = getSession(sessionId);
  const messages: Message[] = [...history, { role: "user", content: message }];

  send({ type: "thinking" });

  try {
    const result = await chat(messages, mcpTools, context, (toolName, args) => {
      send({ type: "tool", name: toolName, args });
    });

    send({ type: "response", text: result.response });

    const flightSessionId = context.flight.sessionId;
    const hasFlights = (context.flight.flights?.length ?? 0) > 0;

    if (hasFlights && flightSessionId && !reviewedFlightSessions.has(flightSessionId)) {
      reviewedFlightSessions.add(flightSessionId);
      send({ type: "reviewing" });
      try {
        const passengerCount = extractPassengerCount(messages);
        const review = await reviewFlightOptions(result.response, passengerCount);
        send({ type: "review", panel: review.panel, recommendation: review.recommendation });
      } catch {
        // review failed silently
      }
    }

    send({ type: "done" });
  } catch (err) {
    send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    send({ type: "done" });
  }

  res.end();
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function start() {
  await connectMcp();
  mcpTools = await listTools();
  app.listen(PORT, () => {
    console.log(`RouteStack API server → http://localhost:${PORT}`);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await disconnectMcp();
    process.exit(0);
  });
}

start().catch(console.error);
