import { PointerSensor } from '@dnd-kit/core';
import { isBuilderInteractiveTarget } from '../../lib/formFieldClipboard';

/**
 * Grab-the-card reorder: ignore inputs, buttons, the if/then canvas, and menus
 * so those stay clickable.
 */
export class BuilderPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) => {
        if (!event.isPrimary || event.button !== 0) return false;
        const t = event.target;
        if (!(t instanceof Element)) return false;
        if (isBuilderInteractiveTarget(t)) return false;
        if (
          t.closest(
            '.react-flow, .react-flow__pane, .nodrag, [data-block-menu]',
          )
        ) {
          return false;
        }
        return true;
      },
    },
  ];
}
