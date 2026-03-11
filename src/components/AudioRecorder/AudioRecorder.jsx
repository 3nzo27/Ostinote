import { useState, useRef } from 'react';
import './AudioRecorder.css';

export default function AudioRecorder({ audioUrl, onChange }) {
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
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
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
    } catch (err) {
      alert('Microphone access is needed to record audio.');
    }
  };

  const stopRecording = () => {
    if (mediaRec.current && mediaRec.current.state !== 'inactive') {
      mediaRec.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const removeAudio = () => {
    onChange(null);
    setDuration(0);
  };

  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="audio-recorder">
      {!recording && !audioUrl && (
        <button onClick={startRecording} className="audio-recorder__record-btn">
          <span className="audio-recorder__record-dot" /> Record Audio
        </button>
      )}
      {recording && (
        <button onClick={stopRecording} className="audio-recorder__stop-btn">
          <span className="audio-recorder__stop-icon" />
          Stop · {fmtTime(duration)}
        </button>
      )}
      {audioUrl && !recording && (
        <div className="audio-recorder__playback">
          <audio src={audioUrl} controls className="audio-recorder__audio" />
          <button onClick={removeAudio} className="audio-recorder__remove-btn">×</button>
        </div>
      )}
    </div>
  );
}
