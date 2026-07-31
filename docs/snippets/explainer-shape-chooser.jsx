export const ExplainerShapeChooser = () => {
  const shapes = [
    {
      id: "concept",
      label: "Understand one idea",
      prompt: (
        landing,
      ) => `/hyperframes Create a 60-second concept explainer from my attached notes.

Open with a question or counterintuitive claim. Reveal the mechanism one layer at a time. The viewer should leave able to say: “${landing}”`,
    },
    {
      id: "process",
      label: "Follow a process",
      prompt: (landing) => `/hyperframes Turn my attached notes into a 60-second how-to explainer.

Use one visual stage and show each step in order. The viewer should leave able to say: “${landing}”`,
    },
    {
      id: "list",
      label: "Remember three points",
      prompt: (landing) => `/hyperframes Turn my attached notes into a three-part explainer.

Make the three ideas parallel, concrete, and visually distinct. The viewer should leave able to say: “${landing}”`,
    },
    {
      id: "story",
      label: "Learn through a story",
      prompt: (landing) => `/hyperframes Turn my attached notes into a story-led explainer.

Teach through one concrete case: setup, tension, turn, resolution, then the general lesson. The viewer should leave able to say: “${landing}”`,
    },
  ];

  const [selectedId, setSelectedId] = useState("concept");
  const [landing, setLanding] = useState("Adding road capacity can create more traffic, not less.");
  const selected = shapes.find((shape) => shape.id === selectedId) || shapes[0];
  const landingValue = landing.trim() || "State the one idea they should remember.";

  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div
        role="group"
        aria-label="Choose the shape of the explanation"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.9rem",
        }}
      >
        {shapes.map((shape) => {
          const active = shape.id === selected.id;

          return (
            <button
              key={shape.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(shape.id)}
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
                {shape.label}
              </span>
            </button>
          );
        })}
      </div>

      <label
        htmlFor="explainer-landing"
        style={{
          display: "block",
          marginBottom: "0.35rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
        }}
      >
        One sentence they should remember
      </label>
      <input
        id="explainer-landing"
        type="text"
        value={landing}
        onChange={(event) => setLanding(event.target.value)}
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
          {selected.prompt(landingValue)}
        </code>
      </pre>
    </div>
  );
};
