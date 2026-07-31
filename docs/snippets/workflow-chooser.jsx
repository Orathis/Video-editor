/**
 * The human workflow router.
 *
 * Every route begins with source material a person already recognizes. The
 * compact loops prove the kind of result before the click; the destination
 * guide carries the complete example and instructions.
 */
export const WorkflowChooser = () => {
  // Keep data inside the component. Mintlify compiles only the named export and
  // drops module-level constants from snippet files.
  const CDN = "https://static.heygen.ai/hyperframes-oss/docs/images/showcase";
  const routes = [
    {
      title: "Show a product or website",
      bring: "Bring a URL, launch brief, or product story.",
      href: "/guides/product-launch-video",
      video: `${CDN}/wfv2-product-launch.mp4`,
      poster: `${CDN}/wfv2-product-launch.jpg`,
    },
    {
      title: "Explain an idea",
      bring: "Bring notes, an article, a script, or one rough thought.",
      href: "/guides/faceless-explainer",
      video: `${CDN}/wfv2-explainer.mp4`,
      poster: `${CDN}/wfv2-explainer.jpg`,
    },
    {
      title: "Work with existing footage",
      bring: "Bring a talking-head, interview, or podcast clip.",
      href: "/guides/captions-and-recuts",
      video: `${CDN}/wfv2-captions.mp4`,
      poster: `${CDN}/wfv2-captions.jpg`,
    },
    {
      title: "Explain a pull request",
      bring: "Bring a GitHub pull request link.",
      href: "/guides/pr-to-video",
      video: `${CDN}/wfv2-pr.mp4`,
      poster: `${CDN}/wfv2-pr.jpg`,
    },
    {
      title: "Make a short motion graphic",
      bring: "Bring a message, number, quote, chart, or logo.",
      href: "/guides/motion-graphics",
      video: `${CDN}/wfv2-motion.mp4`,
      poster: `${CDN}/wfv2-motion.jpg`,
    },
    {
      title: "Cut to music",
      bring: "Bring a track and any photos or video you want to use.",
      href: "/guides/music-to-video",
      video: `${CDN}/wfv2-music.mp4`,
      poster: `${CDN}/wfv2-music.jpg`,
    },
    {
      title: "Build a presentation",
      bring: "Bring an outline, pitch, report, or existing deck.",
      href: "/guides/slideshow",
      video: "/images/showcase/wfv2-slideshow.mp4",
      poster: "/images/showcase/wfv2-slideshow.jpg",
    },
    {
      title: "Direct a custom video",
      bring: "Bring the outcome you want and whatever source material you have.",
      href: "/guides/general-video",
      video: `${CDN}/wfv2-general.mp4`,
      poster: `${CDN}/wfv2-general.jpg`,
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
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "1.25rem",
        margin: "1.5rem 0",
      }}
    >
      {routes.map((route) => (
        <a
          key={route.href}
          href={route.href}
          aria-label={`${route.title}. ${route.bring}`}
          style={{
            display: "block",
            overflow: "hidden",
            border: "1px solid rgba(128, 128, 128, 0.28)",
            borderRadius: "12px",
            background: "transparent",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <video
            src={reducedMotion ? undefined : route.video}
            poster={route.poster}
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
              pointerEvents: "none",
            }}
          />
          <span style={{ display: "block", padding: "0.8rem 0.9rem 0.95rem" }}>
            <span
              style={{
                display: "block",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              {route.title}
            </span>
            <span
              style={{
                display: "block",
                marginTop: "0.25rem",
                fontSize: "0.875rem",
                opacity: 0.72,
              }}
            >
              {route.bring}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
};
