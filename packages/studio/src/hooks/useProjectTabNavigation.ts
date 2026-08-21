import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectTabBarProps } from "../components/ProjectTabBar";
import type { ViewModeValue } from "../contexts/ViewModeContext";
import {
  navigateToProject,
  resolveProjectTransferDirection,
  type ProjectTransferDirection,
} from "../utils/projectViewTransition";
import { useProjects } from "./useProjects";

export interface ProjectTransfer {
  fromProjectId: string;
  direction: ProjectTransferDirection;
}

interface ProjectTabNavigation {
  projectTabBarProps: ProjectTabBarProps;
  projectTransfer: ProjectTransfer | null;
  projectStageAttributes: {
    "data-transfer-direction": ProjectTransferDirection | undefined;
    "data-transfer-leaving": "true" | undefined;
  };
}

/** Keeps project-tab mutations and the short hand-off animation out of the app shell. */
export function useProjectTabNavigation(
  projectId: string | null,
  viewMode: ViewModeValue,
): ProjectTabNavigation {
  const projects = useProjects(projectId);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [projectTransfer, setProjectTransfer] = useState<ProjectTransfer | null>(null);
  const transferTimerRef = useRef<number | null>(null);

  const activateProject = useCallback(
    (nextProjectId: string, nextView = viewMode.viewMode) => {
      if (!projectId) return;
      if (nextProjectId === projectId) {
        viewMode.setViewMode(nextView);
        return;
      }
      const direction = resolveProjectTransferDirection(
        projects.projects,
        projectId,
        nextProjectId,
      );
      setPendingProjectId(nextProjectId);
      setProjectTransfer({ fromProjectId: projectId, direction });
      if (transferTimerRef.current !== null) window.clearTimeout(transferTimerRef.current);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      transferTimerRef.current = window.setTimeout(
        () => {
          transferTimerRef.current = null;
          viewMode.setViewMode(nextView);
          navigateToProject(nextProjectId);
        },
        reduceMotion ? 0 : 110,
      );
    },
    [projectId, projects.projects, viewMode],
  );

  useEffect(
    () => () => {
      if (transferTimerRef.current !== null) window.clearTimeout(transferTimerRef.current);
    },
    [],
  );

  const projectTabBarProps: ProjectTabBarProps = {
    projects: projects.projects,
    archivedProjects: projects.archivedProjects,
    activeProjectId:
      pendingProjectId && pendingProjectId !== projectId ? pendingProjectId : (projectId ?? ""),
    creating: projects.creating,
    archivingProjectId: projects.archivingProjectId,
    error: projects.error,
    onSelect: activateProject,
    onOpenView: activateProject,
    onCreate: () => {
      void (async () => {
        const project = await projects.createProject();
        if (project) activateProject(project.id);
      })();
    },
    onArchive: (id) => {
      void (async () => {
        const index = projects.projects.findIndex((project) => project.id === id);
        const fallback = projects.projects[index + 1] ?? projects.projects[index - 1];
        const archived = await projects.archiveProject(id);
        if (archived && id === projectId && fallback) activateProject(fallback.id);
      })();
    },
    onUnarchive: (id) => void projects.unarchiveProject(id),
    onRename: (id, title) => void projects.renameProject(id, title),
  };

  const projectStageAttributes = {
    "data-transfer-direction": projectTransfer?.direction,
    "data-transfer-leaving":
      projectTransfer?.fromProjectId === projectId ? ("true" as const) : undefined,
  };

  return { projectTabBarProps, projectTransfer, projectStageAttributes };
}
