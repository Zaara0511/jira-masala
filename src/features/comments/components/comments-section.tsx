"use client";

import { useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send, Edit2, Trash2 } from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useTaskId } from "@/features/tasks/hooks/use-task-id";
import { useGetComments } from "../api/use-get-comments";
import { useCreateComment } from "../api/use-create-comment";
import { useUpdateComment } from "../api/use-update-comment";
import { useDeleteComment } from "../api/use-delete-comment";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { Comment } from "../types";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DottedSeparator } from "@/components/dotted-separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CommentsSectionProps {
  projectId?: string;
}

export const CommentsSection = ({}: CommentsSectionProps) => {
  const workspaceId = useWorkspaceId();
  const taskId = useTaskId();

  const { data: comments, isLoading } = useGetComments({ taskId });
  const { data: members } = useGetMembers({ workspaceId });

  const { mutate: createComment, isPending: isCreating } = useCreateComment();
  const { mutate: updateComment, isPending: isUpdating } = useUpdateComment();
  const { mutate: deleteComment, isPending: isDeleting } = useDeleteComment();

  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtPos = textBeforeCursor.lastIndexOf("@");

    if (lastAtPos !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtPos + 1);
      if (!/\s/.test(textAfterAt)) {
        setMentionQuery(textAfterAt);
        setMentionIndex(lastAtPos);
        return;
      }
    }
    setMentionQuery(null);
  };

  const filteredMembers = mentionQuery !== null && members?.documents
    ? members.documents.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const handleSelectMention = (memberName: string) => {
    if (mentionIndex !== -1) {
      const textBeforeAt = content.slice(0, mentionIndex);
      const textAfterCursor = content.slice(textareaRef.current?.selectionStart || content.length);
      const newContent = `${textBeforeAt}@${memberName} ${textAfterCursor}`;
      setContent(newContent);
      setMentionQuery(null);
      setMentionIndex(-1);
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createComment(
      {
        json: {
          taskId,
          content: content.trim(),
        },
      },
      {
        onSuccess: () => {
          setContent("");
          setMentionQuery(null);
        },
      }
    );
  };

  const handleEdit = (commentId: string, currentContent: string) => {
    setEditingId(commentId);
    setEditContent(currentContent);
  };

  const handleUpdate = (commentId: string) => {
    if (!editContent.trim()) return;

    updateComment(
      {
        param: { commentId },
        json: { content: editContent.trim() },
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditContent("");
        },
      }
    );
  };

  const handleDelete = (commentId: string) => {
    if (confirm("Are you sure you want to delete this comment?")) {
      deleteComment({ param: { commentId } });
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full h-full border-none shadow-none mt-4 lg:col-span-2">
        <CardHeader className="flex flex-row items-center gap-x-4 p-7 space-y-0">
          <CardTitle>Discussions</CardTitle>
        </CardHeader>
        <CardContent className="p-7 pt-0">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-neutral-200 rounded w-full" />
            <div className="h-10 bg-neutral-200 rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full border-none shadow-none mt-4 lg:col-span-2 relative overflow-visible">
      <CardHeader className="flex flex-row items-center gap-x-4 p-7 space-y-0">
        <CardTitle>Discussions</CardTitle>
      </CardHeader>
      <div className="px-7">
        <DottedSeparator />
      </div>
      <CardContent className="p-7 space-y-6">
        <form onSubmit={handleSubmit} className="flex gap-x-4 items-start relative">
          <div className="flex-1 space-y-2 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Write a comment... (use @ to mention)"
              value={content}
              onChange={handleContentChange}
              className="min-h-[80px] resize-y"
              disabled={isCreating}
            />
            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-md shadow-lg z-50 overflow-hidden">
                {filteredMembers.map((member) => (
                  <div
                    key={member.$id}
                    className="px-3 py-2 text-sm hover:bg-neutral-100 cursor-pointer flex items-center gap-x-2"
                    onClick={() => handleSelectMention(member.name)}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] bg-neutral-200">
                        {member.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-neutral-700">{member.name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button disabled={!content.trim() || isCreating} size="sm">
                {isCreating ? "Posting..." : "Comment"}
                <Send className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-4 mt-6">
          {comments?.documents?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Start the conversation!
            </p>
          ) : (
            comments?.documents?.map((comment: Comment) => (
              <div key={comment.$id} className="flex gap-x-4">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-blue-600 text-white font-semibold">
                    {comment.authorName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-x-2">
                    <p className="text-sm font-medium">{comment.authorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.$createdAt), { addSuffix: true })}
                      {comment.isEdited && " (edited)"}
                    </p>
                  </div>

                  {editingId === comment.$id ? (
                    <div className="space-y-2 mt-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[60px]"
                        disabled={isUpdating}
                      />
                      <div className="flex gap-x-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          disabled={isUpdating}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(comment.$id)}
                          disabled={!editContent.trim() || isUpdating}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-neutral-800 whitespace-pre-wrap group relative bg-neutral-50 p-3 rounded-lg border">
                      {comment.content.split(/(@\w+\s?\w*)/g).map((part: string, i: number) =>
                        part.startsWith('@') ? <span key={i} className="text-blue-600 font-semibold">{part}</span> : part
                      )}
                      {/* Actions hover */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center bg-white shadow-sm border rounded-md">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(comment.$id, comment.content)}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(comment.$id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
