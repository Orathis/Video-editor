export const StudioTaskChooser = () => {
  const tasks = [
    {
      id: "design",
      label: "Text or layout",
      title: "Change something visible",
      description: "Select it on the canvas, then drag it directly or use the Inspector.",
      href: "/studio/canvas",
      link: "Open the canvas guide",
      video:
        "https://static.heygen.ai/hyperframes-oss/docs/images/showcase/studio-design-loop-v1.mp4",
      poster:
        "https://static.heygen.ai/hyperframes-oss/docs/images/showcase/studio-design-loop-v1.jpg",
      alt: "HyperFrames Studio Inspector beside the project canvas",
    },
    {
      id: "timing",
      label: "Timing or order",
      title: "Fix timing or clip order",
      description: "Use the timeline when the right thing happens at the wrong moment.",
      href: "/studio/timeline",
      link: "Open the timeline guide",
      video:
        "https://static.heygen.ai/hyperframes-oss/docs/images/showcase/studio-timing-loop-v1.mp4",
      poster:
        "https://static.heygen.ai/hyperframes-oss/docs/images/showcase/studio-timing-loop-v1.jpg",
      alt: "HyperFrames Studio timeline below the project canvas",
    },
    {
      id: "motion",
      label: "Animation or media",
      title: "Adjust motion or replace media",
      description:
        "Use the focused animation or assets guide without learning the whole workspace.",
      href: "/studio/animation",
      link: "Open animation and media guides",
      video:
        "https://static.heygen.ai/hyperframes-oss/docs/images/showcase/studio-motion-loop-v1.mp4",
      poster:
        "https://static.heygen.ai/hyperframes-oss/docs/images/showcase/studio-motion-loop-v1.jpg",
      alt: "HyperFrames Studio canvas, Inspector, project files, and timeline",
    },
    {
      id: "export",
      label: "Export a version",
      title: "Export a version",
      description: "Choose a format and resolution, render, then watch the exported file once.",
      href: "/studio/export",
      link: "Open the export guide",
      video:
        "https://static.heygen.ai/hyperframes-oss/docs/images/showcase/studio-export-loop-v1.mp4",
      poster:
        "https://static.heygen.ai/hyperframes-oss/docs/images/showcase/studio-export-loop-v1.jpg",
      alt: "HyperFrames Studio Renders panel with format and resolution controls",
    },
  ];

  const [selectedId, setSelectedId] = useState("design");
  const [reduceMotion, setReduceMotion] = useState(false);
  const selected = tasks.find((task) => task.id === selectedId) || tasks[0];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div
      className="hf-studio-task-chooser"
      style={{
        display: "grid",
        gap: "1.25rem",
        margin: "1.25rem 0 1.75rem",
      }}
    >
      <div
        role="group"
        aria-label="Choose a Studio task"
        style={{
          display: "grid",
          alignContent: "start",
          gap: "0.45rem",
        }}
      >
        {tasks.map((task) => {
          const isSelected = task.id === selected.id;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedId(task.id)}
              aria-pressed={isSelected}
              style={{
                width: "100%",
                padding: "0.65rem 0.75rem",
                border: isSelected
                  ? "1px solid currentColor"
                  : "1px solid rgba(128, 128, 128, 0.28)",
                borderRadius: "8px",
                background: isSelected ? "rgba(128, 128, 128, 0.14)" : "transparent",
                color: "inherit",
                textAlign: "left",
                font: "inherit",
                fontWeight: isSelected ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {task.label}
            </button>
          );
        })}
      </div>

      <div style={{ minWidth: 0 }}>
        <video
          key={selected.id}
          src={selected.video}
          poster={selected.poster}
          aria-label={selected.alt}
          autoPlay={!reduceMotion}
          muted
          loop={!reduceMotion}
          playsInline
          preload="metadata"
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: "cover",
            objectPosition: "center",
            margin: 0,
            borderRadius: "10px",
            border: "1px solid rgba(128, 128, 128, 0.28)",
          }}
        />
        <div style={{ paddingTop: "0.75rem" }}>
          <strong style={{ display: "block" }}>{selected.title}</strong>
          <span
            style={{
              display: "block",
              marginTop: "0.25rem",
              fontSize: "0.875rem",
              opacity: 0.72,
            }}
          >
            {selected.description}
          </span>
          <a
            href={selected.href}
            style={{
              display: "inline-block",
              marginTop: "0.55rem",
              fontSize: "0.875rem",
            }}
          >
            {selected.link} →
          </a>
        </div>
      </div>

      <style>{`
        .hf-studio-task-chooser {
          grid-template-columns: minmax(150px, 0.4fr) minmax(0, 1fr);
        }

        @media (max-width: 640px) {
          .hf-studio-task-chooser {
            grid-template-columns: 1fr;
          }

          [aria-label="Choose a Studio task"] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          [aria-label="Choose a Studio task"] + div {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
};
