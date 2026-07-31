export const CollaborationModeChooser = () => {
  const modes = [
    {
      id: "automatic",
      label: "Build it for me",
      prompt: `/hyperframes Create a 75-second brand film from the attached brief, photography, and interview selects.

Mix live footage with typography. Keep the interview audio, but restructure the visual sequence when it improves the story. Make the creative decisions and show me the finished preview.`,
    },
    {
      id: "storyboard",
      label: "Let me review the story",
      prompt: `/hyperframes Create a 75-second brand film from the attached brief, photography, and interview selects.

Mix live footage with typography. Keep the interview audio. Show me the storyboard and rough layouts before building the complete video.`,
    },
    {
      id: "companion",
      label: "Co-direct it with me",
      prompt: `/hyperframes Create a 75-second brand film from the attached brief, photography, and interview selects.

Work with me in companion mode. Propose the strongest complete treatment first: story, visual system, scene motion, transitions, audio identity, opening, and ending.`,
    },
  ];

  const [selectedId, setSelectedId] = useState("automatic");
  const selected = modes.find((mode) => mode.id === selectedId) || modes[0];

  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div
        role="group"
        aria-label="Choose how to work with the agent"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        {modes.map((mode) => {
          const active = mode.id === selected.id;

          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(mode.id)}
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
                {mode.label}
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
