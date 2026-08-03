export const MusicVideoChooser = () => {
  const modes = [
    {
      title: "Use your photos or video",
      copy: "Cut approved media to the track’s phrases, energy, beats, and ending.",
    },
    {
      title: "Make a lyric video",
      copy: "Verify the words first, then synchronize and design each line around the vocal.",
    },
    {
      title: "Invent the visuals",
      copy: "Build the full visual arc from typography, graphic elements, and motion when no media is supplied.",
    },
  ];

  return (
    <div className="hf-workflow-choices">
      {modes.map((mode) => (
        <div className="hf-workflow-choice" key={mode.title}>
          <div className="hf-workflow-choice-title">{mode.title}</div>
          <div className="hf-workflow-choice-copy">{mode.copy}</div>
        </div>
      ))}
    </div>
  );
};
