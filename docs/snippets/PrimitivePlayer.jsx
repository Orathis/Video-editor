export function PrimitivePlayer({
  name,
  width = 1920,
  height = 1080,
  knobs,
  preview = false,
}) {
  const base = `/public/primitives/${name}`;

  return (
    <div className={`not-prose hf-player-frame${preview ? " hf-player-frame-preview" : ""}`}>
      <div
        className="hf-player-host"
        data-hf-player="true"
        data-src={`${base}/index.html`}
        data-poster={`${base}/poster.jpg`}
        data-width={width}
        data-height={height}
        data-knobs={knobs === undefined ? undefined : JSON.stringify(knobs)}
        data-hf-preview={preview ? "true" : undefined}
        aria-busy="true"
        aria-hidden={preview ? "true" : undefined}
        aria-label={preview ? undefined : `${name} interactive preview`}
        style={{
          aspectRatio: `${width}/${height}`,
        }}
      >
        <img
          className="hf-player-poster"
          src={`${base}/poster.jpg`}
          alt=""
          aria-hidden="true"
          loading={preview ? "lazy" : "eager"}
          decoding="async"
          fetchPriority={preview ? "auto" : "high"}
        />
        <span className="hf-player-loading" role={preview ? undefined : "status"}>
          Loading preview
        </span>
      </div>
    </div>
  );
}
