import { useState } from 'react';
import DrawingCanvas from '../DrawingCanvas/DrawingCanvas.jsx';
import AudioRecorder from '../AudioRecorder/AudioRecorder.jsx';
import './CardEditor.css';

const TABS = [
  { id: 'text', icon: '✎', label: 'Text' },
  { id: 'draw', icon: '🖌', label: 'Draw' },
  { id: 'audio', icon: '🎙', label: 'Audio' },
];

export default function CardEditor({ initialFront, initialBack, onSave, onCancel, saveLabel = 'Save Card' }) {
  const [activeSide, setActiveSide] = useState('front');
  const [activeTab, setActiveTab] = useState('text');
  const [front, setFront] = useState(initialFront || { text: '', drawing: null, audio: null });
  const [back, setBack] = useState(initialBack || { text: '', drawing: null, audio: null });

  const side = activeSide === 'front' ? front : back;
  const setSide = activeSide === 'front' ? setFront : setBack;

  return (
    <div className="card-editor">
      {/* Side toggle */}
      <div className="card-editor__side-toggle">
        {['front', 'back'].map(s => (
          <button
            key={s}
            onClick={() => setActiveSide(s)}
            className={`card-editor__side-btn ${activeSide === s ? `card-editor__side-btn--active-${s}` : ''}`}
          >
            {s} Side
          </button>
        ))}
      </div>

      {/* Input tabs */}
      <div className="card-editor__tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`card-editor__tab ${activeTab === t.id ? 'card-editor__tab--active' : ''}`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div className="card-editor__area">
        {activeTab === 'text' && (
          <textarea
            value={side.text}
            onChange={e => setSide({ ...side, text: e.target.value })}
            placeholder={`Type the ${activeSide} of your card...`}
            className="card-editor__textarea"
          />
        )}
        {activeTab === 'draw' && (
          <DrawingCanvas dataUrl={side.drawing} onChange={d => setSide({ ...side, drawing: d })} />
        )}
        {activeTab === 'audio' && (
          <div className="card-editor__audio-area">
            <div className="card-editor__audio-icon">🎙</div>
            <AudioRecorder audioUrl={side.audio} onChange={a => setSide({ ...side, audio: a })} />
          </div>
        )}
      </div>

      {/* Preview strip */}
      <div className="card-editor__preview">
        <div className="card-editor__preview-label">Preview</div>
        <div className="card-editor__preview-tags">
          {side.text && <span className="card-editor__preview-tag card-editor__preview-tag--text">✎ Text</span>}
          {side.drawing && <span className="card-editor__preview-tag card-editor__preview-tag--drawing">🖌 Drawing</span>}
          {side.audio && <span className="card-editor__preview-tag card-editor__preview-tag--audio">🎙 Audio</span>}
          {!side.text && !side.drawing && !side.audio && <span className="card-editor__preview-empty">Nothing yet</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="card-editor__actions">
        <button onClick={onCancel} className="card-editor__cancel-btn">Cancel</button>
        <button onClick={() => onSave(front, back)} className="card-editor__save-btn">{saveLabel}</button>
      </div>
    </div>
  );
}
