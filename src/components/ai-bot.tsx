"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export function KsBuddy() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Assalam o alaikum! Main KS Buddy hoon. Visa (30 Nov 2026), programmes, scholarships, IELTS, ya student portal ke bare mein poochhein.",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, lang }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      const reply =
        json.reply ||
        json.error ||
        (lang === "ur"
          ? "Maaf, abhi jawab nahi mil saka. Thori der baad dobara koshish karein."
          : "Sorry, I could not reply. Please try again in a moment.");
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            lang === "ur"
              ? "Network error. Dobara koshish karein."
              : "Network error. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="ai-bot-panel" role="dialog" aria-label="KS Buddy">
          <div className="ai-bot-header">
            <div>
              <div className="eyebrow text-[0.65rem]">KS Abroad</div>
              <div className="display text-xl">KS Buddy</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="ai-bot-lang">
                <button
                  type="button"
                  className={lang === "en" ? "active" : ""}
                  onClick={() => setLang("en")}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={lang === "ur" ? "active" : ""}
                  onClick={() => setLang("ur")}
                >
                  UR
                </button>
              </div>
              <button
                type="button"
                className="ai-bot-icon-btn"
                aria-label="Close KS Buddy"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="ai-bot-messages">
            {messages.map((msg, i) => (
              <div key={`${msg.role}-${i}`} className={`ai-bot-bubble ${msg.role}`}>
                {msg.text}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form
            className="ai-bot-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === "ur" ? "Sawal likhein…" : "Ask a question…"}
              maxLength={800}
              disabled={busy}
            />
            <button className="btn btn-sea shrink-0" type="submit" disabled={busy || !input.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        className="wa-float"
        aria-label={open ? "Close KS Buddy" : "Open KS Buddy"}
        onClick={() => setOpen((v) => !v)}
      >
        <MessageCircle size={18} />
        <span className="hidden sm:inline">{open ? "Close" : "KS Buddy"}</span>
      </button>
    </>
  );
}
