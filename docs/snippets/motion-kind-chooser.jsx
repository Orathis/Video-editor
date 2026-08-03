export const MotionKindChooser = () => {
  const kinds = [
    {
      title: "Words",
      copy: "Use kinetic type when the movement and emphasis of the phrase are the whole message.",
    },
    {
      title: "One number",
      copy: "Count or reveal a statistic, settle on the result, and hold it long enough to register.",
    },
    {
      title: "Data",
      copy: "Animate a chart or comparison so the visual sequence makes the conclusion clear.",
    },
    {
      title: "Logo",
      copy: "Build a short sting with a deliberate entrance, completion, and clean hold.",
    },
    {
      title: "Overlay",
      copy: "Create a lower third or callout that enters, holds, and clears completely over footage.",
    },
    {
      title: "Page, post, or map",
      copy: "Capture the real source and animate one detail into the visual payoff.",
    },
  ];

  return (
    <div className="hf-workflow-choices">
      {kinds.map((kind) => (
        <div className="hf-workflow-choice" key={kind.title}>
          <div className="hf-workflow-choice-title">{kind.title}</div>
          <div className="hf-workflow-choice-copy">{kind.copy}</div>
        </div>
      ))}
    </div>
  );
};
