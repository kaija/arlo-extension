export function Onboarding({ onAllow }: { onAllow: () => void }) {
  return (
    <section className="panel">
      <h1 className="panel__title">Arlo works the page for you</h1>
      <p className="panel__lead">
        Arlo is not a chat assistant. It clicks, types, scrolls and changes pages in the tab you are
        looking at, until the task is done.
      </p>

      <ul className="examples">
        <li>“Reorder the coffee beans I bought last month, if they are still under $25.”</li>
        <li>“Fill this application form with my saved details.”</li>
        <li>“Compare the top 3 items on this page and add the cheapest to my cart.”</li>
      </ul>

      <h2 className="panel__subtitle">Before it can start</h2>
      <ul className="promises">
        <li>
          <strong>It can read and act on any site you visit.</strong> Access is granted once, here.
        </li>
        <li>
          <strong>You always see the plan first,</strong> and Arlo stops before anything
          irreversible — orders, messages, deletions, sign-ins.
        </li>
        <li>
          <strong>You can switch it off everywhere</strong> from Settings at any time.
        </li>
      </ul>

      <button type="button" className="button button--primary" onClick={onAllow}>
        Allow Arlo to work on websites
      </button>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => chrome.runtime.openOptionsPage()}
      >
        Review settings first
      </button>
    </section>
  );
}
