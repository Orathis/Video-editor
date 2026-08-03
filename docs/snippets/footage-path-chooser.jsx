export const FootagePathChooser = () => {
  const paths = [
    {
      title: "Add captions",
      copy: "Keep the original clip and audio unchanged; add readable, timed words over it.",
    },
    {
      title: "Add designed overlays",
      copy: "Keep the clip underneath and add titles, quotes, statistics, lower thirds, or picture-in-picture.",
    },
    {
      title: "Change the footage",
      copy: "Use the custom-video workflow when pauses, selected moments, or the spoken order must change.",
    },
  ];

  return (
    <div className="hf-workflow-choices">
      {paths.map((path) => (
        <div className="hf-workflow-choice" key={path.title}>
          <div className="hf-workflow-choice-title">{path.title}</div>
          <div className="hf-workflow-choice-copy">{path.copy}</div>
        </div>
      ))}
    </div>
  );
};
