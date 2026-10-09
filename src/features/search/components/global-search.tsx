"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, CheckSquare, Folder, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDebounce } from "react-use";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGlobalSearch } from "../api/use-global-search";
import { SearchResult } from "../types";

import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export const GlobalSearch = () => {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useDebounce(
    () => {
      setDebouncedQuery(query);
    },
    300,
    [query]
  );

  const { data: results, isLoading } = useGlobalSearch({
    workspaceId,
    query: debouncedQuery,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    if (result.type === "task") {
      router.push(`/workspaces/${workspaceId}/tasks/${result.id}`);
    } else if (result.type === "project") {
      router.push(`/workspaces/${workspaceId}/projects/${result.id}`);
    } else if (result.type === "comment") {
      router.push(`/workspaces/${workspaceId}/tasks/${result.taskId}`);
    }
  };

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="flex items-center gap-x-2 px-3 py-2 rounded-md bg-neutral-100 hover:bg-neutral-200 cursor-pointer text-sm text-neutral-500 w-full max-w-[200px] lg:max-w-[300px] transition"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left hidden lg:inline">Search...</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-2xl overflow-hidden bg-white shadow-xl">
          <DialogHeader className="border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-neutral-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks, projects, comments..."
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none text-base"
              />
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] h-[300px]">
            {isLoading && query.length >= 2 ? (
              <div className="flex items-center justify-center p-8 text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : results?.length === 0 && query.length >= 2 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                No results found for &quot;{query}&quot;
              </div>
            ) : !query || query.length < 2 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                Type at least 2 characters to search
              </div>
            ) : (
              <div className="p-2 flex flex-col gap-1">
                {results?.map((result: SearchResult, i: number) => (
                  <div
                    key={result.id + i}
                    onClick={() => handleSelect(result)}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-neutral-100 cursor-pointer text-sm"
                  >
                    {result.type === "task" && <CheckSquare className="w-4 h-4 text-blue-500" />}
                    {result.type === "project" && <Folder className="w-4 h-4 text-orange-500" />}
                    {result.type === "comment" && <MessageSquare className="w-4 h-4 text-green-500" />}

                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-900">{result.title}</span>
                      <span className="text-xs text-neutral-500 capitalize">{result.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
