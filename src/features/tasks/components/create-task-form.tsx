"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";
import { DottedSeparator } from "@/components/dotted-separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { TaskStatus } from "../types";
import { createTaskSchema } from "../schemas";
import { useCreateTask } from "../api/use-create-task";

interface CreateTaskFormProps {
  onCancel?: () => void;
  projectOptions: { id: string, name: string, imageUrl: string }[];
  memberOptions: { id: string, name: string, designation?: string }[];
};

import { Sparkles, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const FIBONACCI_WEIGHTS = [
  { value: 1, label: "Trivial" },
  { value: 2, label: "Small" },
  { value: 3, label: "Medium" },
  { value: 5, label: "Moderate" },
  { value: 8, label: "Large" },
  { value: 13, label: "Very large" },
];

export const CreateTaskForm = ({ onCancel, projectOptions, memberOptions }: CreateTaskFormProps) => {
  const workspaceId = useWorkspaceId();
  const { mutate, isPending } = useCreateTask();

  const [aiPrompt, setAiPrompt] = useState("");

  const form = useForm<z.infer<typeof createTaskSchema>>({
    resolver: zodResolver(createTaskSchema.omit({ workspaceId: true })),
    defaultValues: {
      workspaceId,
    },
  });

  const {
    messages: aiMessages,
    sendMessage,
    status: aiStatus,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: {
        workspaceId,
      },
    }),
  });

  const isGenerating = aiStatus === "submitted" || aiStatus === "streaming";

  useEffect(() => {
    const lastMessage = aiMessages[aiMessages.length - 1];

    if (lastMessage?.role === "assistant") {
      for (const part of lastMessage.parts) {
        if (
          part.type === "tool-proposeStory" &&
          part.state === "input-available"
        ) {
          const proposal = part.input as {
            title?: string;
            projectId?: string;
            priority?: number;
            dueDate?: string;
            status?: TaskStatus;
            assigneeId?: string;
          };

          // Story Name
          if (proposal.title) {
            form.setValue("name", proposal.title);
          }

          // Project
          if (
            proposal.projectId &&
            projectOptions.some((opt) => opt.id === proposal.projectId)
          ) {
            form.setValue("projectId", proposal.projectId);
          }

          // Weight
          if (proposal.priority !== undefined) {
            form.setValue("weight", proposal.priority);
          }

          // Due Date
          if (proposal.dueDate) {
            form.setValue("dueDate", new Date(proposal.dueDate));
          }

          // Status
          if (proposal.status) {
            form.setValue("status", proposal.status);
          }

          // Assignee
          if (
            proposal.assigneeId &&
            memberOptions.some((member) => member.id === proposal.assigneeId)
          ) {
            form.setValue("assigneeId", proposal.assigneeId);
          }
        }
      }
    }
  }, [aiMessages, form, projectOptions, memberOptions]);

  const handleGenerate = (e: React.MouseEvent) => {
    e.preventDefault();

    if (!aiPrompt.trim()) return;

    sendMessage({
      text: `Use the proposeStory tool for this request. Do not use proposeStoryPlan.

Generate a complete story proposal from this idea:

${aiPrompt}

This is for the Create Story form.

Return:
- a clear story title
- the most appropriate project
- a suitable assignee
- a realistic future due date
- an appropriate initial status
- an appropriate Fibonacci weight

Use real project and member data from the available tools.
Do not create anything in the database.
Only propose the story so the form can be auto-filled.`,
    });
  };

  const onSubmit = (values: z.infer<typeof createTaskSchema>) => {
    mutate({ json: { ...values, workspaceId } }, {
      onSuccess: () => {
        form.reset();
        onCancel?.();
      }
    });
  };

  const currentWeight = form.watch("weight");
  const selectedWeightObj = FIBONACCI_WEIGHTS.find(w => w.value === currentWeight);

  return (
    <Card className="w-full h-full border-none shadow-none rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50">
      <CardHeader className="flex p-7 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-semibold">
              Create new story
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5">
              Turn an idea into a clear, actionable story.
            </p>
          </div>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-7 pt-0 flex flex-col gap-y-8">
        {/* AI Assistant Section */}
        <section className="bg-white dark:bg-neutral-950 p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="font-medium text-sm">Generate with AI</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Describe what you want to build.</p>

          <div className="flex flex-col gap-3">
            <Textarea
              placeholder="e.g. Build driver registration with OTP and document verification"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={isGenerating}
              className="min-h-[100px] resize-none border-neutral-200 dark:border-neutral-800 focus-visible:ring-1"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !aiPrompt}
                variant="secondary"
                size="sm"
                className="gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-900/50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isGenerating ? "Generating..." : "Auto-fill"}
              </Button>
            </div>
          </div>
        </section>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-y-8">
            {/* Story Information Section */}
            <section>
              <h3 className="font-medium text-sm mb-1.5">Story information</h3>
              <p className="text-xs text-muted-foreground mb-5">Define what this story is about.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-neutral-950 p-5 rounded-xl border shadow-sm">
                <div className="md:col-span-1 flex flex-col gap-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Story Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter story name"
                            className="text-base h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Due Date
                        </FormLabel>
                        <FormControl>
                          <DatePicker {...field} className="w-full h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Status
                        </FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <FormMessage />
                          <SelectContent>
                            <SelectItem value={TaskStatus.BACKLOG}>Backlog</SelectItem>
                            <SelectItem value={TaskStatus.TODO}>Todo</SelectItem>
                            <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                            <SelectItem value={TaskStatus.IN_REVIEW}>In Review</SelectItem>
                            <SelectItem value={TaskStatus.DONE}>Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="md:col-span-1 flex flex-col gap-y-4">
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Project
                        </FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                          </FormControl>
                          <FormMessage />
                          <SelectContent>
                            {projectOptions.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                <div className="flex items-center gap-x-2">
                                  <ProjectAvatar
                                    className="size-6"
                                    name={project.name}
                                    image={project.imageUrl}
                                  />
                                  {project.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Assignee
                        </FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select assignee" />
                            </SelectTrigger>
                          </FormControl>
                          <FormMessage />
                          <SelectContent>
                            {memberOptions.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                <div className="flex items-center gap-x-2">
                                  <MemberAvatar
                                    className="size-6"
                                    name={member.name}
                                  />
                                  <div className="flex items-center gap-x-1.5">
                                    <span>{member.name}</span>
                                    {member.designation && (
                                      <span className="text-xs text-muted-foreground font-normal">
                                        ({member.designation})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </section>

            {/* Planning Section */}
            <section>
              <h3 className="font-medium text-sm mb-1.5">Planning</h3>
              <p className="text-xs text-muted-foreground mb-5">Estimate the size and complexity of this story.</p>

              <div className="bg-white dark:bg-neutral-950 p-5 rounded-xl border shadow-sm">
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3 block">
                        Weight
                      </FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap gap-2">
                            {FIBONACCI_WEIGHTS.map(({ value }) => {
                              const isSelected = field.value === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => field.onChange(isSelected ? undefined : value)}
                                  className={cn(
                                    "flex items-center justify-center w-12 h-10 rounded-lg text-sm font-medium transition-colors border",
                                    isSelected
                                      ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                                      : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900 dark:bg-neutral-950 dark:text-neutral-400 dark:border-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                                  )}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>

                          <div className="h-5">
                            {selectedWeightObj && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{selectedWeightObj.value}</span>
                                <span className="mx-2">·</span>
                                {selectedWeightObj.label}
                              </p>
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <div className="pt-2">
              <DottedSeparator className="mb-6" />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {/* Optional small validation/help text could go here */}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isPending}
                    className={cn("bg-white dark:bg-neutral-950", !onCancel && "hidden")}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={isPending}
                    type="submit"
                  >
                    Create story
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
