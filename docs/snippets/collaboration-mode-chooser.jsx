export const CollaborationModeChooser = () => {
  const modes = [
    {
      title: "Build it for me",
      copy: "Let the agent make the creative decisions and bring back a complete first preview.",
    },
    {
      title: "Review the story first",
      copy: "Approve the storyboard and rough layouts before the detailed video is built.",
    },
    {
      title: "Co-direct it with the agent",
      copy: "Shape the story, visual system, scene motion, transitions, audio identity, opening, and ending together.",
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
