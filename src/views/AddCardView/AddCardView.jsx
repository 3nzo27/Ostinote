import CardEditor from '../../components/CardEditor/CardEditor.jsx';
import './AddCardView.css';

export default function AddCardView({ onSave, onCancel }) {
  return (
    <div className="app-container add-card-view">
      <h2 className="add-card-view__title">New Card</h2>
      <div className="add-card-view__editor">
        <CardEditor onSave={onSave} onCancel={onCancel} saveLabel="Add Card" />
      </div>
    </div>
  );
}
