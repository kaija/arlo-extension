/**
 * Thin wrappers over the design system's form classes. The markup mirrors the
 * system's own components/forms/*.jsx contracts exactly — same elements, same
 * class names, same order — so a change upstream in ui.css lands here for free.
 */
import type { ReactNode } from 'react';

import {
  AlertCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  InfoIcon,
  WarningIcon,
} from '../design-system/icons';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error || hint ? (
        <p className={cx('field-hint', error && 'field-hint-error')}>{error ?? hint}</p>
      ) : null}
    </div>
  );
}

export function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="select-wrap">
      {children}
      <span className="select-chevron">
        <ChevronIcon size={16} />
      </span>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  label: ReactNode;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ checked, label, disabled, onChange }: SwitchProps) {
  return (
    <label className={cx('switch', disabled && 'check-disabled')}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track">
        <span className="switch-knob" />
      </span>
      <span>{label}</span>
    </label>
  );
}

interface CheckboxProps {
  checked: boolean;
  label: ReactNode;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ checked, label, disabled, onChange }: CheckboxProps) {
  return (
    <label className={cx('check', disabled && 'check-disabled')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="check-box">
        <CheckIcon className="check-tick" size={12} strokeWidth={3} />
      </span>
      <span>{label}</span>
    </label>
  );
}

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONE_ICON: Record<AlertTone, typeof InfoIcon> = {
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  danger: AlertCircleIcon,
};

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
}

export function Alert({ tone = 'info', title, children, onClose }: AlertProps) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      className={cx('alert', tone !== 'info' && `alert-${tone}`)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className="alert-icon">
        <Icon size={18} />
      </span>
      <div>
        {title ? <div className="alert-title">{title}</div> : null}
        {children ? <div className="alert-body">{children}</div> : null}
      </div>
      {onClose ? (
        <button type="button" className="alert-close" aria-label="Dismiss" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      ) : null}
    </div>
  );
}
