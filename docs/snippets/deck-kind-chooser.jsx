export const DeckKindChooser = () => {
  const kinds = [
    {
      title: "Present a clear story",
      copy: "Give every slide one complete claim, one useful visual, and concise speaker notes.",
    },
    {
      title: "Reveal points as you speak",
      copy: "Use progressive reveals only where the presenter should control the explanation.",
    },
    {
      title: "Offer optional detail",
      copy: "Keep the main story direct and place deeper material behind clear branches and hotspots.",
    },
    {
      title: "Convert an interactive page",
      copy: "Preserve the page’s visual language and translate its motion into deliberate slide and reveal states.",
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
