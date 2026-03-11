import CardEditor from '../../components/CardEditor/CardEditor.jsx';
import './EditCardView.css';

export default function EditCardView({ card, onSave, onCancel }) {
  return (
    <div className="app-container edit-card-view">
      <h2 className="edit-card-view__title">Edit Card</h2>
      <div className="edit-card-view__editor">
        <CardEditor
          initialFront={card.front}
          initialBack={card.back}
          onSave={onSave}
          onCancel={onCancel}
          saveLabel="Update Card"
        />
      </div>
    </div>
  );
}
