// Styled Markdown renderer that uses the app's design tokens for typography,
// spacing, and color. Page anchors (<!-- page N -->) are preserved as
// scroll-targets so the AI sidebar can jump to "page 42" via [p.42] links.

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import useTheme from "../../theme/useTheme.js";

// Splits the markdown around <!-- page N --> markers so each page becomes a
// <section id="page-N"> we can scroll to. The marker text itself is removed.
function splitByPageMarkers(markdown) {
  const PAGE_RE = /<!--\s*page\s+(\d+)\s*-->/gi;
  const segments = [];
  let lastIndex = 0;
  let currentPage = null;
  let match;
  while ((match = PAGE_RE.exec(markdown)) !== null) {
    const content = markdown.slice(lastIndex, match.index).trim();
    if (content || currentPage !== null) segments.push({ page: currentPage, content });
    currentPage = parseInt(match[1], 10);
    lastIndex = PAGE_RE.lastIndex;
  }
  const tail = markdown.slice(lastIndex).trim();
  if (tail) segments.push({ page: currentPage, content: tail });
  // Drop initial empty segment if the markdown starts with a page marker
  return segments.filter(s => s.content);
}

export default function Markdown({ markdown }) {
  const { T } = useTheme();
  const segments = useMemo(() => splitByPageMarkers(markdown || ""), [markdown]);

  // Component overrides — every Markdown element gets styled inline so we
  // don't need an external CSS file and theme switches work instantly.
  const components = useMemo(() => ({
    h1: ({ children }) => (
      <h1 style={{
        fontSize: 28, fontWeight: 700, color: T.text, fontFamily: T.font,
        margin: "32px 0 16px", lineHeight: 1.25, letterSpacing: -0.3
      }}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 style={{
        fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.font,
        margin: "28px 0 12px", lineHeight: 1.3, letterSpacing: -0.2
      }}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 style={{
        fontSize: 17, fontWeight: 600, color: T.text, fontFamily: T.fontBody,
        margin: "22px 0 10px", lineHeight: 1.4
      }}>{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 style={{
        fontSize: 15, fontWeight: 600, color: T.text, fontFamily: T.fontBody,
        margin: "18px 0 8px", lineHeight: 1.4
      }}>{children}</h4>
    ),
    p: ({ children }) => (
      <p style={{
        fontSize: 16, lineHeight: 1.75, color: T.text, fontFamily: T.fontBody,
        margin: "0 0 16px"
      }}>{children}</p>
    ),
    a: ({ href, children }) => (
      <a href={href} style={{ color: T.easy, textDecoration: "underline", textUnderlineOffset: 2 }}>
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong style={{ fontWeight: 700, color: T.text }}>{children}</strong>
    ),
    em: ({ children }) => (
      <em style={{ fontStyle: "italic", color: T.text }}>{children}</em>
    ),
    code: ({ inline, children }) => inline ? (
      <code style={{
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: "0.92em", padding: "2px 6px", borderRadius: 4,
        background: T.bgSub, color: T.text, border: `1px solid ${T.border}`
      }}>{children}</code>
    ) : (
      <code style={{
        display: "block", padding: "12px 14px", borderRadius: T.radius,
        background: T.bgSub, border: `1px solid ${T.border}`,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: 13, lineHeight: 1.55, color: T.text,
        overflow: "auto", margin: "0 0 16px"
      }}>{children}</code>
    ),
    pre: ({ children }) => <pre style={{ margin: 0 }}>{children}</pre>,
    ul: ({ children }) => (
      <ul style={{
        margin: "0 0 16px 0", paddingLeft: 24,
        fontSize: 16, lineHeight: 1.75, color: T.text, fontFamily: T.fontBody
      }}>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol style={{
        margin: "0 0 16px 0", paddingLeft: 24,
        fontSize: 16, lineHeight: 1.75, color: T.text, fontFamily: T.fontBody
      }}>{children}</ol>
    ),
    li: ({ children }) => <li style={{ marginBottom: 6 }}>{children}</li>,
    blockquote: ({ children }) => (
      <blockquote style={{
        margin: "0 0 16px", padding: "8px 18px",
        borderLeft: `3px solid ${T.borderStrong}`,
        color: T.textMid, fontStyle: "italic",
        fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.7
      }}>{children}</blockquote>
    ),
    table: ({ children }) => (
      <div style={{ overflowX: "auto", margin: "0 0 16px" }}>
        <table style={{
          borderCollapse: "collapse", width: "100%",
          fontSize: 14, fontFamily: T.fontBody, color: T.text,
        }}>{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead style={{ background: T.bgSub, borderBottom: `1px solid ${T.borderStrong}` }}>
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th style={{
        padding: "10px 12px", textAlign: "left", fontWeight: 600
      }}>{children}</th>
    ),
    td: ({ children }) => (
      <td style={{
        padding: "10px 12px", borderTop: `1px solid ${T.border}`
      }}>{children}</td>
    ),
    hr: () => (
      <hr style={{
        border: "none", borderTop: `1px solid ${T.border}`,
        margin: "32px 0"
      }} />
    ),
    img: ({ src, alt }) => (
      <img src={src} alt={alt || ""} style={{
        maxWidth: "100%", height: "auto", borderRadius: T.radius,
        margin: "8px 0 16px", display: "block"
      }} />
    ),
    mark: ({ children }) => (
      <mark style={{
        background: `${T.hard || "#c47f2a"}30`,
        color: T.text, padding: "1px 2px", borderRadius: 2,
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone"
      }}>{children}</mark>
    ),
  }), [T]);

  return (
    <div style={{ fontFamily: T.fontBody }}>
      {segments.map((seg, i) => (
        <section
          key={i}
          id={seg.page != null ? `page-${seg.page}` : undefined}
          style={{ scrollMarginTop: 24 }}
        >
          {seg.page != null && (
            <div
              aria-label={`Page ${seg.page}`}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                margin: i === 0 ? "0 0 18px" : "32px 0 18px",
                fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: T.textLight, fontFamily: T.fontBody, textTransform: "uppercase"
              }}
            >
              <span style={{ flex: 1, height: 1, background: T.border }} />
              Page {seg.page}
              <span style={{ flex: 1, height: 1, background: T.border }} />
            </div>
          )}
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
            {seg.content}
          </ReactMarkdown>
        </section>
      ))}
    </div>
  );
}
