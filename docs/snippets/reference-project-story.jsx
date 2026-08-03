export const ReferenceProjectStory = ({ sourceHref }) => {
  const request = "Using /hyperframes, make a 10-second product intro for https://example.com.";

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(request);
    } catch {
      const field = document.createElement("textarea");
      field.value = request;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
  };

  return (
    <section className="hf-reference-story" aria-label="A HyperFrames project, opened up">
      <header className="hf-reference-story__header">
        <span>Reference project</span>
        <h2>One request. Every artifact.</h2>
        <p>
          Follow the same small project through the beginner, editing, Studio, and developer docs.
        </p>
      </header>

      <ol className="hf-reference-story__flow">
        <li>
          <div className="hf-reference-story__step">1</div>
          <div className="hf-reference-story__body">
            <h3>Request</h3>
            <div className="hf-reference-story__request">
              <code>{request}</code>
              <button type="button" onClick={copyRequest} aria-label="Copy the reference request">
                Copy
              </button>
            </div>
          </div>
        </li>

        <li>
          <div className="hf-reference-story__step">2</div>
          <div className="hf-reference-story__body">
            <h3>Brief</h3>
            <p>The request settles the source, length, and format. The agent asks one question:</p>
            <blockquote>Sell it, or show it as it is?</blockquote>
            <p>
              The answer is “show it.” The real page and its own words become the source of truth.
            </p>
          </div>
        </li>

        <li>
          <div className="hf-reference-story__step">3</div>
          <div className="hf-reference-story__body">
            <h3>Source</h3>
            <div className="hf-reference-story__files" role="list" aria-label="Project files">
              <span role="listitem">
                <code>BRIEF.md</code>
                <small>intent and facts</small>
              </span>
              <span role="listitem">
                <code>index.html</code>
                <small>composition and motion</small>
              </span>
              <span role="listitem">
                <code>captions.html</code>
                <small>timed phrases</small>
              </span>
              <span role="listitem">
                <code>assets/</code>
                <small>capture, voice, music, SFX</small>
              </span>
            </div>
          </div>
        </li>

        <li>
          <div className="hf-reference-story__step">4</div>
          <div className="hf-reference-story__body">
            <h3>Revision</h3>
            <div className="hf-reference-story__revision">
              <div>
                <span>First version</span>
                <p>A real capture, a 10-second timeline, and music.</p>
              </div>
              <div aria-hidden="true">→</div>
              <div>
                <span>Controlled version</span>
                <p>Editable variables, narration, captions, and purposeful sound.</p>
              </div>
            </div>
          </div>
        </li>

        <li>
          <div className="hf-reference-story__step">5</div>
          <div className="hf-reference-story__body">
            <h3>Render</h3>
            <p>
              The browser preview and final MP4 come from the same HTML project and the same
              timeline.
            </p>
            <a href={sourceHref}>Open the complete project →</a>
          </div>
        </li>
      </ol>
    </section>
  );
};
