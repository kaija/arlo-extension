import type { Plan, Task } from '../../core/types';
import { StepList } from './StepList';

interface PlanCardProps {
  task: Task;
  plan: Plan;
  onApprove: () => void;
  onCancel: () => void;
}

export function PlanCard({ task, plan, onApprove, onCancel }: PlanCardProps) {
  const gates = plan.steps.filter((step) => step.requiresApproval).length;

  return (
    <>
      <TaskMessage prompt={task.prompt} />
      <section className="card card--plan">
        <header className="card__header">
          <h2 className="card__title">Plan</h2>
          <span className="badge badge--waiting">Waiting for you</span>
        </header>
        <p className="card__note">
          Nothing has happened yet. Arlo will run these {plan.steps.length} steps and stop at the{' '}
          {gates === 1 ? 'step' : `${gates} steps`} marked below.
        </p>
        <StepList steps={plan.steps} />
        <div className="actions">
          <button type="button" className="button button--primary" onClick={onApprove}>
            Approve and run
          </button>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    </>
  );
}

export function TaskMessage({ prompt }: { prompt: string }) {
  return (
    <section className="task-message">
      <p className="task-message__label">You asked</p>
      <p className="task-message__text">{prompt}</p>
    </section>
  );
}
