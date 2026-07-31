export const DeckKindChooser = () => {
  const kinds = [
    {
      id: "linear",
      label: "Present a clear story",
      prompt: `/hyperframes Build an eight-slide interactive briefing from my attached notes.

Give every slide one complete claim and one useful visual. Add concise speaker notes and keep the main narrative direct.`,
    },
    {
      id: "reveals",
      label: "Reveal points as I speak",
      prompt: `/hyperframes Build an interactive deck from my attached notes.

Use progressive reveals where the presenter should control the explanation. Each reveal must add meaning, not merely delay content.`,
    },
    {
      id: "branches",
      label: "Offer optional detail",
      prompt: `/hyperframes Build an interactive product briefing from my attached notes.

Keep the main story concise. Add two optional branches—roadmap and pricing—opened through clear hotspots, with speaker notes throughout.`,
    },
    {
      id: "page",
      label: "Convert an interactive page",
      prompt: `/hyperframes Turn this page into a HyperFrames slideshow.

Preserve its visual design, motion, media, and interactive behavior. Translate the page’s movement into deliberate slide and reveal states.`,
    },
  ];

  const [selectedId, setSelectedId] = useState("linear");
  const selected = kinds.find((kind) => kind.id === selectedId) || kinds[0];

  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div
        role="group"
        aria-label="Choose the kind of interactive deck"
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
