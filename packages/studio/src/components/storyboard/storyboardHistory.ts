import type { RecordEditInput } from "../../utils/studioFileHistory";
import { saveProjectFilesWithHistory } from "../../utils/studioFileHistory";

export const STUDIO_HISTORY_APPLIED_EVENT = "hyperframes:history-applied";

export type StoryboardRecordEdit = (entry: RecordEditInput) => Promise<void>;

interface CommitStoryboardEditInput {
  projectId: string;
  path: string;
  before: string;
  after: string;
  label: string;
  coalesceKey?: string;
  coalesceMs?: number;
  writeFile: (path: string, content: string, expectedContent?: string) => Promise<void>;
  recordEdit: StoryboardRecordEdit;
}

/** Save one storyboard source mutation and add it to Studio's shared Undo/Redo stack. */
export async function commitStoryboardEdit({
  projectId,
  path,
  before,
  after,
  label,
  coalesceKey,
  coalesceMs,
  writeFile,
  recordEdit,
}: CommitStoryboardEditInput): Promise<boolean> {
  const changedPaths = await saveProjectFilesWithHistory({
    projectId,
    label,
    kind: "source",
    coalesceKey,
    coalesceMs,
    files: { [path]: after },
    readFile: async (requestedPath) => {
      if (requestedPath !== path) throw new Error(`Unexpected storyboard path: ${requestedPath}`);
      return before;
    },
    writeFile,
    recordEdit,
  });
  return changedPaths.length > 0;
}
