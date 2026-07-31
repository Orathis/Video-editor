/**
 * Occurrence index for a selector within its source document.
 *
 * The preview flattens multiple composition files into one DOM, so a raw
 * `querySelectorAll` index is not a stable source-file identity. Callers supply
 * their existing source resolver; this helper alone owns occurrence scoping.
 */
export type SourceScopedSelectorIndex = ReadonlyMap<
  string,
  ReadonlyMap<string, ReadonlyMap<Element, number>>
>;

export function createSourceScopedSelectorIndex(
  elements: readonly Element[],
  resolveSourceFile: (candidate: Element) => string | undefined,
): SourceScopedSelectorIndex {
  const mutableIndex = new Map<string, Map<string, Map<Element, number>>>();

  for (const element of elements) {
    const scope = resolveSourceFile(element) ?? "index.html";
    for (const className of element.classList) {
      const selector = `.${CSS.escape(className)}`;
      let scopes = mutableIndex.get(selector);
      if (!scopes) {
        scopes = new Map();
        mutableIndex.set(selector, scopes);
      }
      let occurrences = scopes.get(scope);
      if (!occurrences) {
        occurrences = new Map();
        scopes.set(scope, occurrences);
      }
      occurrences.set(element, occurrences.size);
    }
  }

  return mutableIndex;
}

export function getSourceScopedSelectorIndex(
  doc: Document,
  el: Element,
  selector: string | undefined,
  sourceFile: string | undefined,
  resolveSourceFile: (candidate: Element) => string | undefined,
  index?: SourceScopedSelectorIndex,
): number | undefined {
  if (!selector || selector.startsWith("#") || selector.startsWith("[data-composition-id=")) {
    return undefined;
  }

  const scope = sourceFile ?? "index.html";
  if (index) return index.get(selector)?.get(scope)?.get(el);

  try {
    const matches = Array.from(doc.querySelectorAll(selector)).filter(
      (candidate) => (resolveSourceFile(candidate) ?? "index.html") === scope,
    );
    const matchIndex = matches.indexOf(el);
    return matchIndex >= 0 ? matchIndex : undefined;
  } catch {
    return undefined;
  }
}
