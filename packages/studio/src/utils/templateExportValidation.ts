interface ReferenceMaterial {
  label: string;
  kind: string;
  startSeconds: number;
}

interface ExportValidationResponse {
  affected?: ReferenceMaterial[];
}

/** Warns before a render can accidentally ship reference footage or guide audio. */
export async function confirmReferenceMaterialExport(
  projectId: string,
  compositionPath: string,
): Promise<boolean> {
  const query = new URLSearchParams({ composition: compositionPath });
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/templates/export-validation?${query.toString()}`,
  );
  const validation: ExportValidationResponse = response.ok
    ? ((await response.json()) as ExportValidationResponse)
    : { affected: [] };
  const affected = validation.affected ?? [];
  if (affected.length === 0) return true;

  const elements = affected
    .map((item) => `• ${item.label} (${item.kind}, ${item.startSeconds.toFixed(3)}s)`)
    .join("\n");
  return window.confirm(
    `Reference material remains in ${affected.length} timeline element${affected.length === 1 ? "" : "s"}:\n\n${elements}\n\nExport anyway?`,
  );
}
