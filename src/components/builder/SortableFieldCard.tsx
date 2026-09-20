import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormField, RegisterLayer, RegisterTarget } from '../../lib/types';
import { isBuilderInteractiveTarget } from '../../lib/formFieldClipboard';
import { FieldCard } from './FieldCard';

type SortableFieldCardProps = {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
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

export default function SortableFieldCard({
  field,
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
}: SortableFieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: field.id,
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
          : 'cursor-grab [&_button]:cursor-pointer [&_input]:cursor-text [&_label]:cursor-pointer [&_select]:cursor-pointer [&_textarea]:cursor-text [&_[contenteditable]]:cursor-text'
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
      <FieldCard
        field={field}
        onChange={onChange}
        onRemove={onRemove}
        selected={selected}
        onCopy={onCopy}
        onCut={onCut}
        onDuplicate={onDuplicate}
        registerTo={registerTo}
        registerCustomPageId={registerCustomPageId}
        registerCustomLayer={registerCustomLayer}
        formRegisterLayer={registerLayer}
      />
    </div>
  );
}
