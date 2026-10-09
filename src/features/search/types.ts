export type SearchResultType = "task" | "project" | "comment";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  projectId?: string;
  taskId?: string;
}
