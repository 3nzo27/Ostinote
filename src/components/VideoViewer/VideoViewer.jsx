import { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef, memo } from "react";
import useTheme from "../../theme/useTheme.js";
import { fetchWordTimings } from "../../utils/youtubeTranscript.js";
import { updateDocument } from "../../utils/documentStore.js";

// Read-along uses YouTube's json3 caption data (doc.wordTimings),
// which has per-word timing with millisecond accuracy — the same data
// YouTube uses to render its native captions. No estimation, no
// interpolation, no per-doc calibration: light up the word whose
// start <= currentTime, period.
const AUTO_SCROLL_PAUSE_MS = 3000;
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

  // Word-level timing comes from YouTube's json3 / srv3 caption data
  // (perfect timing) when available. For pre-existing docs we
  // lazy-fetch on mount and persist. If YT only has segment-level
  // captions (manually-uploaded videos sometimes do), we fall back to
  // the segment transcript and highlight at segment granularity —
  // still timing-accurate, just less granular.
  const [wordTimings, setWordTimings] = useState(doc?.wordTimings || null);
  const [wordTimingsError, setWordTimingsError] = useState(null);
  useEffect(() => {
    setWordTimings(doc?.wordTimings || null);
    setWordTimingsError(null);
  }, [doc?.id, doc?.wordTimings]);
  useEffect(() => {
    if (wordTimings || !doc?.videoId) return;
    let cancelled = false;
    fetchWordTimings(doc.videoId)
      .then(words => {
        if (cancelled) return;
        if (!words?.length) throw new Error("No timing data");
        setWordTimings(words);
        updateDocument(doc.id, { wordTimings: words }).catch(() => {});
      })
      .catch(() => {
        if (cancelled) return;
        // Fallback: derive timings from the segment-level transcript
        // we already saved when adding the video. Each segment becomes
        // one entry — the whole segment text highlights when the audio
        // hits its start. Imperfect granularity, but real timing.
        const segs = doc?.transcript || [];
        if (segs.length) {
          const fallback = segs.map(s => ({
            text: s.text,
            start: s.offset ?? s.start ?? 0,
          }));
          setWordTimings(fallback);
        } else {
          setWordTimingsError("No captions available for this video");
        }
      });
    return () => { cancelled = true; };
  }, [wordTimings, doc?.id, doc?.videoId, doc?.transcript]);

  const { tokens, words, wordIndexMap } = useMemo(() => {
    const tok = buildTokens(wordTimings);
    const w = [];
    const map = new Array(tok.length).fill(-1);
    for (let i = 0; i < tok.length; i++) {
      if (tok[i].type === "word") { map[i] = w.length; w.push(tok[i]); }
    }
    return { tokens: tok, words: w, wordIndexMap: map };
  }, [wordTimings]);

  // DOM refs into the transcript so the rAF tick can toggle the active
  // class directly — no React render per frame.
  const wordElsRef = useRef([]);
  const scrollRef = useRef(null);
  const activeIdxRef = useRef(-1);
  const userScrollRef = useRef(false);
  const userScrollTimerRef = useRef(0);
  // The scrollTop value WE last wrote programmatically. The scroll
  // handler compares against it to tell our own auto-scroll apart from
  // a real user scroll — without this, every eased frame fires a
  // scroll event that the handler mistakes for the user grabbing the
  // scrollbar, which kills the auto-follow after one frame.
  const lastAutoScrollTopRef = useRef(-1);

  // Reset only the active-word marker when the doc / token set changes.
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
    const tick = () => {
      const player = playerRef.current;
      const t = player?.getCurrentTime?.();
      const now = performance.now();
      if (t != null) {
        // Word timings come from YouTube's caption JSON — same data
        // YT uses to render its native captions, with millisecond
        // accuracy. Just find the active word and toggle the class.
        const nextIdx = findActiveWordIdx(words, t);
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
              // Line-at-a-time follow: keep the active word's line
              // anchored ~30% down the pane. While reading across a
              // single line the word stays put (delta ≈ 0, no scroll);
              // the moment the highlight crosses onto a new line the
              // word drifts a full line below the anchor and we snap
              // the scroll by exactly that delta. The snap is instant
              // (no easing) so the text steps line by line rather than
              // gliding continuously.
              if (!userScrollRef.current && scrollRef.current) {
                const cont = scrollRef.current;
                const wRect = nextEl.getBoundingClientRect();
                const cRect = cont.getBoundingClientRect();
                const lineH = wRect.height || 24;
                const anchorY = cRect.top + cRect.height * 0.3;
                const delta = wRect.top - anchorY;
                // Only act once the word has drifted at least half a
                // line off the anchor — i.e. it changed lines.
                if (Math.abs(delta) > lineH * 0.5) {
                  cont.scrollTop += delta;
                  lastAutoScrollTopRef.current = cont.scrollTop;
                }
              }
            }
          }
          activeIdxRef.current = nextIdx;
        }
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
    const cont = scrollRef.current;
    // Ignore the scroll events our own auto-follow generates. If the
    // current position matches the value we just wrote, it's us; only
    // a mismatch means the user actually grabbed the scrollbar.
    if (cont && Math.abs(cont.scrollTop - lastAutoScrollTopRef.current) < 2) return;
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
        loading={!wordTimings && !wordTimingsError}
        error={wordTimingsError}
      />
    </div>
  );
});

export default VideoViewer;

// Build the flat token list (words + whitespace) from json3 word
// timings. Word timings come from YouTube's caption data verbatim, so
// each word's `start` is the real start time of the spoken word.
// We weave in space tokens between consecutive words so the rendered
// paragraph reads naturally.
function buildTokens(wordTimings) {
  if (!wordTimings || !wordTimings.length) return [];
  const tokens = [];
  for (let i = 0; i < wordTimings.length; i++) {
    const w = wordTimings[i];
    // The token text from json3 sometimes already includes a leading
    // newline or space; normalize whitespace so it just renders inline.
    const text = String(w.text || "").replace(/\s+/g, " ");
    if (!text || text === " ") continue;
    if (i > 0) tokens.push({ type: "space", text: " " });
    tokens.push({ type: "word", text: text.trim(), start: w.start });
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
  loading, error,
}) {
  if (loading) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: T.textLight, fontSize: 13, fontFamily: T.fontBody, padding: 32,
      }}>
        Loading captions…
      </div>
    );
  }
  if (error || !tokens.length) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: T.textLight, fontSize: 13, fontFamily: T.fontBody, padding: 32,
        textAlign: "center", maxWidth: 360, margin: "0 auto",
      }}>
        {error || "No captions available for this video."}
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
        // Stronger background opacity (66 = 40%) compensates for the
        // removed font-weight emphasis without triggering layout.
        "--yt-word-active-color": T.text,
        "--yt-word-active-bg": `${T.easy}66`,
      }}
    >
      {/* Scoped styles for the read-along highlight. Only color +
          background change — both paint-only properties, so the class
          toggle is sub-millisecond and never triggers paragraph reflow. */}
      <style>{`
        #video-transcript-pane .yt-word.yt-word-active {
          color: var(--yt-word-active-color);
          background: var(--yt-word-active-bg);
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
