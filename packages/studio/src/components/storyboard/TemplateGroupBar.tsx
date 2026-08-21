import { useState } from "react";
import { Copy, Plus, X } from "@phosphor-icons/react";
import type { StoryboardTargetProfile } from "@hyperframes/core/storyboard";
import type { StoryboardDocument } from "../../hooks/useStoryboard";
import { Button, IconButton } from "../ui/Button";

export function TemplateGroupBar({
  documents,
  activePath,
  onSelect,
  onCreateVersion,
  onDuplicate,
}: {
  documents: StoryboardDocument[];
  activePath: string;
  onSelect: (path: string) => void;
  onCreateVersion: (title: string, profile: StoryboardTargetProfile) => Promise<void>;
  onDuplicate?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("Version 1");
  const [profile, setProfile] = useState<StoryboardTargetProfile>("9:16");
  const [busy, setBusy] = useState(false);
  if (documents.length === 0) return null;
  const versions = documents.filter((document) => document.kind === "version");
  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await onCreateVersion(title.trim(), profile);
      setCreating(false);
      setTitle(`Version ${versions.length + 2}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/55 p-2">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        Template group
      </span>
      {documents.map((document) => (
        <button
          key={document.path}
          type="button"
          onClick={() => onSelect(document.path)}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${document.path === activePath ? "border-sky-500 bg-sky-950/50 text-sky-100" : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white"}`}
        >
          <span className="mr-1 text-[9px] uppercase text-neutral-600">{document.kind}</span>
          {document.label}
        </button>
      ))}
      {!creating ? (
        <>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-400 transition-colors hover:border-sky-600 hover:text-sky-200"
          >
            <Plus size={11} /> Version
          </button>
          {onDuplicate ? (
            <button
              type="button"
              onClick={onDuplicate}
              className="flex items-center gap-1 rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 transition-colors hover:border-sky-600 hover:text-white"
            >
              <Copy size={11} /> Duplicate
            </button>
          ) : null}
        </>
      ) : (
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            className="h-7 w-32 rounded border border-neutral-700 bg-neutral-950 px-2 text-xs text-white outline-none focus:border-sky-500"
          />
          <select
            value={profile}
            onChange={(event) => setProfile(event.target.value as StoryboardTargetProfile)}
            className="h-7 rounded border border-neutral-700 bg-neutral-950 px-2 text-xs text-neutral-300"
          >
            <option value="9:16">9:16</option>
            <option value="16:9">16:9</option>
            <option value="4:5">4:5</option>
            <option value="1:1">1:1</option>
          </select>
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            icon={<Copy size={12} />}
            onClick={() => void submit()}
          >
            Create
          </Button>
          <IconButton
            size="sm"
            aria-label="Cancel version creation"
            icon={<X size={12} />}
            onClick={() => setCreating(false)}
          />
        </div>
      )}
    </div>
  );
}
