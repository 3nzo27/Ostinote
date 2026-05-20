import { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef, memo } from "react";
import useTheme from "../../theme/useTheme.js";

// Use rAF for player time sampling so the read-along highlight tracks
// the audio with a single frame of latency instead of the 250ms chunks
// a setInterval-based poll produced. Each tick is just a sync
// player.getCurrentTime() call plus one setState — cheap.
const AUTO_SCROLL_PAUSE_MS = 3000;

// YouTube's auto-generated transcript timestamps lag actual speech by
// a few hundred ms (the transcription pipeline marks a segment AFTER
// the audio for it has started). Audio output buffering adds more.
// We compensate by computing the active word for currentTime + this
// offset — effectively asking "what word will the user be hearing in
// ~LEAD_MS milliseconds?" — so the highlight lights up in step with
// what they're hearing, not after.
const HIGHLIGHT_LEAD_MS = 400;

// We don't need to update the workspace's tiny scroll-progress stripe
// 60 times per second. Throttling it down so the rAF loop doesn't
// trigger a parent re-render on every single frame frees up the main
// thread to actually paint the highlight on time.
const PROGRESS_THROTTLE_MS = 250;

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
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const pollRef = useRef(0);

  const transcript = doc?.transcript || [];

  // Tokenize the transcript here (not inside the child) so the rAF
  // callback has direct access to `words` without a closure over the
  // child's state. The child only renders once per transcript change.
  const { tokens, words, wordIndexMap } = useMemo(() => {
    const tok = tokenizeTranscript(transcript);
    const w = [];
    const map = new Array(tok.length).fill(-1);
    for (let i = 0; i < tok.length; i++) {
      if (tok[i].type === "word") { map[i] = w.length; w.push(tok[i]); }
    }
    return { tokens: tok, words: w, wordIndexMap: map };
  }, [transcript]);

  // DOM refs into the transcript so the rAF tick can toggle the active
  // class directly — no React render per frame.
  const wordElsRef = useRef([]);
  const scrollRef = useRef(null);
  const activeIdxRef = useRef(-1);
  const userScrollRef = useRef(false);
  const userScrollTimerRef = useRef(0);

  // Reset only the active-word marker when the doc / token set changes.
  // We must NOT clear wordElsRef here — the callback refs on each word
  // span have already populated it during mount, so wiping it here would
  // immediately erase every reference and the rAF tick would never find
  // a span to highlight. React handles per-element cleanup automatically
  // (old refs are called with null when spans unmount).
  useEffect(() => {
    activeIdxRef.current = -1;
  }, [words]);

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
      cancelAnimationFrame(pollRef.current);
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

  // rAF read-along loop. This is the hot path — runs every frame the
  // browser paints (~60Hz) while the video plays. We never call setState
  // here; we just mutate two DOM nodes (the previously-active span and
  // the newly-active one). No React reconciliation, no parent re-render,
  // no list iteration — just classList.toggle, which is sub-millisecond.
  // That's why the highlight no longer lags-then-skips: there's literally
  // nothing for it to back up on.
  useEffect(() => {
    cancelAnimationFrame(pollRef.current);
    if (!playing) return;

    let lastProgressAt = 0;
    const leadSec = HIGHLIGHT_LEAD_MS / 1000;

    const tick = () => {
      const player = playerRef.current;
      const t = player?.getCurrentTime?.();
      if (t != null) {
        // Find active word via binary search on currentTime + lead
        // offset so the highlight is in step with the user's actual
        // hearing, not with YT's transcript metadata.
        const nextIdx = findActiveWordIdx(words, t + leadSec);
        const prevIdx = activeIdxRef.current;
        if (nextIdx !== prevIdx) {
          if (prevIdx >= 0) {
            const prevEl = wordElsRef.current[prevIdx];
            if (prevEl) prevEl.classList.remove("yt-word-active");
          }
          if (nextIdx >= 0) {
            const nextEl = wordElsRef.current[nextIdx];
            if (nextEl) {
              nextEl.classList.add("yt-word-active");
              // Scroll-in-view only on word change (not every frame),
              // and only when the user isn't actively scrolling
              // themselves. behavior:"auto" so smooth-scroll never
              // queues up multiple animations behind one another.
              if (!userScrollRef.current) {
                nextEl.scrollIntoView({ behavior: "auto", block: "nearest" });
              }
            }
          }
          activeIdxRef.current = nextIdx;
        }
        // Throttle the progress callback — it triggers a parent React
        // re-render which we don't want competing with the highlight
        // paint every frame.
        const now = performance.now();
        if (onScrollProgress && duration > 0 && now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
          onScrollProgress(Math.min(t / duration, 1));
          lastProgressAt = now;
        }
      }
      pollRef.current = requestAnimationFrame(tick);
    };
    pollRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(pollRef.current);
  }, [playing, words, duration, onScrollProgress]);

  const handleScroll = useCallback(() => {
    userScrollRef.current = true;
    clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = setTimeout(() => { userScrollRef.current = false; }, AUTO_SCROLL_PAUSE_MS);
  }, []);

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
        tokens={tokens}
        wordIndexMap={wordIndexMap}
        wordElsRef={wordElsRef}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        onSeek={handleSeek}
      />
    </div>
  );
});

export default VideoViewer;

// Flatten the segment-level transcript into per-word tokens with
// estimated start times. YouTube only gives segment-level timing (one
// offset + duration per ~1-10 word utterance), so we have to estimate
// where each word falls within its segment.
//
// Naive "split duration evenly across words" makes long words fly by
// too fast and short words drag — the highlight feels out of step. We
// weight each word's slice by character count instead; this tracks
// natural speech rhythm a lot better since speakers spend proportionally
// more time on longer words.
function tokenizeTranscript(transcript) {
  const tokens = [];
  for (let s = 0; s < transcript.length; s++) {
    const seg = transcript[s];
    const segOffset = seg.offset ?? seg.start ?? 0;
    const segDuration = seg.duration ?? 0;
    const parts = (seg.text || "").split(/(\s+)/);
    const wordParts = parts.filter(p => /\S/.test(p));
    const totalChars = wordParts.reduce((sum, w) => sum + w.length, 0) || 1;
    let consumedChars = 0;
    for (const part of parts) {
      if (!part) continue;
      if (/\S/.test(part)) {
        const start = segOffset + (consumedChars / totalChars) * segDuration;
        tokens.push({ type: "word", text: part, start });
        consumedChars += part.length;
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

// Paragraph-style transcript. Renders ONCE per transcript (memoized on
// the tokens array) — the per-frame highlight is driven by direct DOM
// mutation in the parent's rAF loop, NOT by re-rendering this tree.
// That removes the React reconciliation cost from the hot path, which
// was the source of the lag-then-skip pattern when the audio outran
// the parent's render cycle.
const ParagraphTranscript = memo(function ParagraphTranscript({
  T, tokens, wordIndexMap, wordElsRef, scrollRef, onScroll, onSeek,
}) {
  if (!tokens.length) {
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
      onScroll={onScroll}
      style={{
        flex: 1, overflowY: "auto", minHeight: 0,
        padding: "20px 22px",
        fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.85,
        color: T.textMid,
        userSelect: "text",
        // Theme-driven active-word styling lives on a CSS-var so the
        // class toggled by the rAF loop picks up the current theme
        // automatically — no JS restyle needed on dark-mode toggle.
        "--yt-word-active-color": T.text,
        "--yt-word-active-bg": `${T.easy}40`,
      }}
    >
      {/* Scoped styles for the read-along highlight. Inlined here so
          the rule lives with the only component that uses it. */}
      <style>{`
        #video-transcript-pane .yt-word.yt-word-active {
          color: var(--yt-word-active-color);
          background: var(--yt-word-active-bg);
          font-weight: 700;
        }
      `}</style>
      <p style={{ margin: 0 }}>
        {tokens.map((t, i) => {
          if (t.type === "space") return <span key={i}>{t.text}</span>;
          const wIdx = wordIndexMap[i];
          return (
            <span
              key={i}
              ref={el => { wordElsRef.current[wIdx] = el; }}
              className="yt-word"
              data-timestamp={t.start}
              onClick={() => onSeek(t.start)}
              style={{
                padding: "0 2px",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >{t.text}</span>
          );
        })}
      </p>
      <div style={{ height: 80 }} />
    </div>
  );
});
