import { useState, useRef, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";

const BAR_COUNT = 32;

export default function AudioRecorder({ audioUrl, onChange }) {
  const { T } = useTheme();
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [bars, setBars] = useState(() => new Array(BAR_COUNT).fill(0));
  const mediaRec = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup if user navigates away mid-recording
  useEffect(() => {
    return () => stopVisualization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Hook up the Web Audio analyzer for live amplitude bars.
      // fftSize 128 gives 64 frequency bins; we average down to BAR_COUNT bars.
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 128;
      analyzer.smoothingTimeConstant = 0.7;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyzer);
      audioContextRef.current = audioContext;

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const step = Math.floor(dataArray.length / BAR_COUNT) || 1;

      const drawBars = () => {
        analyzer.getByteFrequencyData(dataArray);
        const next = new Array(BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          // Average each band → smoother bars than raw bin values
          let sum = 0;
          let count = 0;
          for (let j = 0; j < step; j++) {
            const v = dataArray[i * step + j];
            if (v !== undefined) { sum += v; count++; }
          }
          next[i] = count > 0 ? sum / count / 255 : 0;
        }
        setBars(next);
        animationFrameRef.current = requestAnimationFrame(drawBars);
      };
      drawBars();

      // Standard MediaRecorder setup
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = e => chunks.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      mediaRec.current = rec;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      alert("Microphone access is needed to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRec.current?.state !== "inactive") mediaRec.current?.stop();
    stopVisualization();
    setRecording(false);
    setBars(new Array(BAR_COUNT).fill(0));
    clearInterval(timerRef.current);
  };

  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%" }}>
      {/* Visualization area — fixed dimensions so layout doesn't jump between states */}
      <div style={{
        position: "relative",
        width: 240, height: 64,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        {/* Idle: centered red dot inside ring */}
        {!recording && !audioUrl && (
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: `2px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s"
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: T.due, opacity: 0.35,
              animation: "pulse 2s ease-in-out infinite"
            }} />
          </div>
        )}

        {/* Recording: live audio-level bars */}
        {recording && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 3, width: "100%", height: "100%",
            animation: "fadeIn 0.15s ease"
          }}>
            {bars.map((level, i) => {
              // Minimum visible height so silent moments still show "alive" bars
              const heightPct = Math.max(level * 100, 8);
              return (
                <div key={i} style={{
                  width: 4,
                  height: `${heightPct}%`,
                  background: T.due,
                  borderRadius: 2,
                  opacity: 0.55 + level * 0.45,
                  transition: "height 60ms linear, opacity 60ms linear"
                }} />
              );
            })}
          </div>
        )}

        {/* Saved: green check confirming a clip is captured */}
        {audioUrl && !recording && (
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: `2px solid ${T.good}`,
            background: `${T.good}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)"
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.good} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Action area */}
      {!recording && !audioUrl && (
        <button onClick={startRecording} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: T.radius,
          background: T.due, color: "#fff", border: "none", fontWeight: 600, fontSize: 13,
          cursor: "pointer", fontFamily: T.fontBody, boxShadow: "0 2px 8px rgba(196,67,42,0.25)",
          transition: "transform 0.15s"
        }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = ""}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          Record Audio
        </button>
      )}
      {recording && (
        <button onClick={stopRecording} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: T.radius,
          background: T.text, color: "#fff", border: "none", fontWeight: 600, fontSize: 13,
          cursor: "pointer", fontFamily: T.fontBody
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: T.due, display: "inline-block" }} />
          Stop · {fmtTime(duration)}
        </button>
      )}
      {audioUrl && !recording && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <audio src={audioUrl} controls style={{ height: 36 }} />
          <button onClick={() => { onChange(null); setDuration(0); }} style={{
            width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${T.border}`,
            background: T.white, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center",
            justifyContent: "center", color: T.textLight
          }}>×</button>
        </div>
      )}
    </div>
  );
}
