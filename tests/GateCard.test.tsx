import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GateCard } from '../src/sidepanel/components/GateCard';
import type { PlanStep } from '../src/core/types';

const step: PlanStep = {
  id: 'step_5',
  title: 'Place order — $25.87 total, charged to Visa ending 4821, ships to Home',
  action: 'purchase',
  requiresApproval: true,
  gateDetail: 'This charges your saved payment method and cannot be undone.',
  status: 'pending',
};

describe('GateCard', () => {
  it('carries everything needed to decide without re-reading the plan', () => {
    render(<GateCard step={step} onApprove={vi.fn()} onSkip={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText(/Visa ending 4821/)).toBeDefined();
    expect(screen.getByText(/charges your saved payment method/)).toBeDefined();
    expect(screen.getByText('This cannot be undone.')).toBeDefined();
  });

  it('offers approve, skip and stop — and nothing that continues on its own', () => {
    render(<GateCard step={step} onApprove={vi.fn()} onSkip={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Approve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Skip this step' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Stop task' })).toBeDefined();
    expect(screen.getByText(/waits here until you decide/i)).toBeDefined();
  });
});
