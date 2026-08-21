import { describe, expect, it } from "vitest";
import {
  decodedFrames,
  isVariableFrameRate,
  parseSceneScores,
  refineCuts,
} from "./referenceAnalysis.js";

describe("reference analysis timing", () => {
  it("preserves decoded PTS and detects variable frame intervals", () => {
    const frames = decodedFrames({
      frames: [
        {
          best_effort_timestamp: 0,
          best_effort_timestamp_time: "0",
          pkt_duration_time: "0.033",
          key_frame: 1,
        },
        {
          best_effort_timestamp: 1001,
          best_effort_timestamp_time: "0.033367",
          pkt_duration_time: "0.033",
        },
        {
          best_effort_timestamp: 2002,
          best_effort_timestamp_time: "0.066733",
          pkt_duration_time: "0.050",
        },
        {
          best_effort_timestamp: 3503,
          best_effort_timestamp_time: "0.116767",
          pkt_duration_time: "0.033",
        },
      ],
    });
    expect(frames[1]).toMatchObject({ pts: 1001, timeSeconds: 0.033367 });
    expect(isVariableFrameRate(frames, "30000/1001", "30000/1001")).toBe(true);
  });

  it("refines scene candidates onto actual decoded frames", () => {
    const frames = Array.from({ length: 6 }, (_, frameIndex) => ({
      frameIndex,
      pts: frameIndex * 1000,
      timeSeconds: frameIndex * 0.04,
      durationSeconds: 0.04,
      keyframe: frameIndex === 0,
    }));
    const scores = parseSceneScores("pts_time:0.117\nlavfi.scd.score=23.5");
    const cuts = refineCuts(scores, frames, 0.24);
    expect(cuts[1]).toMatchObject({ frameIndex: 3, timeSeconds: 0.12, kind: "hard-cut" });
  });
});
