export const ProductVideoChooser = () => {
  const purposes = [
    {
      title: "Launch video",
      copy: "Turn real product evidence into a persuasive story with one clear action at the end.",
    },
    {
      title: "Product tour",
      copy: "Show one complete task through the product’s real screens, from the first action to the result.",
    },
    {
      title: "Short social video",
      copy: "Prove one useful point quickly, show the evidence, and stop after the payoff.",
    },
  ];

  return (
    <div className="hf-workflow-choices">
      {purposes.map((purpose) => (
        <div className="hf-workflow-choice" key={purpose.title}>
          <div className="hf-workflow-choice-title">{purpose.title}</div>
          <div className="hf-workflow-choice-copy">{purpose.copy}</div>
        </div>
      ))}
    </div>
  );
};
