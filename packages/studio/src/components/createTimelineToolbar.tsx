import type { ComponentProps, ReactElement } from "react";
import { TimelineToolbar } from "./TimelineToolbar";

type TimelineToolbarProps = ComponentProps<typeof TimelineToolbar>;

export function createTimelineToolbar(
  domEditSession: TimelineToolbarProps["domEditSession"],
  onSplitElement: TimelineToolbarProps["onSplitElement"],
): ReactElement {
  return <TimelineToolbar domEditSession={domEditSession} onSplitElement={onSplitElement} />;
}
