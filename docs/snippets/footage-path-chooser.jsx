export const FootagePathChooser = () => {
  const paths = [
    {
      id: "captions",
      label: "Add captions",
      note: "The original clip and audio stay untouched.",
      prompt: `/hyperframes Add captions to interview.mp4.

Keep the footage and audio untouched. Make names and product terms easy to verify, and choose a caption treatment that fits the clip.`,
    },
    {
      id: "overlays",
      label: "Add designed overlays",
      note: "The original clip plays underneath the graphics.",
      prompt: `/hyperframes Package podcast-clip.mp4 with designed overlays.

Keep the footage and audio untouched. Use the transcript to add a speaker title, two useful pull quotes, and a data callout.`,
    },
    {
      id: "edit",
      label: "Change the footage",
      note: "Use General Video when the spoken edit itself must change.",
      prompt: `/hyperframes Recut interview.mp4 into a concise 45-second video.

Remove pauses and repetition, choose the strongest parts, and reorder them when it improves the explanation.`,
    },
  ];

  const [selectedId, setSelectedId] = useState("captions");
  const selected = paths.find((path) => path.id === selectedId) || paths[0];

  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div
        role="group"
        aria-label="Choose what should change"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        {paths.map((path) => {
          const active = path.id === selected.id;

          return (
            <button
              key={path.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(path.id)}
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
                {path.label}
              </span>
            </button>
          );
        })}
      </div>

      <p
        aria-live="polite"
        style={{
          margin: "0 0 0.75rem",
          fontSize: "0.875rem",
          opacity: 0.72,
        }}
      >
        {selected.note}
      </p>

      <pre
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
