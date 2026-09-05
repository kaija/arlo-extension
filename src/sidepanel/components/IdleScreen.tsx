const STARTERS = [
  'Sketch a small script and explain how it works',
  'Draft a plan for a feature, then write the first file',
  'Create a few files and walk me through the structure',
];

/**
 * The empty state says what this agent actually is: it works in a folder of its
 * own, so the examples are things that leave files behind rather than browser
 * errands.
 */
export function IdleScreen({ busy, onSubmit }: { busy: boolean; onSubmit: (p: string) => void }) {
  return (
    <div className="idle">
      <div className="idle__intro">
        <h1 className="idle__title">What should Arlo work on?</h1>
        <p className="idle__lead">
          Arlo runs a Codex agent in a folder of its own for this chat. It can read and write there,
          and nowhere else.
        </p>
      </div>

      <div className="suggestions">
        <div className="eyebrow">Try one of these</div>
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            className="suggestion"
            disabled={busy}
            onClick={() => onSubmit(starter)}
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
