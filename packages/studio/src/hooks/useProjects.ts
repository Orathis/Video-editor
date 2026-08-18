import { useCallback, useEffect, useState } from "react";
import type { StudioProjectSummary } from "../components/ProjectTabBar";

interface ProjectsResponse {
  projects?: StudioProjectSummary[];
  archivedProjects?: StudioProjectSummary[];
}

export function useProjects(activeProjectId: string | null) {
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<StudioProjectSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error(`Could not load projects (${response.status})`);
      const payload = (await response.json()) as ProjectsResponse;
      setProjects(payload.projects ?? []);
      setArchivedProjects(payload.archivedProjects ?? []);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createProject = useCallback(async (): Promise<StudioProjectSummary | null> => {
    if (!activeProjectId || creating) return null;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceProjectId: activeProjectId }),
      });
      const payload = (await response.json()) as StudioProjectSummary & { error?: string };
      if (!response.ok)
        throw new Error(payload.error || `Could not create project (${response.status})`);
      await reload();
      return payload;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      return null;
    } finally {
      setCreating(false);
    }
  }, [activeProjectId, creating, reload]);

  const renameProject = useCallback(async (projectId: string, title: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const payload = (await response.json()) as StudioProjectSummary & { error?: string };
      if (!response.ok)
        throw new Error(payload.error || `Could not rename project (${response.status})`);
      setProjects((current) =>
        current.map((project) => (project.id === projectId ? { ...project, title } : project)),
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }, []);

  const setProjectArchived = useCallback(
    async (projectId: string, archived: boolean): Promise<boolean> => {
      if (archivingProjectId) return false;
      setArchivingProjectId(projectId);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived }),
        });
        const payload = (await response.json()) as StudioProjectSummary & { error?: string };
        if (!response.ok) {
          throw new Error(
            payload.error ||
              `Could not ${archived ? "archive" : "restore"} project (${response.status})`,
          );
        }
        await reload();
        return true;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
        return false;
      } finally {
        setArchivingProjectId(null);
      }
    },
    [archivingProjectId, reload],
  );

  return {
    projects,
    archivedProjects,
    creating,
    archivingProjectId,
    error,
    createProject,
    renameProject,
    archiveProject: (projectId: string) => setProjectArchived(projectId, true),
    unarchiveProject: (projectId: string) => setProjectArchived(projectId, false),
  };
}
