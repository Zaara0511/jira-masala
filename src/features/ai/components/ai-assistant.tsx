/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Bot, CornerDownLeft, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useTaskId } from "@/features/tasks/hooks/use-task-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { useGetTask } from "@/features/tasks/api/use-get-task";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { TaskGenerationPreview, type TaskProposal } from "./task-generation-preview";
import { StoryPlanPreview, type StoryPlanProposal } from "./story-plan-preview";

const WorkspaceBadge = ({ id }: { id: string }) => {
  const { data } = useGetWorkspace({ workspaceId: id });
  if (!data) return null;
  return <Badge variant="outline" className="text-xs bg-muted/50 font-normal shadow-sm">Workspace: {data.name}</Badge>;
};

const ProjectBadge = ({ id }: { id: string }) => {
  const { data } = useGetProject({ projectId: id });
  if (!data) return null;
  return <Badge variant="outline" className="text-xs bg-muted/50 font-normal shadow-sm">Project: {data.name}</Badge>;
};

const TaskBadge = ({ id }: { id: string }) => {
  const { data } = useGetTask({ taskId: id });
  if (!data) return null;
  return <Badge variant="outline" className="text-xs bg-muted/50 font-normal shadow-sm">Task: {data.name}</Badge>;
};

const AIMessageContent = ({ content }: { content: string }) => {
  return (
    <div className="text-sm break-words"><ReactMarkdown remarkPlugins={[remarkGfm]}
      components={{
        p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
        a: ({ node, ...props }: any) => <a className="text-blue-600 hover:underline font-medium" {...props} />,
        h1: ({ node, ...props }: any) => <h1 className="text-lg font-semibold mt-4 mb-2" {...props} />,
        h2: ({ node, ...props }: any) => <h2 className="text-base font-semibold mt-4 mb-2" {...props} />,
        h3: ({ node, ...props }: any) => <h3 className="text-sm font-semibold mt-3 mb-2" {...props} />,
        ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
        ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
        li: ({ node, ...props }: any) => <li className="leading-relaxed" {...props} />,
        strong: ({ node, ...props }: any) => <strong className="font-semibold" {...props} />,
        code: ({ node, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || "");
          const isInline = !match && !className?.includes("language-");
          if (isInline) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono" {...props}>
                {children}
              </code>
            );
          }
          return (
            <div className="overflow-x-auto bg-[#1e1e2e] text-[#cdd6f4] p-3 rounded-md my-3 text-xs font-mono border border-gray-800">
              <code className={className} {...props}>
                {children}
              </code>
            </div>
          );
        },
        pre: ({ node, ...props }: any) => <pre className="m-0" {...props} />,
        table: ({ node, ...props }: any) => (
          <div className="overflow-x-auto my-3 rounded-md border">
            <table className="min-w-full border-collapse text-sm" {...props} />
          </div>
        ),
        th: ({ node, ...props }: any) => <th className="border-b px-3 py-2 bg-muted font-medium text-left" {...props} />,
        td: ({ node, ...props }: any) => <td className="border-b px-3 py-2" {...props} />,
        blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-primary pl-4 italic text-muted-foreground my-2" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown></div>
  );
};

const SUGGESTIONS = [
  "What projects are in this workspace?",
  "What tasks are assigned to me?",
  "How healthy is this project?",
  "What should we work on today?",
  "Show overdue tasks.",
  "Summarize this project.",
  "Build a login system and distribute the work.",
];

export const AIAssistant = () => {
  const workspaceId = useWorkspaceId();
  const projectId = useProjectId();
  const taskId = useTaskId();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: {
        workspaceId,
        projectId,
        taskId,
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isLoading) return;
    sendMessage({ text: suggestion });
  };

  if (!workspaceId) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-50 bg-blue-600 hover:bg-blue-700 p-0 transition-transform hover:scale-105"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </Button>

      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-[400px] h-[650px] max-h-[calc(100vh-8rem)] max-w-[calc(100vw-3rem)] shadow-2xl flex flex-col z-50 overflow-hidden border-gray-200 dark:border-gray-800 bg-background sm:right-6 right-1/2 sm:translate-x-0 translate-x-1/2">
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-muted/30 pb-4 shrink-0">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-1.5 rounded-md">
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                Jira Assistant
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  AI Assistant
                </span>
                {taskId ? <TaskBadge id={taskId} /> : projectId ? <ProjectBadge id={projectId} /> : workspaceId ? <WorkspaceBadge id={workspaceId} /> : null}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground h-8 w-8 -mr-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close Assistant</span>
            </Button>
          </CardHeader>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 scroll-smooth"
          >
            <div className="flex flex-col gap-5 pb-2">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center mt-10 space-y-6">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                    <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Your intelligent assistant</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                      Your workspace, projects and tasks — in one conversation.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 w-full mt-4">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="text-sm border rounded-lg p-3 text-left hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center justify-between group"
                      >
                        {suggestion}
                        <CornerDownLeft className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col gap-2 text-sm",
                    message.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-start gap-3 max-w-[85%]",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="bg-blue-100 dark:bg-blue-900/50 p-1.5 rounded-md mt-0.5 shrink-0">
                        <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-xl px-4 py-3",
                        message.role === "user"
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "bg-muted rounded-tl-sm border shadow-sm"
                      )}
                    >
                      {message.parts.map((part, index) => {
                        if ((part as any).type === "text") {
                          return message.role === "user" ? (
                            <div key={index} className="whitespace-pre-wrap">{(part as any).text}</div>
                          ) : (
                            <AIMessageContent key={index} content={(part as any).text} />
                          );
                        }

                        if ((part as any).type === "tool-proposeStory") {
                          if ((part as any).state === "input-available") {
                            return (
                              <div key={index} className="mt-3 w-full sm:w-[320px]">
                                <TaskGenerationPreview
                                  proposal={(part as any).input as TaskProposal}
                                  onConfirm={() => {}}
                                  onCancel={() => {}}
                                />
                              </div>
                            );
                          }
                        }

                        if ((part as any).type === "tool-proposeStoryPlan") {
                          if ((part as any).state === "input-available") {
                            return (
                              <div key={index} className="mt-3 w-full">
                                <StoryPlanPreview
                                  proposal={(part as any).input as StoryPlanProposal}
                                  onRegenerate={() => {
                                    if (!isLoading) {
                                      sendMessage({ text: "Please regenerate the story plan with different assignments or subtask breakdown." });
                                    }
                                  }}
                                />
                              </div>
                            );
                          }
                        }

                        const isGenericTool = (part as any).type === "tool-invocation" || ((part as any).type?.startsWith("tool-") && (part as any).type !== "tool-proposeStory" && (part as any).type !== "tool-proposeStoryPlan");
                        if (isGenericTool) {
                           const state = (part as any).state || (part as any).toolInvocation?.state;
                           if (state === "partial-call" || state === "call") {
                             return (
                               <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground mt-2 bg-background/50 p-2 rounded border">
                                 <Loader2 className="h-3 w-3 animate-spin" />
                                 Working...
                               </div>
                             );
                           }
                        }

                        return null;
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/50 p-1.5 rounded-md shrink-0">
                    <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="bg-muted rounded-xl rounded-tl-sm px-4 py-3 border shadow-sm flex items-center gap-1.5">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"></span>
                    </span>
                  </div>
                </div>
              )}

              {error && (() => {
                const is429 = error.message?.includes("429") || error.message?.toLowerCase().includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.toLowerCase().includes("rate limit");
                const is503 = error.message?.includes("503") || error.message?.toLowerCase().includes("overloaded") || error.message?.toLowerCase().includes("service unavailable");

                let retryDelayMessage = "Please try again after the quota resets.";
                const retryMatch = error.message?.match(/RETRY_(\d+)/);
                if (retryMatch) {
                   const seconds = parseInt(retryMatch[1], 10);
                   if (seconds > 3600) {
                     const hours = Math.ceil(seconds / 3600);
                     retryDelayMessage = `Please try again in about ${hours} hour${hours === 1 ? '' : 's'}.`;
                   } else {
                     const minutes = Math.ceil(seconds / 60);
                     retryDelayMessage = `Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
                   }
                }

                return (
                  <div className="flex flex-col items-center justify-center p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm mt-2 text-center">
                    <p className="font-medium mb-1">
                      {is429 ? "The AI assistant has temporarily reached its Gemini request limit." :
                       is503 ? "The AI service is temporarily busy." :
                       "Something went wrong."}
                    </p>
                    <p className="text-xs opacity-80 mb-3">
                      {is429 ? retryDelayMessage :
                       is503 ? "Please try again in a moment." :
                       "Failed to generate a response."}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                      Refresh page
                    </Button>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="p-4 border-t bg-background shrink-0">
            <form
              onSubmit={handleSubmit}
              className="flex gap-2 items-end relative bg-muted/50 focus-within:bg-background border rounded-lg p-1 transition-colors"
            >
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your workspace, projects or tasks..."
                className="min-h-[44px] max-h-[120px] resize-none border-0 focus-visible:ring-0 bg-transparent py-3 px-3 shadow-none text-sm"
                disabled={isLoading}
                rows={1}
              />

              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="shrink-0 h-9 w-9 mb-1 mr-1 rounded-md"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
            </form>
            <div className="text-[10px] text-center text-muted-foreground mt-2">
              AI can make mistakes. Verify important information.
            </div>
          </div>
        </Card>
      )}
    </>
  );
};
