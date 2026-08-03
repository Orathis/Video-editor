export const ExplainerShapeChooser = () => {
  const shapes = [
    {
      title: "Understand one idea",
      copy: "Open with a useful question, then reveal the mechanism one layer at a time.",
    },
    {
      title: "Follow a process",
      copy: "Keep one visual stage and show each step in the order the viewer needs it.",
    },
    {
      title: "Remember three points",
      copy: "Make the ideas parallel, concrete, and visually distinct enough to recall later.",
    },
    {
      title: "Learn through a story",
      copy: "Use one case to move from setup and tension to a general lesson.",
    },
  ];

  return (
    <div className="hf-workflow-choices">
      {shapes.map((shape) => (
        <div className="hf-workflow-choice" key={shape.title}>
          <div className="hf-workflow-choice-title">{shape.title}</div>
          <div className="hf-workflow-choice-copy">{shape.copy}</div>
        </div>
      ))}
    </div>
  );
};
