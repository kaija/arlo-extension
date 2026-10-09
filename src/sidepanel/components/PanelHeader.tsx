import { PlusIcon, SlidersIcon } from '../../design-system/icons';
import { useText } from '../language';

interface PanelHeaderProps {
  onNewTask: () => void;
  onOpenSettings: () => void;
}

/**
 * Actions only. Chrome draws the extension's own name and mark directly above
 * this bar, so repeating them here would put the Arlo logo on screen twice.
 */
export function PanelHeader({ onNewTask, onOpenSettings }: PanelHeaderProps) {
  const text = useText();
  return (
    <header className="panel__header">
      <button type="button" className="icon-button" title={text.newTask} onClick={onNewTask}>
        <PlusIcon />
        <span className="visually-hidden">{text.newTask}</span>
      </button>
      <button type="button" className="icon-button" title={text.settings} onClick={onOpenSettings}>
        <SlidersIcon />
        <span className="visually-hidden">{text.settings}</span>
      </button>
    </header>
  );
}
