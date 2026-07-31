export const ProductVideoChooser = () => {
  const purposes = [
    {
      id: "sell",
      label: "Sell it",
      prompt: (source) => `/hyperframes Create a 45-second launch video for ${source}.

Market the product to independent designers. Lead with the outcome, prove it with the real workflow, and end with “Try it free.”`,
    },
    {
      id: "show",
      label: "Show it",
      prompt: (source) => `/hyperframes Create a product tour for ${source}.

Feature the site’s real screens. Show one complete task from beginning to result, without turning it into a sales pitch.`,
    },
    {
      id: "social",
      label: "Make one social point",
      prompt: (source) => `/hyperframes Create a short social video for ${source}.

Make one point: how quickly someone can share a first result. Show visible proof and end after the payoff.`,
    },
  ];

  const [selectedId, setSelectedId] = useState("sell");
  const [source, setSource] = useState("https://example.com");
  const selected = purposes.find((purpose) => purpose.id === selectedId) || purposes[0];
  const sourceValue = source.trim() || "https://example.com";

  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div
        role="group"
        aria-label="Choose the purpose of the video"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.9rem",
        }}
      >
        {purposes.map((purpose) => {
          const active = purpose.id === selected.id;

          return (
            <button
              key={purpose.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(purpose.id)}
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
                {purpose.label}
              </span>
            </button>
          );
        })}
      </div>

      <label
        htmlFor="product-video-source"
        style={{
          display: "block",
          marginBottom: "0.35rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
        }}
      >
        Product URL
      </label>
      <input
        id="product-video-source"
        type="url"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        style={{
          boxSizing: "border-box",
          width: "100%",
          marginBottom: "0.75rem",
          border: "1px solid currentColor",
          borderRadius: "0.5rem",
          padding: "0.6rem 0.75rem",
          background: "transparent",
          color: "inherit",
          opacity: 0.85,
        }}
      />

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
          {selected.prompt(sourceValue)}
        </code>
      </pre>
    </div>
  );
};
