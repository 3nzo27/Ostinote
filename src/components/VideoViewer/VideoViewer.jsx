import { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef, memo } from "react";
import useTheme from "../../theme/useTheme.js";

// Use rAF for player time sampling so the read-along highlight tracks
// the audio with a single frame of latency instead of the 250ms chunks
// a setInterval-based poll produced. Each tick is just a sync
// player.getCurrentTime() call plus one setState — cheap.
const AUTO_SCROLL_PAUSE_MS = 3000;

// Default highlight lead in ms — how much earlier than YT's reported
// time we mark a word as active, to compensate for the stacking
// latencies of (a) auto-transcript stamps being late, (b) audio output
// buffering, and (c) browser-specific playback delay. The exact right
// value varies per video and per device, so we ship a sensible default
// and let the user nudge it live with [ and ] (saved per doc).
const HIGHLIGHT_LEAD_MS_DEFAULT = 800;
const HIGHLIGHT_LEAD_STEP_MS = 100;
const HIGHLIGHT_LEAD_MIN_MS = -500;
const HIGHLIGHT_LEAD_MAX_MS = 2500;
const LEAD_STORAGE_PREFIX = "ostinote_video_lead_";

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

  // DOM refs into the transcript so the rAF tick can mutate the spans
  // directly — no React render per frame. wordElsRef holds the wrapping
  // span (for the active class and bounds checks); fillElsRef holds the
  // sweep-bar inside it that we resize every frame to show progress
  // through the spoken word.
  const wordElsRef = useRef([]);
  const fillElsRef = useRef([]);
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

  // Per-doc karaoke sync calibration. The exact lead needed varies a
  // lot by video + device, so we let the user nudge it live with [ and ]
  // and persist the value per doc id. The rAF tick reads from a ref so
  // we don't have to tear down and rebuild the loop on every change.
  const [leadMs, setLeadMs] = useState(() => {
    if (!doc?.id) return HIGHLIGHT_LEAD_MS_DEFAULT;
    try {
      const v = parseInt(localStorage.getItem(LEAD_STORAGE_PREFIX + doc.id) || "", 10);
      return Number.isFinite(v) ? v : HIGHLIGHT_LEAD_MS_DEFAULT;
    } catch { return HIGHLIGHT_LEAD_MS_DEFAULT; }
  });
  const leadMsRef = useRef(leadMs);
  useEffect(() => { leadMsRef.current = leadMs; }, [leadMs]);
  const [calibrationHint, setCalibrationHint] = useState(0); // bumps to refresh the visible chip
  const calibrationHintTimer = useRef(0);
  useEffect(() => {
    if (!doc?.id) return;
    try { localStorage.setItem(LEAD_STORAGE_PREFIX + doc.id, String(leadMs)); } catch {}
  }, [leadMs, doc?.id]);
  useEffect(() => {
    if (!playerReady) return;
    const onKey = (e) => {
      // Don't steal keystrokes from inputs / textareas / contenteditable.
      const tag = (e.target?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (e.key !== "[" && e.key !== "]") return;
      const delta = e.key === "[" ? -HIGHLIGHT_LEAD_STEP_MS : HIGHLIGHT_LEAD_STEP_MS;
      setLeadMs(prev => Math.max(HIGHLIGHT_LEAD_MIN_MS, Math.min(HIGHLIGHT_LEAD_MAX_MS, prev + delta)));
      setCalibrationHint(c => c + 1);
      clearTimeout(calibrationHintTimer.current);
      calibrationHintTimer.current = setTimeout(() => setCalibrationHint(0), 1400);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerReady]);

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

    // === Client-side time interpolation ===
    // YouTube's IFrame API only refreshes getCurrentTime() internally
    // ~4 times per second. Polling at 60Hz returns the same stale value
    // most frames, so the highlight only moves when YT happens to
    // refresh — which felt like 4Hz updates with occasional skips.
    //
    // Instead: use YT's reported time ONLY as a sync point. Between
    // refreshes, project the time forward from the last sync using
    // wall-clock elapsed * playback rate. Result: a smooth 60Hz time
    // signal that locks to YT whenever the API gives us a new value.
    let lastProgressAt = 0;
    let syncMediaT = null;   // YT's currentTime at the last real update
    let syncWallT = null;    // performance.now() at that moment
    let prevReportedT = null;

    const tick = () => {
      const player = playerRef.current;
      const reportedT = player?.getCurrentTime?.();
      const now = performance.now();

      if (reportedT != null) {
        // YT actually advanced? Re-sync. Also catches seeks: if the
        // reported time disagrees materially with our projection, we
        // trust YT and reset the base.
        const projected = (syncMediaT != null)
          ? syncMediaT + ((now - syncWallT) / 1000) * (player.getPlaybackRate?.() || 1)
          : reportedT;
        if (prevReportedT == null || reportedT !== prevReportedT || Math.abs(reportedT - projected) > 0.4) {
          syncMediaT = reportedT;
          syncWallT = now;
          prevReportedT = reportedT;
        }

        const estimatedT = syncMediaT + ((now - syncWallT) / 1000) * (player.getPlaybackRate?.() || 1);

        // Read the live lead value from a ref so [ and ] take effect
        // on the very next frame, without restarting the rAF loop.
        const cursorT = estimatedT + leadMsRef.current / 1000;
        const nextIdx = findActiveWordIdx(words, cursorT);
        const prevIdx = activeIdxRef.current;
        if (nextIdx !== prevIdx) {
          if (prevIdx >= 0) {
            const prevEl = wordElsRef.current[prevIdx];
            if (prevEl) prevEl.classList.remove("yt-word-active");
            const prevFill = fillElsRef.current[prevIdx];
            if (prevFill) prevFill.style.width = "0%";
          }
          if (nextIdx >= 0) {
            const nextEl = wordElsRef.current[nextIdx];
            if (nextEl) {
              nextEl.classList.add("yt-word-active");
              if (!userScrollRef.current && scrollRef.current) {
                const cont = scrollRef.current;
                const wRect = nextEl.getBoundingClientRect();
                const cRect = cont.getBoundingClientRect();
                if (wRect.top < cRect.top || wRect.bottom > cRect.bottom) {
                  nextEl.scrollIntoView({ behavior: "auto", block: "nearest" });
                }
              }
            }
          }
          activeIdxRef.current = nextIdx;
        }
        // Sweep the fill bar across the active word every frame. This
        // is the key trick: even if our per-word START time is slightly
        // off, the bar's continuous motion at 60Hz reads as locked to
        // the audio because the eye tracks the motion, not the word
        // boundaries. width mutation only triggers paint, not layout
        // (the fill is absolute-positioned so it doesn't resize the
        // word's text).
        if (nextIdx >= 0) {
          const fill = fillElsRef.current[nextIdx];
          if (fill) {
            const w = words[nextIdx];
            const wStart = w.start;
            const wEnd = w.end > wStart ? w.end : wStart + 0.18;
            const progress = Math.max(0, Math.min(1, (cursorT - wStart) / (wEnd - wStart)));
            fill.style.width = `${(progress * 100).toFixed(1)}%`;
          }
        }
        // Throttle the parent re-render that the progress callback
        // triggers — we don't need 60Hz updates on the scroll stripe.
        if (onScrollProgress && duration > 0 && now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
          onScrollProgress(Math.min(estimatedT / duration, 1));
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

      <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
        <ParagraphTranscript
          T={T}
          tokens={tokens}
          wordIndexMap={wordIndexMap}
          wordElsRef={wordElsRef}
          fillElsRef={fillElsRef}
          scrollRef={scrollRef}
          onScroll={handleScroll}
          onSeek={handleSeek}
        />
        {/* Calibration chip — appears briefly each time you press
            [ or ] to tune the karaoke offset. The current lead is
            persisted per doc so you only need to dial it in once. */}
        {calibrationHint > 0 && (
          <div style={{
            position: "absolute", top: 8, right: 12,
            padding: "5px 10px", borderRadius: 999,
            background: T.text, color: T.card,
            fontSize: 11, fontWeight: 600, fontFamily: T.fontBody,
            boxShadow: T.shadow2 || "0 2px 8px rgba(0,0,0,0.18)",
            pointerEvents: "none",
          }}>
            Sync {leadMs >= 0 ? "+" : ""}{leadMs}ms  &nbsp;&middot;&nbsp;  [ / ] to adjust
          </div>
        )}
      </div>
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
        const end = segOffset + ((consumedChars + part.length) / totalChars) * segDuration;
        tokens.push({ type: "word", text: part, start, end });
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
  T, tokens, wordIndexMap, wordElsRef, fillElsRef, scrollRef, onScroll, onSeek,
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
        // Stronger background opacity (66 = 40%) compensates for the
        // removed font-weight emphasis without triggering layout.
        "--yt-word-active-color": T.text,
        "--yt-word-active-bg": `${T.easy}66`,
      }}
    >
      {/* Scoped styles. The .yt-word-fill is the sweep bar that the
          rAF loop animates across the currently-spoken word. It's
          absolute-positioned so resizing it only repaints — no reflow,
          no font-weight change, no layout cost. The text sits on top
          via z-index, so the bar reads as a karaoke wipe behind it. */}
      <style>{`
        #video-transcript-pane .yt-word {
          position: relative;
          display: inline-block;
          cursor: pointer;
          border-radius: 3px;
        }
        #video-transcript-pane .yt-word-fill {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 0%;
          background: var(--yt-word-active-bg);
          border-radius: 3px;
          pointer-events: none;
        }
        #video-transcript-pane .yt-word-text {
          position: relative;
          z-index: 1;
        }
        #video-transcript-pane .yt-word.yt-word-active .yt-word-text {
          color: var(--yt-word-active-color);
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
            >
              <span
                ref={el => { fillElsRef.current[wIdx] = el; }}
                className="yt-word-fill"
                aria-hidden="true"
              />
              <span className="yt-word-text">{t.text}</span>
            </span>
          );
        })}
      </p>
      <div style={{ height: 80 }} />
    </div>
  );
});
