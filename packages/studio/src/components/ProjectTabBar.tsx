import { Plus, X } from "@phosphor-icons/react";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import type { StudioViewMode } from "../contexts/ViewModeContext";

export interface StudioProjectSummary {
  id: string;
  title?: string;
}

export interface ProjectTabBarProps {
  projects: StudioProjectSummary[];
  archivedProjects: StudioProjectSummary[];
  activeProjectId: string;
  creating: boolean;
  archivingProjectId: string | null;
  error: string | null;
  onSelect: (projectId: string) => void;
  onOpenView: (projectId: string, view: StudioViewMode) => void;
  onCreate: () => void;
  onArchive: (projectId: string) => void;
  onUnarchive: (projectId: string) => void;
  onRename: (projectId: string, title: string) => void;
}

/** The top-most workspace switcher. Each tab owns a complete Studio project. */
export function ProjectTabBar({
  projects,
  archivedProjects,
  activeProjectId,
  creating,
  archivingProjectId,
  error,
  onSelect,
  onOpenView,
  onCreate,
  onArchive,
  onUnarchive,
  onRename,
}: ProjectTabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);

  const startRename = (event: MouseEvent, project: StudioProjectSummary) => {
    event.preventDefault();
    setOpenFlyoutId(null);
    setDraftTitle(project.title || project.id);
    setEditingId(project.id);
  };

  const commitRename = (project: StudioProjectSummary) => {
    const title = draftTitle.trim();
    setEditingId(null);
    if (title && title !== (project.title || project.id)) onRename(project.id, title);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const currentIndex = projects.findIndex((project) => project.id === activeProjectId);
    if (currentIndex < 0 || projects.length < 2) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = projects[(currentIndex + delta + projects.length) % projects.length];
    if (next) onSelect(next.id);
  };

  return (
    <div className="relative z-[60] flex h-9 shrink-0 items-center border-b border-neutral-800 bg-[#09090b] px-2">
      <div
        role="tablist"
        aria-label="Projects"
        onKeyDown={handleKeyDown}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-visible"
      >
        {projects.map((project) => {
          const active = project.id === activeProjectId;
          const editing = editingId === project.id;
          const label = project.title || project.id;
          return (
            <div
              key={project.id}
              role="presentation"
              className="group/project-tab relative shrink-0"
              onMouseEnter={() => setOpenFlyoutId(project.id)}
              onMouseLeave={() => setOpenFlyoutId(null)}
              onFocus={() => setOpenFlyoutId(project.id)}
              onBlur={(event) => {
                const next = event.relatedTarget as Node | null;
                if (!next || !event.currentTarget.contains(next)) setOpenFlyoutId(null);
              }}
            >
              {editing ? (
                <input
                  autoFocus
                  value={draftTitle}
                  maxLength={80}
                  aria-label={`Rename ${label}`}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => commitRename(project)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename(project);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingId(null);
                    }
                  }}
                  className="h-7 min-w-24 max-w-56 rounded-md border border-studio-accent bg-neutral-900 px-2.5 text-xs font-medium text-white outline-none"
                />
              ) : (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    title={`${label} · Right-click to rename`}
                    onClick={() => onSelect(project.id)}
                    onContextMenu={(event) => startRename(event, project)}
                    className={`h-7 rounded-md py-0 pl-3 pr-8 text-xs font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-accent ${
                      active
                        ? "bg-neutral-800 text-white shadow-[inset_0_-2px_0_0_var(--color-studio-accent)]"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    {label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Archive ${label} (${project.id})`}
                    title={
                      projects.length <= 1
                        ? "At least one project must remain open"
                        : "Archive project"
                    }
                    disabled={projects.length <= 1 || archivingProjectId !== null}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenFlyoutId(null);
                      onArchive(project.id);
                    }}
                    className={`absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-neutral-500 opacity-0 outline-none transition-all duration-150 hover:bg-neutral-700 hover:text-white focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-accent group-hover/project-tab:opacity-100 group-focus-within/project-tab:opacity-100 disabled:pointer-events-none ${
                      archivingProjectId === project.id ? "animate-pulse opacity-100" : ""
                    }`}
                  >
                    <X size={11} weight="bold" />
                  </button>
                  {openFlyoutId === project.id && (
                    <ProjectFlyout
                      label={label}
                      onOpenStoryboard={() => onOpenView(project.id, "storyboard")}
                      onOpenPreview={() => onOpenView(project.id, "timeline")}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
        <div
          className="relative shrink-0"
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (!next || !event.currentTarget.contains(next)) {
              setCreateMenuOpen(false);
              setShowArchivedProjects(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setCreateMenuOpen(false);
              setShowArchivedProjects(false);
            }
          }}
        >
          <button
            type="button"
            aria-label="Project actions"
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
            title="Create or restore a project"
            onClick={() => {
              setCreateMenuOpen((open) => !open);
              setShowArchivedProjects(false);
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-neutral-500 outline-none transition-all duration-200 hover:rotate-90 hover:border-neutral-600 hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-accent ${
              createMenuOpen
                ? "rotate-45 border-neutral-600 bg-neutral-800 text-white"
                : "border-neutral-800"
            }`}
          >
            <Plus size={14} weight="bold" />
          </button>
          {createMenuOpen && (
            <div className="absolute left-0 top-full z-20 w-56 pt-1">
              <div
                role="menu"
                aria-label="Project actions"
                className="rounded-lg border border-neutral-700 bg-neutral-900/98 p-1.5 shadow-2xl backdrop-blur"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={creating}
                  onClick={() => {
                    setCreateMenuOpen(false);
                    onCreate();
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-medium text-neutral-200 outline-none transition-colors hover:bg-neutral-800 focus:bg-neutral-800 disabled:cursor-wait disabled:opacity-40"
                >
                  <span>{creating ? "Creating…" : "Create new"}</span>
                  <span className="text-[10px] font-normal text-neutral-500">
                    Duplicate current
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-expanded={showArchivedProjects}
                  disabled={archivedProjects.length === 0}
                  onClick={() => setShowArchivedProjects((show) => !show)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-medium text-neutral-200 outline-none transition-colors hover:bg-neutral-800 focus:bg-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-600"
                >
                  <span>Unarchive</span>
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-normal text-neutral-400">
                    {archivedProjects.length}
                  </span>
                </button>
                {showArchivedProjects && archivedProjects.length > 0 && (
                  <div className="mt-1 max-h-56 overflow-y-auto border-t border-neutral-800 pt-1">
                    {archivedProjects.map((project) => {
                      const label = project.title || project.id;
                      return (
                        <button
                          key={project.id}
                          type="button"
                          role="menuitem"
                          aria-label={`Restore ${label} (${project.id})`}
                          disabled={archivingProjectId !== null}
                          onClick={() => {
                            setCreateMenuOpen(false);
                            setShowArchivedProjects(false);
                            onUnarchive(project.id);
                          }}
                          className="block w-full truncate rounded-md px-3 py-2 text-left text-xs text-neutral-300 outline-none transition-colors hover:bg-neutral-800 hover:text-white focus:bg-neutral-800 disabled:opacity-40"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {error && (
          <span className="ml-1 truncate text-xs text-red-400" title={error}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

function ProjectFlyout({
  label,
  onOpenStoryboard,
  onOpenPreview,
}: {
  label: string;
  onOpenStoryboard: () => void;
  onOpenPreview: () => void;
}) {
  return (
    <div className="absolute left-0 top-full w-64 pt-1">
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/98 p-2 shadow-2xl backdrop-blur">
        <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {label} project
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={onOpenStoryboard}
            className="rounded-md border border-neutral-800 px-3 py-2 text-left text-xs text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
          >
            <span className="block font-medium">Storyboard</span>
            <span className="mt-0.5 block text-[10px] text-neutral-500">Plan the video</span>
          </button>
          <button
            type="button"
            onClick={onOpenPreview}
            className="rounded-md border border-neutral-800 px-3 py-2 text-left text-xs text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
          >
            <span className="block font-medium">Preview</span>
            <span className="mt-0.5 block text-[10px] text-neutral-500">Edit the video</span>
          </button>
        </div>
      </div>
    </div>
  );
}
