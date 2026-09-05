/** Domain vocabulary for Arlo. These names are also the words used in the UI. */

/** A single action Arlo can perform on the page. */
export type ActionKind =
  | 'read'
  | 'scroll'
  | 'click'
  | 'type'
  | 'navigate'
  | 'open_tab'
  | 'submit_form'
  | 'purchase'
  | 'send_message'
  | 'delete'
  | 'sign_in'
  | 'change_settings';

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** One numbered action inside a Plan. */
export interface PlanStep {
  id: string;
  title: string;
  action: ActionKind;
  /** CSS selector or human description of the target element, when applicable. */
  target?: string;
  /** Text to enter, for `type` steps. */
  value?: string;
  /** True when this step must stop for confirmation before it runs (a Gate). */
  requiresApproval: boolean;
  /** Consequences shown on the Gate screen, so the user need not re-read the plan. */
  gateDetail?: string;
  status: StepStatus;
  /** Short outcome shown next to a completed step, e.g. "Found: … — $23.40". */
  result?: string;
  error?: string;
}

/** The numbered step list Arlo proposes; approved once before anything runs. */
export interface Plan {
  id: string;
  taskId: string;
  steps: PlanStep[];
}

/** One thing the user asked for, in natural language. */
export interface Task {
  id: string;
  prompt: string;
  createdAt: number;
  tabId: number;
  url: string;
  title: string;
}

/** Where a run sits on the state machine. */
export type RunPhase =
  | 'idle'
  | 'planning'
  | 'awaiting_approval'
  | 'running'
  | 'paused'
  | 'gated'
  | 'needs_help'
  | 'stopped'
  | 'done'
  | 'failed';

/** Why Arlo handed control back to the user. */
export type NeedsHelpReason = 'element_not_found' | 'sign_in_required' | 'captcha';

export interface NeedsHelp {
  reason: NeedsHelpReason;
  /** What Arlo was trying to do and what it saw instead. */
  message: string;
  stepIndex: number;
}

export interface RunState {
  phase: RunPhase;
  task: Task | null;
  plan: Plan | null;
  /** Index into plan.steps of the step being run or awaiting a decision. */
  currentStepIndex: number;
  needsHelp: NeedsHelp | null;
  /** One-line outcome shown on the collapsed Run card when finished. */
  summary: string | null;
  startedAt: number | null;
  endedAt: number | null;
}
