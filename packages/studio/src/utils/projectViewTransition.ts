import type { StudioProjectSummary } from "../components/ProjectTabBar";
import { buildProjectHash, parseProjectHashRoute } from "./projectRouting";

export type ProjectTransferDirection = "forward" | "back";

export function resolveProjectTransferDirection(
  projects: StudioProjectSummary[],
  currentProjectId: string,
  nextProjectId: string,
): ProjectTransferDirection {
  const currentIndex = projects.findIndex((project) => project.id === currentProjectId);
  const nextIndex = projects.findIndex((project) => project.id === nextProjectId);
  if (currentIndex < 0 || nextIndex < 0) return "forward";
  return nextIndex < currentIndex ? "back" : "forward";
}

/** Update only the project hash; the React shell owns the lightweight transfer animation. */
export function navigateToProject(projectId: string): void {
  const route = parseProjectHashRoute(window.location.hash);
  const nextHash = buildProjectHash(projectId, route?.params);
  if (window.location.hash === nextHash) return;
  window.location.hash = nextHash;
}
