import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useTheme from "../../theme/useTheme.js";
import {
  chatWithDocument, parseCitations, generateFlashcardFromContext
} from "../../utils/documentAi.js";
import {
  getChat, saveChat, clearChat, generateId
} from "../../utils/documentStore.js";
import DeckPickerModal from "./DeckPickerModal.jsx";

const STARTER_PROMPTS = [
  "Summarize the key points of this document",
  "What are the most important concepts I should know?",
  "Quiz me on this material",
];

export default function ChatTab({ doc, openDocs, aiSettings, decks, onAddCardToDeck, onScrollToPage }) {
  const { T } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [pendingCard, setPendingCard] = useState(null); // { front, back, tags } awaiting deck pick
  const [cardLoading, setCardLoading] = useState(false);
  const scrollRef = useRef(null);

  // Load chat history for this document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const chat = await getChat(doc.id);
      if (cancelled) return;
      setMessages(chat?.messages || []);
    })();
    return () => { cancelled = true; };
  }, [doc.id]);

  // Persist on every change (debounced)
  useEffect(() => {
    if (messages.length === 0) return;
    const handle = setTimeout(async () => {
      const existing = await getChat(doc.id);
      const id = existing?.id || generateId();
      await saveChat({
        id, docId: doc.id, messages,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [messages, doc.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, sending]);

  // Cloud key OR keyless claude-local both satisfy the gate.
  const hasApiKey = !!aiSettings?.apiKey || aiSettings?.provider === "claude-local";

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setError(null);
    setInput("");
    const newHistory = [...messages, { role: "user", content, ts: Date.now() }];
    setMessages(newHistory);
    setSending(true);
    try {
      const reply = await chatWithDocument({
        aiSettings,
        doc,
        // Pass the full open-tab set so the AI sees every PDF in the
        // tab group as context, not just the active one. `doc` identifies
        // which of those is currently focused.
        docs: openDocs && openDocs.length > 0 ? openDocs : (doc ? [doc] : []),
        history: newHistory,
        message: content,
      });
      setMessages(prev => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch (err) {
      console.error("Chat error", err);
      setError(err.message || "Couldn't reach the AI");
    } finally {
      setSending(false);
    }
  };

  const handleMakeFlashcard = async (assistantContent) => {
    setCardLoading(true);
    setError(null);
    try {
      const card = await generateFlashcardFromContext({
        aiSettings, doc, context: assistantContent
      });
      setPendingCard(card);
    } catch (err) {
      setError(err.message || "Couldn't generate card");
    } finally {
      setCardLoading(false);
    }
  };

  const handleClearChat = async () => {
    await clearChat(doc.id);
    setMessages([]);
  };

  // ----- Empty state -----
  if (messages.length === 0 && !sending) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{
          flex: 1, padding: "24px 18px",
          display: "flex", flexDirection: "column", justifyContent: "center"
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: T.bgSub, color: T.textMid,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            Ask anything about this document
          </div>
          <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.6, marginBottom: 18 }}>
            Answers are grounded in the source with clickable page citations.
            Try one of these to get started:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STARTER_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={!hasApiKey}
                style={{
                  textAlign: "left", padding: "10px 12px",
                  borderRadius: 10, border: `1px solid ${T.border}`,
                  background: T.card, color: T.text,
                  fontSize: 13, fontFamily: T.fontBody, cursor: hasApiKey ? "pointer" : "not-allowed",
                  opacity: hasApiKey ? 1 : 0.5, transition: "all 0.15s"
                }}
                onMouseEnter={e => { if (hasApiKey) { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.background = T.bgSub; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; }}
              >{p}</button>
            ))}
          </div>
          {!hasApiKey && (
            <div style={{
              marginTop: 16, padding: "10px 12px", borderRadius: 8,
              background: `${T.hard || "#c47f2a"}10`, border: `1px solid ${T.hard || "#c47f2a"}30`,
              fontSize: 11, color: T.textMid, lineHeight: 1.5
            }}>
              Chat needs a cloud AI provider configured in Settings.
            </div>
          )}
        </div>
        <Composer
          input={input} setInput={setInput} onSend={() => send()}
          sending={sending} disabled={!hasApiKey} T={T}
        />
      </div>
    );
  }

  // ----- Conversation -----
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto",
        padding: "12px 14px 8px",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8, gap: 8,
        }}>
          {/* Multi-doc indicator. Shows the user how many tabs the AI
              currently sees as context. Hidden in the single-doc case
              since that's the implicit default. */}
          {openDocs && openDocs.length > 1 ? (
            <span
              title={openDocs.map(d => "• " + d.title).join("\n")}
              style={{
                fontSize: 11, color: T.textMid, fontFamily: T.fontBody,
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 8px", borderRadius: 10,
                background: T.bgSub, border: `1px solid ${T.border}`,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="13" height="13" rx="1" />
                <path d="M8 8h13v13H8z" />
              </svg>
              {openDocs.length} docs in context
            </span>
          ) : <span />}
          <button onClick={handleClearChat} style={{
            fontSize: 11, color: T.textLight,
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 6px", fontFamily: T.fontBody
          }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.textLight}
          >Clear chat</button>
        </div>
        {messages.map((m, i) => (
          <Message
            key={i}
            message={m}
            T={T}
            onScrollToPage={onScrollToPage}
            onMakeFlashcard={() => handleMakeFlashcard(m.content)}
            cardLoading={cardLoading}
          />
        ))}
        {sending && <ThinkingIndicator T={T} />}
        {error && (
          <div style={{
            marginTop: 8, padding: "8px 12px", borderRadius: 8,
            background: T.dueBg, color: T.due, fontSize: 12, fontFamily: T.fontBody
          }}>{error}</div>
        )}
      </div>
      <Composer
        input={input} setInput={setInput} onSend={() => send()}
        sending={sending} disabled={!hasApiKey} T={T}
      />

      {pendingCard && (
        <DeckPickerModal
          card={pendingCard}
          decks={decks}
          onCancel={() => setPendingCard(null)}
          onSave={(deckId, finalCard) => {
            onAddCardToDeck(deckId, finalCard);
            setPendingCard(null);
          }}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

function Composer({ input, setInput, onSend, sending, disabled, T }) {
  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
      e.preventDefault();
      onSend();
    }
  };
  return (
    <div style={{
      borderTop: `1px solid ${T.border}`,
      padding: "10px 12px",
      background: T.card,
      flexShrink: 0
    }}>
      {/* Message bubble — the input AND the send button live inside the
          same rounded container so the send affordance reads as part of
          the input, not a separate control floating beside it. */}
      <div style={{ position: "relative" }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled || sending}
          rows={1}
          placeholder={disabled ? "Add an API key in Settings to chat" : "Ask about this document…"}
          style={{
            width: "100%", boxSizing: "border-box",
            // Extra right padding reserves space for the in-bubble Send button
            padding: "10px 50px 10px 14px",
            borderRadius: 20,
            border: `1.5px solid ${T.border}`,
            fontSize: 13, lineHeight: 1.5,
            fontFamily: T.fontBody, color: T.text, background: T.inputBg,
            outline: "none", resize: "none",
            transition: "border-color 0.15s",
            maxHeight: 120, overflow: "auto"
          }}
          onFocus={e => e.target.style.borderColor = T.borderStrong}
          onBlur={e => e.target.style.borderColor = T.border}
        />
        {/* Send button. Always visible as a clear button shape — active
            state lights up with the accent color so the user sees it's
            ready. Disabled state still shows the outline so it doesn't
            look like the affordance disappeared. */}
        <button
          onClick={onSend}
          disabled={!input.trim() || sending || disabled}
          aria-label="Send message"
          title="Send (Enter)"
          style={{
            position: "absolute", right: 6, top: "50%",
            transform: "translateY(-50%)",
            width: 32, height: 32, borderRadius: "50%",
            border: `1.5px solid ${
              input.trim() && !sending && !disabled ? T.text : T.border
            }`,
            background: input.trim() && !sending && !disabled ? T.text : T.card,
            color: input.trim() && !sending && !disabled ? T.card : T.textLight,
            cursor: input.trim() && !sending && !disabled ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
            padding: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Message({ message, T, onScrollToPage, onMakeFlashcard, cardLoading }) {
  const isUser = message.role === "user";
  const citations = !isUser ? parseCitations(message.content).citations : [];

  // Render assistant messages with citations as clickable spans.
  // We post-process the text via a custom react-markdown text component.
  const components = !isUser ? {
    p: ({ children }) => (
      <p style={{ margin: "0 0 8px", lineHeight: 1.6, fontSize: 13, color: T.text }}>{children}</p>
    ),
    strong: ({ children }) => <strong style={{ fontWeight: 700, color: T.text }}>{children}</strong>,
    em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
    ul: ({ children }) => <ul style={{ margin: "0 0 8px 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ margin: "0 0 8px 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>{children}</ol>,
    li: ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>,
    code: ({ inline, children }) => inline ? (
      <code style={{
        fontFamily: "ui-monospace, monospace", fontSize: 12,
        padding: "1px 5px", borderRadius: 3,
        background: T.bgSub, border: `1px solid ${T.border}`
      }}>{children}</code>
    ) : (
      <pre style={{
        margin: "4px 0 8px", padding: 8, borderRadius: 6,
        background: T.bgSub, fontSize: 11, overflow: "auto"
      }}><code>{children}</code></pre>
    ),
    text: ({ children }) => renderTextWithCitations(children, T, onScrollToPage),
  } : null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: 14
    }}>
      <div style={{
        maxWidth: "92%",
        padding: isUser ? "8px 14px" : "10px 14px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isUser ? T.text : T.bgSub,
        color: isUser ? T.card : T.text,
        fontSize: 13, lineHeight: 1.55,
        fontFamily: T.fontBody,
        wordBreak: "break-word"
      }}>
        {isUser ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>

      {!isUser && citations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, paddingLeft: 4 }}>
          {citations.map(c => (
            <button
              key={c.page}
              onClick={() => onScrollToPage(c.page)}
              title={`Jump to page ${c.page}`}
              style={{
                padding: "2px 8px", borderRadius: 999,
                border: `1px solid ${T.border}`, background: T.card,
                fontSize: 10, fontWeight: 600, color: T.textMid,
                fontFamily: T.fontBody, cursor: "pointer", letterSpacing: 0.3,
                transition: "all 0.15s"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
            >{c.label}</button>
          ))}
        </div>
      )}

      {!isUser && (
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
          <ActionChip T={T} onClick={onMakeFlashcard} disabled={cardLoading}>
            {cardLoading ? "Generating…" : "+ Make flashcard"}
          </ActionChip>
        </div>
      )}
    </div>
  );
}

function renderTextWithCitations(children, T, onScrollToPage) {
  if (typeof children !== "string") return children;
  const parts = children.split(/(\[p\.\s*\d+\])/gi);
  return parts.map((part, i) => {
    const m = part.match(/^\[p\.\s*(\d+)\]$/i);
    if (m) {
      const page = parseInt(m[1], 10);
      return (
        <button key={i}
          onClick={() => onScrollToPage(page)}
          title={`Jump to page ${page}`}
          style={{
            display: "inline", padding: "0 4px",
            border: "none", background: "transparent",
            color: T.easy, fontFamily: T.fontBody, fontSize: "0.9em",
            fontWeight: 600, cursor: "pointer", verticalAlign: "baseline",
            textDecoration: "underline", textUnderlineOffset: 2
          }}
        >[p.{page}]</button>
      );
    }
    return part;
  });
}

function ActionChip({ children, onClick, disabled, T }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "4px 10px", borderRadius: 999,
      border: `1px solid ${T.border}`, background: T.card,
      color: T.textMid, fontSize: 11, fontWeight: 600,
      fontFamily: T.fontBody, cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.6 : 1, transition: "all 0.15s"
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
    >{children}</button>
  );
}

function ThinkingIndicator({ T }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 14px", marginBottom: 8,
      fontSize: 12, color: T.textMid, fontFamily: T.fontBody
    }}>
      <span style={{ display: "inline-flex", gap: 3 }}>
        {[0, 200, 400].map(delay => (
          <span key={delay} style={{
            width: 5, height: 5, borderRadius: "50%",
            background: T.textLight,
            animation: `pulse 1.2s ease-in-out ${delay}ms infinite`
          }} />
        ))}
      </span>
      Thinking…
    </div>
  );
}
