import { PlusIcon, SlidersIcon } from '../../design-system/icons';

interface PanelHeaderProps {
  onNewTask: () => void;
  onOpenSettings: () => void;
}

/**
 * Actions only. Chrome draws the extension's own name and mark directly above
 * this bar, so repeating them here would put the Arlo logo on screen twice.
 */
export function PanelHeader({ onNewTask, onOpenSettings }: PanelHeaderProps) {
  return (
    <header className="panel__header">
      <button type="button" className="icon-button" title="New task" onClick={onNewTask}>
        <PlusIcon />
        <span className="visually-hidden">New task</span>
      </button>
      <button type="button" className="icon-button" title="Settings" onClick={onOpenSettings}>
        <SlidersIcon />
        <span className="visually-hidden">Settings</span>
      </button>
    </header>
  );
}
