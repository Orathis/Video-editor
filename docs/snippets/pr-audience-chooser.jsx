export const PrAudienceChooser = () => {
  const audiences = [
    {
      title: "Users",
      copy: "Lead with the visible change, show the before and after, and name any action they must take.",
    },
    {
      title: "Contributors",
      copy: "Explain the architecture change, important tradeoff, and code path reviewers need to understand.",
    },
    {
      title: "Social audience",
      copy: "Make one clear feature reveal with visible proof and only the implementation detail that explains it.",
    },
  ];

  return (
    <div className="hf-workflow-choices">
      {audiences.map((audience) => (
        <div className="hf-workflow-choice" key={audience.title}>
          <div className="hf-workflow-choice-title">{audience.title}</div>
          <div className="hf-workflow-choice-copy">{audience.copy}</div>
        </div>
      ))}
    </div>
  );
};
