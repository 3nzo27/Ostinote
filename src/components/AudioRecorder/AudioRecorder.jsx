import { useState, useRef } from "react";
import useTheme from "../../theme/useTheme.js";

export default function AudioRecorder({ audioUrl, onChange }) {
  const { T } = useTheme();
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRec = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    if (mediaRec.current?.state !== "inactive") mediaRec.current.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {!recording && !audioUrl && (
        <button onClick={startRecording} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: T.radius,
          background: T.due, color: "#fff", border: "none", fontWeight: 600, fontSize: 13,
          cursor: "pointer", fontFamily: T.fontBody, boxShadow: "0 2px 8px rgba(196,67,42,0.25)"
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          Record Audio
        </button>
      )}
      {recording && (
        <button onClick={stopRecording} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: T.radius,
          background: T.text, color: "#fff", border: "none", fontWeight: 600, fontSize: 13,
          cursor: "pointer", fontFamily: T.fontBody, animation: "pulse 1.5s infinite"
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
