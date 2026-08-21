import { useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Archive, CaretDown, Check, FileVideo, PencilSimple, Plus } from "@phosphor-icons/react";
import type { StoryboardDocument } from "../../hooks/useStoryboard";

export interface StoryboardDirectionProps {
  frameCount: number;
  storyboards: StoryboardDocument[];
  archivedStoryboards: StoryboardDocument[];
  activePath: string;
  onSelectStoryboard: (path: string) => void;
  onCreateStoryboard: (title: string) => Promise<boolean>;
  onRenameStoryboard: (path: string, title: string) => Promise<boolean>;
  onArchiveStoryboard: (path: string) => Promise<boolean>;
  onUnarchiveStoryboard: (path: string) => Promise<boolean>;
  creatingStoryboard: boolean;
  mutatingStoryboardPath: string | null;
  error: string | null;
  onImportReference?: () => void;
  comparisonSelectionPaths?: string[];
  comparisonSummary?: string;
  onToggleComparisonSelection?: (path: string) => void;
}

interface StoryboardContextMenu {
  storyboard: StoryboardDocument;
  archived: boolean;
  x: number;
  y: number;
}

/** The current storyboard heading and per-project storyboard switcher. */
// fallow-ignore-next-line complexity
export function StoryboardDirection({
  frameCount,
  storyboards,
  archivedStoryboards,
  activePath,
  onSelectStoryboard,
  onCreateStoryboard,
  onRenameStoryboard,
  onArchiveStoryboard,
  onUnarchiveStoryboard,
  creatingStoryboard,
  mutatingStoryboardPath,
  error,
  onImportReference,
  comparisonSelectionPaths = [],
  comparisonSummary,
  onToggleComparisonSelection,
}: StoryboardDirectionProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [contextMenu, setContextMenu] = useState<StoryboardContextMenu | null>(null);

  const close = () => {
    setOpen(false);
    setCreating(false);
    setDraftTitle("");
    setEditingPath(null);
    setRenameDraft("");
    setContextMenu(null);
  };

  const submitCreate = async () => {
    if (await onCreateStoryboard(draftTitle)) close();
  };

  const submitRename = async (path: string) => {
    if (await onRenameStoryboard(path, renameDraft)) {
      setEditingPath(null);
      setRenameDraft("");
    }
  };

  const openContextMenu = (
    event: ReactMouseEvent<HTMLButtonElement>,
    storyboard: StoryboardDocument,
    archived: boolean,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ storyboard, archived, x: event.clientX, y: event.clientY });
  };

  const beginRename = () => {
    if (!contextMenu) return;
    setEditingPath(contextMenu.storyboard.path);
    setRenameDraft(contextMenu.storyboard.label);
    setContextMenu(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    if (editingPath) {
      setEditingPath(null);
      setRenameDraft("");
      return;
    }
    close();
  };

  const busy = mutatingStoryboardPath !== null;

  return (
    <header className="border-b border-neutral-800 pb-4">
      <div className="flex items-center gap-3">
        <div
          className="relative"
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (!next || !event.currentTarget.contains(next)) close();
          }}
        >
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="group flex items-center gap-1.5 rounded-md text-lg font-semibold text-neutral-100 outline-none transition-colors hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-500"
          >
            Storyboard
            <CaretDown
              size={14}
              weight="bold"
              className={`text-neutral-500 transition-transform duration-150 group-hover:text-sky-300 ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open ? (
            <div className="absolute left-0 top-full z-40 w-72 pt-2">
              <div
                role="menu"
                aria-label="Storyboards in this project"
                className="rounded-lg border border-neutral-700 bg-neutral-900/98 p-1.5 shadow-2xl backdrop-blur"
              >
                <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  This project · right-click to manage
                </div>
                {storyboards.map((storyboard) => {
                  const active = storyboard.path === activePath;
                  const editing = storyboard.path === editingPath;
                  const comparisonIndex = comparisonSelectionPaths.indexOf(storyboard.path);
                  return editing ? (
                    <div key={storyboard.path} className="p-1">
                      <input
                        autoFocus
                        value={renameDraft}
                        maxLength={80}
                        aria-label={`Rename ${storyboard.label}`}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void submitRename(storyboard.path);
                          }
                        }}
                        className="h-8 w-full rounded-md border border-sky-700 bg-neutral-950 px-2.5 text-xs text-white outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      key={storyboard.path}
                      type="button"
                      role="menuitem"
                      title="Shift-click to compare · right-click to manage"
                      onContextMenu={(event) => openContextMenu(event, storyboard, false)}
                      onClick={(event) => {
                        if (event.shiftKey && onToggleComparisonSelection) {
                          onToggleComparisonSelection(storyboard.path);
                          if (comparisonSelectionPaths.length === 1 && comparisonIndex === -1) {
                            close();
                          }
                          return;
                        }
                        onSelectStoryboard(storyboard.path);
                        close();
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs outline-none transition-colors hover:bg-neutral-800 focus:bg-neutral-800 ${comparisonIndex >= 0 ? "bg-emerald-950/35 text-emerald-100 ring-1 ring-inset ring-emerald-800/50" : active ? "text-white" : "text-neutral-300"}`}
                    >
                      <span className="truncate">{storyboard.label}</span>
                      {comparisonIndex >= 0 ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-neutral-950">
                          {comparisonIndex + 1}
                        </span>
                      ) : active ? (
                        <Check size={13} className="shrink-0 text-sky-400" />
                      ) : null}
                    </button>
                  );
                })}
                {archivedStoryboards.length > 0 ? (
                  <div className="mt-1 border-t border-neutral-800 pt-1">
                    <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                      Archived
                    </div>
                    {archivedStoryboards.map((storyboard) => {
                      const editing = storyboard.path === editingPath;
                      return editing ? (
                        <div key={storyboard.path} className="p-1">
                          <input
                            autoFocus
                            value={renameDraft}
                            maxLength={80}
                            aria-label={`Rename ${storyboard.label}`}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void submitRename(storyboard.path);
                              }
                            }}
                            className="h-8 w-full rounded-md border border-sky-700 bg-neutral-950 px-2.5 text-xs text-white outline-none"
                          />
                        </div>
                      ) : (
                        <button
                          key={storyboard.path}
                          type="button"
                          role="menuitem"
                          disabled={busy}
                          title="Click to restore, or right-click to manage"
                          onContextMenu={(event) => openContextMenu(event, storyboard, true)}
                          onClick={() => void onUnarchiveStoryboard(storyboard.path)}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-neutral-500 outline-none transition-colors hover:bg-neutral-800 hover:text-neutral-200 focus:bg-neutral-800 disabled:opacity-40"
                        >
                          <span className="truncate">{storyboard.label}</span>
                          <span className="text-[10px] text-neutral-600">Restore</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="mt-1 border-t border-neutral-800 pt-1">
                  {creating ? (
                    <div className="p-1">
                      <input
                        autoFocus
                        value={draftTitle}
                        maxLength={80}
                        placeholder="Storyboard name"
                        aria-label="New storyboard name"
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void submitCreate();
                          }
                        }}
                        className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2.5 text-xs text-white outline-none focus:border-sky-600"
                      />
                      <button
                        type="button"
                        disabled={creatingStoryboard || !draftTitle.trim()}
                        onClick={() => void submitCreate()}
                        className="mt-1.5 flex h-8 w-full items-center justify-center rounded-md bg-sky-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {creatingStoryboard ? "Creating…" : "Create storyboard"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setCreating(true)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-neutral-300 outline-none transition-colors hover:bg-neutral-800 hover:text-white focus:bg-neutral-800"
                    >
                      <Plus size={13} weight="bold" />
                      New storyboard
                    </button>
                  )}
                  {error ? (
                    <p role="alert" className="px-2 py-1 text-[11px] text-red-400">
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {contextMenu ? (
            <div
              role="menu"
              aria-label={`Manage ${contextMenu.storyboard.label}`}
              className="fixed z-[100] w-40 rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-2xl"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={beginRename}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
              >
                <PencilSimple size={13} /> Rename
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy || (!contextMenu.archived && storyboards.length <= 1)}
                title={
                  !contextMenu.archived && storyboards.length <= 1
                    ? "A project must keep one active storyboard"
                    : undefined
                }
                onClick={async () => {
                  const changed = contextMenu.archived
                    ? await onUnarchiveStoryboard(contextMenu.storyboard.path)
                    : await onArchiveStoryboard(contextMenu.storyboard.path);
                  if (changed) setContextMenu(null);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-35 ${contextMenu.archived ? "text-neutral-200" : "text-red-300"}`}
              >
                <Archive size={13} /> {contextMenu.archived ? "Unarchive" : "Archive"}
              </button>
            </div>
          ) : null}
        </div>
        <span className="text-sm font-medium text-neutral-500">
          {comparisonSummary ?? `${frameCount} frame${frameCount === 1 ? "" : "s"}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {onImportReference ? (
            <button
              type="button"
              onClick={onImportReference}
              className="flex h-8 items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 text-xs font-semibold text-neutral-200 transition-all hover:-translate-y-0.5 hover:border-sky-500 hover:bg-sky-950/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              <FileVideo size={14} className="text-sky-400" />
              Import reference
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
