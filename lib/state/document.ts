/**
 * Where an admin document is filed. The dependent id is required only for
 * the destination that uses it, so "project selected while destination is
 * general" is not an error — that id is ignored.
 */

export const DOCUMENT_DESTINATIONS = ["general", "project", "property"] as const;
export type DocumentDestination = (typeof DOCUMENT_DESTINATIONS)[number];

export function parseDocumentDestination(value: unknown): DocumentDestination | null {
  return value === "general" || value === "project" || value === "property" ? value : null;
}

export function documentDestinationError(
  dest: DocumentDestination,
  projectId: string,
  propertyId: string,
): string | null {
  if (dest === "project" && !projectId) return "Choose a project";
  if (dest === "property" && !propertyId) return "Choose a property";
  return null;
}
