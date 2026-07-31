export const PrAudienceChooser = () => {
  const audiences = [
    {
      id: "users",
      label: "Users",
      prompt: `/hyperframes Turn https://github.com/owner/repo/pull/123 into a 45-second release video for existing users.

Lead with the visible change. Show the before and after, then any action users must take.`,
    },
    {
      id: "contributors",
      label: "Contributors",
      prompt: `/hyperframes Explain https://github.com/owner/repo/pull/123 to contributors.

Show the architecture change, the important tradeoff, and the code path reviewers should understand.`,
    },
    {
      id: "social",
      label: "Social audience",
      prompt: `/hyperframes Turn https://github.com/owner/repo/pull/123 into a short feature reveal.

One clear change, visible proof, and a direct ending. Keep implementation detail out unless it explains the result.`,
    },
  ];

  const [selectedId, setSelectedId] = useState("users");
  const selected = audiences.find((audience) => audience.id === selectedId) || audiences[0];

  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div
        role="group"
        aria-label="Choose the audience"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        {audiences.map((audience) => {
          const active = audience.id === selected.id;

          return (
            <button
              key={audience.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(audience.id)}
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
                {audience.label}
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
