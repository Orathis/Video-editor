export const MotionKindChooser = () => {
  const kinds = [
    {
      id: "words",
      label: "Words",
      prompt: `/hyperframes Create a six-second kinetic-type graphic for “Make the work visible.”

Let “visible” become the dominant word. No narration. Hold the complete line long enough to read.`,
    },
    {
      id: "number",
      label: "One number",
      prompt: `/hyperframes Create a six-second motion graphic for “2.4× faster.”

Count up to 2.4, settle firmly, then hold. Use one lime accent. No narration.`,
    },
    {
      id: "data",
      label: "Data",
      prompt: `/hyperframes Animate this comparison as one clear chart: 42, 68, 91.

Reveal the bars in order and make 91 the conclusion. Eight seconds, no narration.`,
    },
    {
      id: "logo",
      label: "Logo",
      prompt: `/hyperframes Create a four-second logo sting from the attached SVG.

Draw the mark on, complete the wordmark, then hold. Export with transparency for another edit.`,
    },
    {
      id: "overlay",
      label: "Overlay",
      prompt: `/hyperframes Create a transparent lower third for “Maya Chen — Product Design.”

Enter from the lower left, hold for three seconds, and clear completely. Export as an alpha overlay.`,
    },
    {
      id: "source",
      label: "Page, post, or map",
      prompt: `/hyperframes Turn this URL into an eight-second highlight shot.

Use the real captured source, focus on one important detail, and make that detail the visual payoff. No narration.`,
    },
  ];

  const [selectedId, setSelectedId] = useState("words");
  const selected = kinds.find((kind) => kind.id === selectedId) || kinds[0];

  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div
        role="group"
        aria-label="Choose what to animate"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        {kinds.map((kind) => {
          const active = kind.id === selected.id;

          return (
            <button
              key={kind.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(kind.id)}
              style={{
                border: "1px solid currentColor",
                borderRadius: "999px",
                padding: "0.4rem 0.75rem",
                background: active ? "#d8ff5f" : "transparent",
                color: "inherit",
                cursor: "pointer",
                opacity: active ? 1 : 0.7,
              }}
            >
              <span
                style={{
                  color: active ? "#111111" : "inherit",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              >
                {kind.label}
              </span>
            </button>
          );
        })}
      </div>

      <pre
        aria-live="polite"
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        <code
          style={{
            display: "block",
            maxWidth: "100%",
            whiteSpace: "inherit",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {selected.prompt}
        </code>
      </pre>
    </div>
  );
};
