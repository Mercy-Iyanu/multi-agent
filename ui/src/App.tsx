import { useState, useEffect, useRef, useCallback } from "react";
import { marked } from "marked";
import ToolCall from "./components/ToolCall.tsx";
import ReviewPanel from "./components/ReviewPanel.tsx";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ReviewPanelData {
  flightSpecialist: string;
  convenienceSpecialist: string;
  budgetAnalyst: string;
  familyReviewer: string;
}

type ChatEvent =
  | { id: string; type: "user"; text: string }
  | { id: string; type: "thinking" }
  | { id: string; type: "tool"; name: string; args: Record<string, unknown> }
  | { id: string; type: "response"; text: string }
  | { id: string; type: "reviewing" }
  | { id: string; type: "review"; panel: ReviewPanelData; recommendation: string }
  | { id: string; type: "error"; text: string };

let _id = 0;
const uid = () => `e${++_id}`;

const SESSION_ID = crypto.randomUUID();

const EXAMPLE = "Plan a trip from New York to Tokyo from 2026-12-15 to 2026-12-22 for 2 adults";

export default function App() {
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading || !text.trim()) return;

      const thinkingId = uid();

      setEvents((prev) => [
        ...prev,
        { id: uid(), type: "user", text },
        { id: thinkingId, type: "thinking" },
      ]);
      setInput("");
      setIsLoading(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      let assistantText = "";
      let thinkingGone = false;

      const dropThinking = (prev: ChatEvent[]) => {
        if (thinkingGone) return prev;
        thinkingGone = true;
        return prev.filter((e) => e.id !== thinkingId);
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history, sessionId: SESSION_ID }),
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let ev: { type: string; [k: string]: unknown };
            try {
              ev = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (ev.type === "tool") {
              setEvents((prev) => [
                ...dropThinking(prev),
                {
                  id: uid(),
                  type: "tool",
                  name: ev.name as string,
                  args: ev.args as Record<string, unknown>,
                },
              ]);
            } else if (ev.type === "response") {
              assistantText = ev.text as string;
              setEvents((prev) => [
                ...dropThinking(prev),
                { id: uid(), type: "response", text: assistantText },
              ]);
            } else if (ev.type === "reviewing") {
              setEvents((prev) => [...prev, { id: uid(), type: "reviewing" }]);
            } else if (ev.type === "review") {
              setEvents((prev) => {
                const withoutReviewing = prev.filter((e) => e.type !== "reviewing");
                return [
                  ...withoutReviewing,
                  {
                    id: uid(),
                    type: "review",
                    panel: ev.panel as ReviewPanelData,
                    recommendation: ev.recommendation as string,
                  },
                ];
              });
            } else if (ev.type === "error") {
              setEvents((prev) => [
                ...dropThinking(prev),
                { id: uid(), type: "error", text: ev.message as string },
              ]);
            } else if (ev.type === "done") {
              if (assistantText) {
                setHistory((prev) => [
                  ...prev,
                  { role: "user", content: text },
                  { role: "assistant", content: assistantText },
                ]);
              }
              setIsLoading(false);
            }
          }
        }
      } catch (err) {
        setEvents((prev) => [
          ...dropThinking(prev),
          {
            id: uid(),
            type: "error",
            text: err instanceof Error ? err.message : "Connection error",
          },
        ]);
        setIsLoading(false);
      }
    },
    [isLoading, history],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">✈</span>
          <span className="logo-text">RouteStack</span>
        </div>
        <span className="header-sub">Multi-Agent Trip Planner</span>
      </header>

      <main className="main">
        <div className="messages">
          {events.length === 0 && (
            <div className="welcome">
              <div className="welcome-icon">🌍</div>
              <h2>Plan your trip with AI</h2>
              <p>
                Describe where you want to go and when. Three agents search
                flights, hotels, and cars simultaneously — then specialists
                review your flight options.
              </p>
              <button
                className="example-chip"
                onClick={() => sendMessage(EXAMPLE)}
              >
                <span className="example-chip-label">Try this →</span>
                <span className="example-chip-text">{EXAMPLE}</span>
              </button>
            </div>
          )}

          {events.map((event) => {
            if (event.type === "user") {
              return (
                <div key={event.id} className="row row--user">
                  <div className="bubble bubble--user">{event.text}</div>
                </div>
              );
            }

            if (event.type === "thinking") {
              return (
                <div key={event.id} className="row row--assistant">
                  <div className="bubble bubble--thinking">
                    <span className="dots">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              );
            }

            if (event.type === "tool") {
              return (
                <ToolCall key={event.id} name={event.name} args={event.args} />
              );
            }

            if (event.type === "response") {
              return (
                <div key={event.id} className="row row--assistant">
                  <div
                    className="bubble bubble--assistant markdown"
                    dangerouslySetInnerHTML={{
                      __html: String(marked.parse(event.text)),
                    }}
                  />
                </div>
              );
            }

            if (event.type === "reviewing") {
              return (
                <div key={event.id} className="row row--center">
                  <div className="status-pill">
                    <span className="status-spin">◈</span>
                    Analyzing flight options…
                  </div>
                </div>
              );
            }

            if (event.type === "review") {
              return (
                <ReviewPanel
                  key={event.id}
                  panel={event.panel}
                  recommendation={event.recommendation}
                />
              );
            }

            if (event.type === "error") {
              return (
                <div key={event.id} className="row row--assistant">
                  <div className="bubble bubble--error">{event.text}</div>
                </div>
              );
            }

            return null;
          })}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="input-bar">
        <form className="input-form" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className="input-field"
            placeholder="Plan a trip from NYC to Tokyo, Dec 15–22, 2 adults…"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={isLoading || !input.trim()}
            aria-label="Send"
          >
            {isLoading ? (
              <span className="spinner" />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}
