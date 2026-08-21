export const STORYBOARD_TRANSITIONS = [
  { value: "crossfade", label: "Crossfade" },
  { value: "blur-crossfade", label: "Blur crossfade" },
  { value: "focus-pull", label: "Focus pull" },
  { value: "color-dip-to-black", label: "Color dip to black" },
  { value: "push-slide", label: "Push slide" },
  { value: "vertical-push", label: "Vertical push" },
  { value: "zoom-through", label: "Zoom through" },
  { value: "circle-iris", label: "Circle iris" },
  { value: "light-leak", label: "Light leak" },
  { value: "diagonal-split", label: "Diagonal split" },
  { value: "shutter", label: "Shutter" },
  { value: "film-burn", label: "Film burn" },
] as const;

export function isStoryboardTransition(value: string): boolean {
  return STORYBOARD_TRANSITIONS.some((transition) => transition.value === value);
}
