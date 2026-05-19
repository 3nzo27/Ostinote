import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef, memo } from "react";
import useTheme from "../../theme/useTheme.js";
import { formatTimestamp } from "../../utils/youtubeTranscript.js";

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

  const activeIdx = findActiveSegment(transcript, currentTime);

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

      <TranscriptPane
        T={T}
        transcript={transcript}
        activeIdx={activeIdx}
        onSeek={handleSeek}
      />
    </div>
  );
});

export default VideoViewer;

function findActiveSegment(transcript, time) {
  if (!transcript.length) return -1;
  let best = -1;
  for (let i = 0; i < transcript.length; i++) {
    const offset = transcript[i].offset ?? transcript[i].start ?? 0;
    if (offset <= time) best = i;
    else break;
  }
  return best;
}

const TranscriptPane = memo(function TranscriptPane({ T, transcript, activeIdx, onSeek }) {
  const scrollRef = useRef(null);
  const userScrollRef = useRef(false);
  const timerRef = useRef(0);

  useEffect(() => {
    if (userScrollRef.current) return;
    if (activeIdx < 0) return;
    const el = scrollRef.current?.children?.[activeIdx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIdx]);

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
        flex: 1, overflowY: "auto", padding: "8px 0", minHeight: 0,
      }}
    >
      {transcript.map((seg, i) => {
        const offset = seg.offset ?? seg.start ?? 0;
        const isActive = i === activeIdx;
        return (
          <div
            key={i}
            data-timestamp={offset}
            onClick={() => onSeek(offset)}
            style={{
              display: "flex", gap: 10, padding: "6px 14px",
              cursor: "pointer", transition: "background 0.15s",
              background: isActive ? (T.easy + "18") : "transparent",
              borderLeft: isActive ? `3px solid ${T.hard || "#c47f2a"}` : "3px solid transparent",
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = T.bgSub; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{
              flexShrink: 0, width: 48, fontSize: 11, fontWeight: 600,
              color: isActive ? T.hard || "#c47f2a" : T.textLight,
              fontFamily: T.fontBody, paddingTop: 2,
            }}>
              {formatTimestamp(offset)}
            </span>
            <span style={{
              fontSize: 13, lineHeight: 1.5, color: isActive ? T.text : T.textMid,
              fontFamily: T.fontBody, userSelect: "text",
            }}>
              {seg.text}
            </span>
          </div>
        );
      })}
      <div style={{ height: 80 }} />
    </div>
  );
});
