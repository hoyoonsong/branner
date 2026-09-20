import type { StandardAppItem } from '../../types/application';

/** Full set of field types available in the builder — including If/Then follow-ups. */
export const FIELD_PICKER_OPTIONS: {
  type: StandardAppItem['type'];
  label: string;
  icon: string;
  description: string;
}[] = [
  { type: 'section', label: 'Section', icon: '📑', description: 'Heading / divider' },
  { type: 'short_text', label: 'Short Text', icon: '📝', description: 'Single-line answer' },
  { type: 'long_text', label: 'Long Text', icon: '📄', description: 'Paragraph answer' },
  { type: 'number', label: 'Number', icon: '🔢', description: 'Numeric answer' },
  { type: 'email', label: 'Email', icon: '✉️', description: 'Email address' },
  { type: 'phone', label: 'Phone', icon: '📞', description: 'Phone number' },
  { type: 'date', label: 'Date', icon: '📅', description: 'Calendar date' },
  { type: 'select', label: 'Dropdown', icon: '📋', description: 'Pick one from a list' },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: '⭕', description: 'Radio button options' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️', description: 'Yes / no toggle' },
  { type: 'address', label: 'Address', icon: '🏠', description: 'Mailing address' },
  { type: 'location', label: 'Location', icon: '📍', description: 'Share or type location' },
  { type: 'file', label: 'File upload', icon: '📎', description: 'Upload a file or link' },
  { type: 'headshot', label: 'Image Upload', icon: '🖼', description: 'Upload and crop an image' },
];

type FieldTypePickerModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (type: StandardAppItem['type']) => void;
  onAddConditional?: () => void;
  disabled?: boolean;
  title?: string;
};

export default function FieldTypePickerModal({
  open,
  onClose,
  onAdd,
  onAddConditional,
  disabled = false,
  title = 'Add a question',
}: FieldTypePickerModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {FIELD_PICKER_OPTIONS.map(({ type, label, icon, description }) => (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onAdd(type)}
              className="flex flex-col items-start rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="mb-1 text-lg">{icon}</span>
              <span className="text-sm font-medium text-gray-900">{label}</span>
              <span className="mt-0.5 text-[11px] leading-tight text-gray-500">{description}</span>
            </button>
          ))}
          {onAddConditional && (
            <button
              type="button"
              disabled={disabled}
              onClick={onAddConditional}
              className="flex flex-col items-start rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3 text-left hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
            >
              <span className="mb-1 text-lg">🔀</span>
              <span className="text-sm font-medium text-indigo-900">If / Then</span>
              <span className="mt-0.5 text-[11px] leading-tight text-indigo-700">
                Show different questions based on their answer
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
