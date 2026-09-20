import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormField, RegisterLayer, RegisterTarget } from '../../lib/types';
import { isBuilderInteractiveTarget } from '../../lib/formFieldClipboard';
import { blockToFormField, formFieldToBlock } from '../../lib/appItemConvert';
import ConditionalFlowSummary from './ConditionalFlowSummary';
import ConditionalFlowEditor from './ConditionalFlowEditor';

type SortableConditionalFieldProps = {
  field: FormField;
  disabled?: boolean;
  onChange: (field: FormField) => void;
  onRemove: () => void;
  selected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onDuplicate?: () => void;
  registerTo?: RegisterTarget | null;
  registerLayer?: RegisterLayer | null;
  registerCustomPageId?: string | null;
  registerCustomLayer?: string | null;
};

export default function SortableConditionalField({
  field,
  disabled = false,
  onChange,
  onRemove,
  selected,
  onSelect,
  onContextMenu,
  onCopy,
  onCut,
  onDuplicate,
  registerTo,
  registerLayer,
  registerCustomPageId,
  registerCustomLayer,
}: SortableConditionalFieldProps) {
  const block = formFieldToBlock(field);
  const [flowOpen, setFlowOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: field.id,
      disabled,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-builder-block
      data-field-id={field.id}
      className={
        isDragging
          ? 'cursor-grabbing'
          : 'cursor-grab [&_.react-flow]:cursor-auto [&_button]:cursor-pointer [&_input]:cursor-text [&_label]:cursor-pointer [&_select]:cursor-pointer [&_textarea]:cursor-text [&_[contenteditable]]:cursor-text'
      }
      {...attributes}
      tabIndex={-1}
      {...listeners}
      onClick={(e) => {
        if (isBuilderInteractiveTarget(e.target)) return;
        onSelect?.(e);
      }}
      onContextMenu={onContextMenu}
    >
      <ConditionalFlowSummary
        block={block}
        disabled={disabled}
        selected={selected}
        onCopy={onCopy}
        onCut={onCut}
        onDuplicate={onDuplicate}
        formRegisterTo={registerTo}
        formRegisterLayer={registerLayer}
        formRegisterCustomPageId={registerCustomPageId}
        formRegisterCustomLayer={registerCustomLayer}
        onChange={(updated) => onChange(blockToFormField(updated))}
        onFullScreen={() => setFlowOpen(true)}
        onRemove={onRemove}
        onRequiredChange={(required) =>
          onChange(blockToFormField({ ...block, required }))
        }
      />
      {flowOpen && (
        <ConditionalFlowEditor
          block={block}
          disabled={disabled}
          formRegisterTo={registerTo}
          formRegisterLayer={registerLayer}
          formRegisterCustomPageId={registerCustomPageId}
          formRegisterCustomLayer={registerCustomLayer}
          onChange={(updated) => onChange(blockToFormField(updated))}
          onClose={() => setFlowOpen(false)}
        />
      )}
    </div>
  );
}
