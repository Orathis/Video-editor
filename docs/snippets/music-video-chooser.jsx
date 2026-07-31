export const MusicVideoChooser = () => {
  const modes = [
    {
      id: "media",
      label: "Use my photos or video",
      prompt: (
        direction,
      ) => `/hyperframes Turn track.wav and my attached media into a beat-synced video.

Use every approved asset once unless repetition serves the rhythm. ${direction}`,
    },
    {
      id: "lyrics",
      label: "Make a lyric video",
      prompt: (direction) => `/hyperframes Turn track.wav into a lyric video.

Transcribe the vocals, confirm the words, and synchronize each line before styling it. ${direction}`,
    },
    {
      id: "invent",
      label: "Invent the visuals",
      prompt: (
        direction,
      ) => `/hyperframes Turn track.wav into a complete music-driven video with no supplied images.

Build the visual arc from typography, graphic templates, and motion. ${direction}`,
    },
  ];

  const [selectedId, setSelectedId] = useState("media");
  const [direction, setDirection] = useState(
    "Start restrained, accelerate after the first drop, and hold the final logo for two beats.",
  );
  const selected = modes.find((mode) => mode.id === selectedId) || modes[0];
  const directionValue =
    direction.trim() || "Describe where the energy should change and how the video should end.";

  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div
        role="group"
        aria-label="Choose the kind of music video"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.9rem",
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

      <label
        htmlFor="music-energy-direction"
        style={{
          display: "block",
          marginBottom: "0.35rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
        }}
      >
        Energy direction
      </label>
      <textarea
        id="music-energy-direction"
        rows={2}
        value={direction}
        onChange={(event) => setDirection(event.target.value)}
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
          resize: "vertical",
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
          {selected.prompt(directionValue)}
        </code>
      </pre>
    </div>
  );
};
