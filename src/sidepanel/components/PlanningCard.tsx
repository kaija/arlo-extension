import type { TabInfo } from '../../shared/messages';

/**
 * Planning is the one phase where nothing has happened yet, so the card says so
 * outright — the progress bar is not to be mistaken for work being done.
 */
export function PlanningCard({ tab }: { tab: TabInfo | null }) {
  return (
    <section className="planning" aria-busy="true">
      <div className="planning__head">
        <span className="planning__spinner" aria-hidden="true" />
        <h2 className="planning__title">Reading this page</h2>
      </div>
      <div className="planning__lines">
        <div>Scanned {tab?.host ?? 'this page'}</div>
        <div>Working out the steps…</div>
      </div>
      <div className="planning__bar" aria-hidden="true">
        <span />
      </div>
      <p className="planning__note">No actions taken yet. Arlo is only looking.</p>
    </section>
  );
}
