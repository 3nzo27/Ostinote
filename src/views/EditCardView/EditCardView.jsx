import useTheme from "../../theme/useTheme.js";
import CardEditor from "../../components/CardEditor/CardEditor.jsx";

export default function EditCardView({ card, onSave, onCancel }) {
  const { T } = useTheme();
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "calc(24px + var(--sat)) calc(16px + var(--sar)) calc(24px + var(--sab)) calc(16px + var(--sal))", minHeight: "100vh", fontFamily: T.fontBody, background: T.bg };

  return (
    <div style={containerStyle}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 20, fontFamily: T.font }}>Edit Card</h2>
      <div style={{ animation: "fadeIn 0.3s ease" }}>
        <CardEditor
          initialFront={card.front}
          initialBack={card.back}
          initialTags={card.tags}
          onSave={onSave}
          onCancel={onCancel}
          saveLabel="Update Card"
        />
      </div>
    </div>
  );
}
