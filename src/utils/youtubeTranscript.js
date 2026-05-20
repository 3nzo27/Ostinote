// YouTube transcript utilities.
// Fetches captions via server-side proxy (Vite plugin or Electron bridge)
// since YouTube blocks CORS from browsers.

const YT_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
];

export function parseYouTubeUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const cleaned = url.trim();
    for (const re of YT_URL_PATTERNS) {
      const m = cleaned.match(re);
      if (m) return { videoId: m[1] };
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(cleaned)) return { videoId: cleaned };
    return null;
  } catch {
    return null;
  }
}

export async function fetchTranscript(videoId) {
  let raw;
  if (window.ostinoteYT?.getTranscript) {
    raw = await window.ostinoteYT.getTranscript({ videoId });
  } else {
    const res = await fetch("/_yt/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "Unknown error");
      throw new Error(msg || "Failed to fetch transcript");
    }
    raw = await res.json();
  }
  return raw.map(s => ({
    text: s.text,
    offset: (s.offset ?? 0) / 1000,
    duration: (s.duration ?? 0) / 1000,
  }));
}

// Fetches YouTube's word-level caption timing (json3 format). Returns
// a flat array of { text, start } where start is in seconds. Falls
// back through the Electron bridge → Vite dev plugin → throws.
//
// This is the perfect timing source — it's the same data YouTube uses
// to render captions, with millisecond accuracy per word for auto-
// generated captions. No estimation, no interpolation needed.
export async function fetchWordTimings(videoId) {
  if (window.ostinoteYT?.getWordTimings) {
    return window.ostinoteYT.getWordTimings({ videoId });
  }
  const res = await fetch("/_yt/word-timings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "Unknown error");
    throw new Error(msg || "Failed to fetch word timings");
  }
  return res.json();
}

export async function fetchVideoInfo(videoId) {
  if (window.ostinoteYT?.getVideoInfo) {
    return window.ostinoteYT.getVideoInfo({ videoId });
  }
  const res = await fetch(`/_yt/video-info?v=${encodeURIComponent(videoId)}`);
  if (!res.ok) return { title: null };
  return res.json();
}

export function formatTimestamp(seconds) {
  if (seconds == null || isNaN(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatTranscriptAsText(segments) {
  if (!segments || segments.length === 0) return "";
  const lines = [];
  let lastMarker = -999;
  for (const seg of segments) {
    const t = seg.offset ?? seg.start ?? 0;
    if (t - lastMarker >= 30) {
      lines.push(`\n--- ${formatTimestamp(t)} ---`);
      lastMarker = t;
    }
    lines.push(seg.text);
  }
  return lines.join("\n").trim();
}
