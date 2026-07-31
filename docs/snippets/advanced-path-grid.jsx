/**
 * Four always-visible next steps for people who already have a project.
 *
 * The videos are proof, not controls: every destination remains a normal link.
 */
export const AdvancedPathGrid = () => {
  const CDN = "https://static.heygen.ai/hyperframes-oss/docs/images/showcase";
  const paths = [
    {
      title: "Direct the agent better",
      detail: "Change the story, source material, or several scenes with one clear revision.",
      action: "Give better direction",
      href: "/guides/prompting",
      video: `${CDN}/wfv2-product-launch.mp4`,
      poster: `${CDN}/wfv2-product-launch.jpg`,
    },
    {
      title: "Edit in Studio",
      detail: "Change visible design, text, media, timing, and animation in the live project.",
      action: "Open the Studio guide",
      href: "/studio",
      video: `${CDN}/studio-design-loop-v1.mp4`,
      poster: `${CDN}/studio-design-loop-v1.jpg`,
    },
    {
      title: "Build richer compositions",
      detail: "Use variables, nested compositions, Catalog elements, media, and animation.",
      action: "Learn the core ideas",
      href: "/concepts",
      video: `${CDN}/wfv2-general.mp4`,
      poster: `${CDN}/wfv2-general.jpg`,
    },
    {
      title: "Check, render, and share",
      detail:
        "Validate the project, render through Studio, an agent, or the CLI, and review the file.",
      action: "Finish the project",
      href: "/guides/export-and-share",
      video: `${CDN}/studio-export-loop-v1.mp4`,
      poster: `${CDN}/studio-export-loop-v1.jpg`,
    },
  ];
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
        gap: "1rem",
        margin: "1.5rem 0",
      }}
    >
      {paths.map((path) => (
        <article
          key={path.href}
          style={{
            overflow: "hidden",
            border: "1px solid var(--border-color, rgba(128, 128, 128, 0.22))",
            borderRadius: "12px",
          }}
        >
          <video
            src={reducedMotion ? undefined : path.video}
            poster={path.poster}
            autoPlay={!reducedMotion}
            muted
            loop={!reducedMotion}
            playsInline
            preload="metadata"
            aria-hidden="true"
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "16 / 9",
              objectFit: "cover",
              background: "#000",
              margin: 0,
            }}
          />
          <div style={{ padding: "0.9rem 1rem 1rem" }}>
            <strong style={{ display: "block", fontSize: "1rem", lineHeight: 1.35 }}>
              {path.title}
            </strong>
            <span
              style={{
                display: "block",
                marginTop: "0.35rem",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                opacity: 0.72,
              }}
            >
              {path.detail}
            </span>
            <a
              href={path.href}
              style={{
                display: "inline-block",
                marginTop: "0.75rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              {path.action} →
            </a>
          </div>
        </article>
      ))}
    </div>
  );
};
