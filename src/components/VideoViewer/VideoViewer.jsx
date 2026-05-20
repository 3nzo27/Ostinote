import { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef, memo } from "react";
import useTheme from "../../theme/useTheme.js";

const POLL_MS = 250;
const AUTO_SCROLL_PAUSE_MS = 3000;

let ytApiLoading = false;
let ytApiReady = !!window.YT?.Player;
const ytApiCallbacks = [];

function ensureYTApi() {
  if (ytApiReady) return Promise.resolve();
  return new Promise((resolve) => {
    ytApiCallbacks.push(resolve);
    if (ytApiLoading) return;
    ytApiLoading = true;
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      ytApiReady = true;
      prev?.();
      ytApiCallbacks.forEach((fn) => fn());
      ytApiCallbacks.length = 0;
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
}

const VideoViewer = forwardRef(function VideoViewer({ doc, onHighlight, onScrollProgress }, ref) {
  const { T } = useTheme();
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const pollRef = useRef(0);

  const transcript = doc?.transcript || [];

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      playerRef.current?.seekTo(seconds, true);
    },
  }));

  useEffect(() => {
    if (!doc?.videoId) return;
    let destroyed = false;
    let player = null;

    ensureYTApi().then(() => {
      if (destroyed) return;
      const el = containerRef.current?.querySelector(".yt-player-target");
      if (!el) return;
      player = new window.YT.Player(el, {
        videoId: doc.videoId,
        playerVars: { modestbranding: 1, rel: 0, autoplay: 0 },
        events: {
          onReady: () => {
            if (destroyed) return;
            playerRef.current = player;
            setDuration(player.getDuration?.() || 0);
            setPlayerReady(true);
          },
          onStateChange: (e) => {
            if (destroyed) return;
            const isPlaying = e.data === window.YT.PlayerState.PLAYING;
            setPlaying(isPlaying);
            if (isPlaying) {
              setDuration(player.getDuration?.() || 0);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      clearInterval(pollRef.current);
      if (player?.destroy) try { player.destroy(); } catch {}
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [doc?.videoId]);

  // Tell the YT player about container size changes so it actually
  // redraws after a Tool Bar resize. Without this, the iframe stretches
  // via CSS but YouTube's internal video element keeps the old
  // dimensions and the picture only re-fits after some delayed event
  // (window blur, full-screen toggle, etc).
  useEffect(() => {
    if (!playerReady) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let rafId = 0;
    const apply = () => {
      const player = playerRef.current;
      if (!player?.setSize) return;
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 0 && h > 0) {
        try { player.setSize(w, h); } catch {}
      }
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(apply);
    });
    ro.observe(el);
    apply(); // initial sync after ready
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [playerReady]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (!playing) return;
    pollRef.current = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.();
      if (t != null) {
        setCurrentTime(t);
        if (onScrollProgress && duration > 0) {
          onScrollProgress(Math.min(t / duration, 1));
        }
      }
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [playing, duration, onScrollProgress]);

  const handleSeek = useCallback((offset) => {
    playerRef.current?.seekTo(offset, true);
  }, []);

  const handleTextSelect = useCallback(() => {
    if (!onHighlight) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 4) return;
    const transcriptEl = document.getElementById("video-transcript-pane");
    if (!transcriptEl?.contains(sel.anchorNode)) return;
    let ts = null;
    let node = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
    while (node && node !== transcriptEl) {
      if (node.dataset?.timestamp != null) { ts = parseFloat(node.dataset.timestamp); break; }
      node = node.parentElement;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    onHighlight({ text, page: ts != null ? Math.floor(ts) : null, x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, [onHighlight]);

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelect);
    return () => document.removeEventListener("mouseup", handleTextSelect);
  }, [handleTextSelect]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div ref={containerRef} style={{
        width: "100%", background: "#000", flexShrink: 0,
        position: "relative", paddingBottom: "56.25%",
      }}>
        <div className="yt-player-target" style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
        }} />
      </div>

      <ParagraphTranscript
        T={T}
        transcript={transcript}
        currentTime={currentTime}
        onSeek={handleSeek}
      />
    </div>
  );
});

export default VideoViewer;

// Flatten the segment-level transcript into per-word tokens with
// estimated start times. YouTube only gives us segment-level timing
// (one offset + duration per ~1-10 word utterance), so we distribute
// each segment's duration evenly across its words. Not literally
// accurate but visually convincing for a karaoke-style read-along —
// the highlight tracks the spoken cadence to within ~500ms.
function tokenizeTranscript(transcript) {
  const tokens = [];
  for (let s = 0; s < transcript.length; s++) {
    const seg = transcript[s];
    const segOffset = seg.offset ?? seg.start ?? 0;
    const segDuration = seg.duration ?? 0;
    const parts = (seg.text || "").split(/(\s+)/);
    // Words only (non-whitespace) drive timing; whitespace tokens are
    // emitted between them as plain text.
    const wordCount = parts.filter(p => /\S/.test(p)).length;
    const perWord = wordCount > 0 ? segDuration / wordCount : 0;
    let wordI = 0;
    for (const part of parts) {
      if (!part) continue;
      if (/\S/.test(part)) {
        const start = segOffset + wordI * perWord;
        tokens.push({ type: "word", text: part, start });
        wordI++;
      } else {
        tokens.push({ type: "space", text: part });
      }
    }
    // Ensure visual separation between consecutive segments.
    tokens.push({ type: "space", text: " " });
  }
  return tokens;
}

// Binary search for the largest word-token index whose start time is
// at or before `time`. Linear scan would be fine at 1500 words but
// this is what we'd want at any larger scale.
function findActiveWordIdx(words, time) {
  if (!words.length) return -1;
  let lo = 0, hi = words.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= time) { best = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best;
}

// Paragraph-style transcript with karaoke-style read-along highlight.
// Past words read at full strength (T.text), the current word is lifted
// with a subtle background tint, and upcoming words sit muted in
// T.textLight so the eye naturally tracks forward. Click any word to
// seek the video to that point.
const ParagraphTranscript = memo(function ParagraphTranscript({ T, transcript, currentTime, onSeek }) {
  const scrollRef = useRef(null);
  const activeWordRef = useRef(null);
  const userScrollRef = useRef(false);
  const timerRef = useRef(0);

  // tokens contains both words (with start times) and whitespace; the
  // wordIndexMap maps token index -> word-only index (used to find the
  // active token after binary-searching words[]).
  const { tokens, words, wordIndexMap } = useMemo(() => {
    const tok = tokenizeTranscript(transcript || []);
    const w = [];
    const map = new Array(tok.length).fill(-1);
    for (let i = 0; i < tok.length; i++) {
      if (tok[i].type === "word") {
        map[i] = w.length;
        w.push(tok[i]);
      }
    }
    return { tokens: tok, words: w, wordIndexMap: map };
  }, [transcript]);

  const activeWord = findActiveWordIdx(words, currentTime);

  // Auto-scroll the active word into view, but only when the user
  // hasn't recently scrolled themselves. block: "nearest" keeps the
  // motion minimal — no scroll happens if the word is already on-screen.
  useEffect(() => {
    if (userScrollRef.current) return;
    if (activeWord < 0) return;
    const el = activeWordRef.current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeWord]);

  const handleScroll = useCallback(() => {
    userScrollRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { userScrollRef.current = false; }, AUTO_SCROLL_PAUSE_MS);
  }, []);

  if (!transcript.length) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: T.textLight, fontSize: 13, fontFamily: T.fontBody, padding: 32,
      }}>
        No transcript available for this video.
      </div>
    );
  }

  return (
    <div
      id="video-transcript-pane"
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        flex: 1, overflowY: "auto", minHeight: 0,
        padding: "20px 22px",
        fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.85,
        color: T.textLight,
        userSelect: "text",
      }}
    >
      <p style={{ margin: 0 }}>
        {tokens.map((t, i) => {
          if (t.type === "space") {
            return <span key={i}>{t.text}</span>;
          }
          const wIdx = wordIndexMap[i];
          const isActive = wIdx === activeWord;
          const isPast = wIdx < activeWord;
          return (
            <Word
              key={i}
              ref={isActive ? activeWordRef : null}
              T={T}
              text={t.text}
              start={t.start}
              isActive={isActive}
              isPast={isPast}
              onSeek={onSeek}
            />
          );
        })}
      </p>
      <div style={{ height: 80 }} />
    </div>
  );
});

// Memoized word span. Each tick only re-renders the small handful of
// words whose isActive/isPast actually changed (memo's shallowEqual
// skips the rest), so even multi-thousand-word transcripts stay smooth.
const Word = memo(forwardRef(function Word({ T, text, start, isActive, isPast, onSeek }, ref) {
  const color = isActive ? T.text : (isPast ? T.text : T.textLight);
  return (
    <span
      ref={ref}
      data-timestamp={start}
      onClick={() => onSeek(start)}
      style={{
        color,
        background: isActive ? `${T.easy}33` : "transparent",
        padding: "0 1px",
        borderRadius: 3,
        cursor: "pointer",
        fontWeight: isActive ? 600 : (isPast ? 500 : 400),
        transition: "background 0.12s, color 0.12s",
      }}
    >{text}</span>
  );
}));
