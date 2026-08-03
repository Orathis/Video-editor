export const DocsVideo = ({
  src,
  poster,
  title,
  autoPlay = false,
  chapters = [],
  transcript = [],
}) => {
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const progressFrameRef = useRef(null);
  const previewSeekFrameRef = useRef(null);
  const initialMomentAppliedRef = useRef(false);
  const copyTimerRef = useRef(null);
  const [enhanced, setEnhanced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [momentCopied, setMomentCopied] = useState(false);

  const writeClipboard = async (text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to the browser's older synchronous copy path.
    }

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const revealControls = () => {
    setControlsVisible(true);
    clearHideTimer();
    if (playing) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2200);
    }
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      setWaiting(true);
      try {
        await video.play();
      } catch {
        setWaiting(false);
        setPlaying(false);
      }
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted && video.volume === 0) video.volume = 0.8;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const seek = (event) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Number(event.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const seekTo = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Math.min(duration || video.duration || seconds, Math.max(0, seconds));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    revealControls();
  };

  const copyMomentLink = async () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("t", String(Math.max(0, Math.floor(currentTime))));
    if (await writeClipboard(url.toString())) {
      setMomentCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setMomentCopied(false), 1800);
    } else {
      setMomentCopied(false);
    }
  };

  const updateScrubPreview = (event, seekMainVideo = false) => {
    if (!duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const nextTime = ratio * duration;
    setPreviewing(true);
    setPreviewTime(nextTime);
    setPreviewPosition(ratio * 100);

    if (seekMainVideo) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = nextTime;
        setCurrentTime(nextTime);
      }
    }

    if (previewSeekFrameRef.current) {
      window.cancelAnimationFrame(previewSeekFrameRef.current);
    }
    previewSeekFrameRef.current = window.requestAnimationFrame(() => {
      const previewVideo = previewVideoRef.current;
      if (previewVideo && Math.abs(previewVideo.currentTime - nextTime) > 0.04) {
        previewVideo.currentTime = nextTime;
      }
    });
  };

  const cyclePlaybackRate = () => {
    const video = videoRef.current;
    if (!video) return;
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(video.playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    const video = videoRef.current;
    if (!player || typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (player.requestFullscreen) {
        await player.requestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch {
      // The normal inline player remains fully usable when fullscreen is blocked.
    }
  };

  const handleKeyboard = (event) => {
    if (event.target !== event.currentTarget) return;
    const video = videoRef.current;
    if (!video) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      video.currentTime = Math.min(duration || video.duration || 0, video.currentTime + 5);
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      toggleMute();
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFullscreen();
    }
  };

  useEffect(() => {
    setEnhanced(true);
    setFullscreenSupported(
      Boolean(playerRef.current?.requestFullscreen || videoRef.current?.webkitEnterFullscreen),
    );
    return () => {
      clearHideTimer();
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    clearHideTimer();
    if (!playing) {
      setControlsVisible(true);
      return undefined;
    }
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2200);
    return clearHideTimer;
  }, [playing]);

  useEffect(() => {
    if (!playing) return undefined;
    const updateProgress = () => {
      const video = videoRef.current;
      if (video && !video.paused) setCurrentTime(video.currentTime);
      progressFrameRef.current = window.requestAnimationFrame(updateProgress);
    };
    progressFrameRef.current = window.requestAnimationFrame(updateProgress);
    return () => {
      if (progressFrameRef.current) window.cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    };
  }, [playing]);

  useEffect(
    () => () => {
      if (previewSeekFrameRef.current) window.cancelAnimationFrame(previewSeekFrameRef.current);
    },
    [],
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const replaying = duration > 0 && currentTime >= duration - 0.15;
  const activeChapter = chapters.reduce(
    (active, chapter, index) => (currentTime >= chapter.time ? index : active),
    0,
  );

  return (
    <div className="hf-docs-video-block">
      <div
        ref={playerRef}
        className="hf-docs-video"
        role="region"
        aria-label={title}
        tabIndex={0}
        onKeyDown={handleKeyboard}
        onPointerMove={revealControls}
        onPointerLeave={() => playing && setControlsVisible(false)}
        onFocus={revealControls}
      >
        <video
          ref={videoRef}
          aria-label={title}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          playsInline
          preload="metadata"
          controls={!enhanced}
          onClick={togglePlayback}
          onDoubleClick={toggleFullscreen}
          onLoadedMetadata={(event) => {
            const nextDuration = event.currentTarget.duration || 0;
            setDuration(nextDuration);
            setMuted(event.currentTarget.muted);
            if (!initialMomentAppliedRef.current && typeof window !== "undefined") {
              initialMomentAppliedRef.current = true;
              const requestedTime = Number(new URL(window.location.href).searchParams.get("t"));
              if (Number.isFinite(requestedTime) && requestedTime > 0) {
                const nextTime = Math.min(nextDuration, requestedTime);
                event.currentTarget.currentTime = nextTime;
                setCurrentTime(nextTime);
              }
            }
          }}
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onPlaying={() => setWaiting(false)}
          onWaiting={() => setWaiting(true)}
          onCanPlay={() => setWaiting(false)}
          onEnded={() => {
            setPlaying(false);
            setControlsVisible(true);
          }}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        />

        {enhanced && (
          <>
            {!playing && (
              <button
                type="button"
                className="hf-docs-video-hero-play"
                onClick={togglePlayback}
                aria-label={replaying ? "Replay video" : "Play video"}
              >
                <span className="hf-docs-video-hero-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5.5v13l10-6.5z" />
                  </svg>
                </span>
              </button>
            )}

            {waiting && playing && <span className="hf-docs-video-spinner" aria-label="Loading" />}

            <div
              className="hf-docs-video-controls"
              data-visible={controlsVisible || !playing ? "true" : "false"}
            >
              <div
                className="hf-docs-video-scrub-preview"
                data-visible={previewing ? "true" : "false"}
                style={{ "--hf-video-preview-x": `${previewPosition}%` }}
                aria-hidden="true"
              >
                <video
                  ref={previewVideoRef}
                  src={src}
                  muted
                  playsInline
                  preload="metadata"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <span>{formatTime(previewTime)}</span>
              </div>

              <input
                className="hf-docs-video-progress"
                type="range"
                min="0"
                max={duration || 0}
                step="0.01"
                value={Math.min(currentTime, duration || 0)}
                aria-label="Video progress"
                aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
                onChange={seek}
                onPointerEnter={updateScrubPreview}
                onPointerMove={(event) =>
                  updateScrubPreview(event, scrubbing || event.buttons === 1)
                }
                onPointerDown={(event) => {
                  setScrubbing(true);
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  updateScrubPreview(event, true);
                }}
                onPointerUp={(event) => {
                  setScrubbing(false);
                  if (event.pointerType !== "mouse") setPreviewing(false);
                }}
                onPointerCancel={() => {
                  setScrubbing(false);
                  setPreviewing(false);
                }}
                onPointerLeave={() => {
                  if (!scrubbing) setPreviewing(false);
                }}
                style={{ "--hf-video-progress": `${progress}%` }}
              />

              <div className="hf-docs-video-control-row">
                <button
                  type="button"
                  className="hf-docs-video-control"
                  onClick={togglePlayback}
                  aria-label={playing ? "Pause video" : "Play video"}
                >
                  {playing ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5.5v13l10-6.5z" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className="hf-docs-video-control"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute video" : "Mute video"}
                >
                  {muted ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 9v6h4l5 4V5L8 9zm11.5 1.1 1.4-1.4 1.6 1.6 1.6-1.6 1.4 1.4-1.6 1.6 1.6 1.6-1.4 1.4-1.6-1.6-1.6 1.6-1.4-1.4 1.6-1.6z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 9v6h4l5 4V5L8 9zm11 1.2v3.6c1-.5 1.7-1.5 1.7-2.8S16 10.7 15 10.2zm0-4v2.1c2.2.6 3.7 2.5 3.7 4.7s-1.5 4.1-3.7 4.7v2.1c3.3-.7 5.7-3.5 5.7-6.8S18.3 6.9 15 6.2z" />
                    </svg>
                  )}
                </button>

                <span className="hf-docs-video-time" aria-hidden="true">
                  {formatTime(currentTime)} <span>/</span> {formatTime(duration)}
                </span>

                <span className="hf-docs-video-spacer" />

                <button
                  type="button"
                  className="hf-docs-video-rate"
                  onClick={cyclePlaybackRate}
                  aria-label={`Playback speed ${playbackRate} times`}
                >
                  {playbackRate}×
                </button>

                {fullscreenSupported && (
                  <button
                    type="button"
                    className="hf-docs-video-control"
                    onClick={toggleFullscreen}
                    aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {fullscreen ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 3H6v3H3v2h5zm8 0v5h5V6h-3V3zM3 16v2h3v3h2v-5zm13 0v5h2v-3h3v-2z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 8h2V5h3V3H3zm13-5v2h3v3h2V3zM5 16H3v5h5v-2H5zm14 3h-3v2h5v-5h-2z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {chapters.length > 0 && (
        <div className="hf-docs-video-guide">
          <div className="hf-docs-video-guide-head">
            <strong>Chapters</strong>
            <button type="button" onClick={copyMomentLink}>
              {momentCopied ? "Link copied" : `Copy ${formatTime(currentTime)} link`}
            </button>
          </div>
          <div className="hf-docs-video-chapters" aria-label={`${title} chapters`}>
            {chapters.map((chapter, index) => (
              <button
                type="button"
                key={`${chapter.time}-${chapter.label}`}
                data-active={activeChapter === index ? "true" : "false"}
                onClick={() => seekTo(chapter.time)}
                aria-current={activeChapter === index ? "true" : undefined}
              >
                <span>{formatTime(chapter.time)}</span>
                {chapter.label}
              </button>
            ))}
          </div>

          {transcript.length > 0 && (
            <details className="hf-docs-video-transcript">
              <summary>Read transcript</summary>
              <div>
                {transcript.map((line) => (
                  <button
                    type="button"
                    key={`${line.time}-${line.text}`}
                    onClick={() => seekTo(line.time)}
                  >
                    <span>{formatTime(line.time)}</span>
                    {line.text}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export const ShowcaseWall = () => {
  const CDN = "https://static.heygen.ai/hyperframes-oss/docs/images/showcase";
  const films = [
    {
      id: "grading",
      tile: "tile-grading-v2",
      full: "full-grading-4k-v2",
      title: "Colour grading and media effects",
      note: "Real footage graded with LUTs, curves, and scopes — inside Studio.",
      length: "48s",
    },
    {
      id: "variables",
      title: "One shoot, many cuts",
      note: "The same footage rendered as several vertical videos from one project.",
      length: "44s",
    },
    {
      id: "music",
      title: "Cut to the music",
      note: "A track analysed for beats and sections, then everything snapped to that grid.",
      length: "90s",
    },
    {
      id: "prvideo",
      title: "A pull request, explained",
      note: "A code change turned into a review anyone on the team can watch.",
      length: "32s",
    },
    {
      id: "timeline",
      title: "Editing on a timeline",
      note: "Trimming, splitting, and retiming a project by hand.",
      length: "34s",
    },
    {
      id: "hypecard",
      title: "A year in review",
      note: "Personal data turned into a shareable card, generated per person.",
      length: "27s",
    },
  ];
  const [openId, setOpenId] = useState(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const open = films.find((film) => film.id === openId) || null;

  if (open) {
    return (
      <div style={{ margin: "1.5rem 0" }}>
        <DocsVideo
          key={open.id}
          title={open.title}
          src={`${CDN}/${open.full || `full-${open.id}`}.mp4`}
          poster={`${CDN}/${open.tile || `tile-${open.id}`}.jpg`}
          autoPlay
        />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
            marginTop: "0.6rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.875rem", opacity: 0.75 }}>
            <strong>{open.title}</strong> · {open.length} · made with HyperFrames
          </span>
          <button
            type="button"
            onClick={() => setOpenId(null)}
            style={{
              fontSize: "0.8125rem",
              padding: "0.35rem 0.7rem",
              borderRadius: "7px",
              border: "1px solid currentColor",
              background: "transparent",
              color: "inherit",
              opacity: 0.7,
              cursor: "pointer",
            }}
          >
            ← Back to all films
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "0.85rem",
        margin: "1.5rem 0",
      }}
    >
      {films.map((film) => (
        <button
          key={film.id}
          type="button"
          onClick={() => setOpenId(film.id)}
          aria-label={`Play ${film.title}, ${film.length}`}
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            border: "1px solid rgba(128,128,128,0.28)",
            borderRadius: "11px",
            overflow: "hidden",
            background: "transparent",
            color: "inherit",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <video
            src={reduced ? undefined : `${CDN}/${film.tile || `tile-${film.id}`}.mp4`}
            poster={`${CDN}/${film.tile || `tile-${film.id}`}.jpg`}
            autoPlay={!reduced}
            muted
            loop={!reduced}
            playsInline
            preload="metadata"
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              objectFit: "cover",
              display: "block",
              background: "#000",
              margin: 0,
            }}
          />
          <span style={{ display: "block", padding: "0.7rem 0.85rem 0.85rem" }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: "0.9375rem" }}>
              {film.title}
            </span>
            <span
              style={{
                display: "block",
                fontSize: "0.8125rem",
                opacity: 0.7,
                marginTop: "0.15rem",
              }}
            >
              {film.note}
            </span>
            <span
              style={{
                display: "block",
                fontSize: "0.75rem",
                opacity: 0.55,
                marginTop: "0.35rem",
              }}
            >
              ▶ Play · {film.length}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
};
