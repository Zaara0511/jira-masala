"use client";

import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_DESIGNATIONS } from "../constants";
import { useUpdateMember } from "../api/use-update-member";

interface EditDesignationModalProps {
  member: {
    $id: string;
    name: string;
    designation?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditDesignationModal = ({
  member,
  open,
  onOpenChange,
}: EditDesignationModalProps) => {
  const { mutate: updateMember, isPending } = useUpdateMember();

  const [selectedOption, setSelectedOption] = useState<string>("none");
  const [customValue, setCustomValue] = useState<string>("");

  useEffect(() => {
    if (member) {
      const current = member.designation?.trim();
      if (!current) {
        setSelectedOption("none");
        setCustomValue("");
      } else if (DEFAULT_DESIGNATIONS.includes(current as (typeof DEFAULT_DESIGNATIONS)[number])) {
        setSelectedOption(current);
        setCustomValue("");
      } else {
        setSelectedOption("custom");
        setCustomValue(current);
      }
    }
  }, [member, open]);

  const handleSave = () => {
    if (!member) return;

    let finalDesignation: string | null = null;
    if (selectedOption === "custom") {
      finalDesignation = customValue.trim();
    } else if (selectedOption !== "none") {
      finalDesignation = selectedOption;
    }

    updateMember(
      {
        param: { memberId: member.$id },
        json: { designation: finalDesignation },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <Card className="w-full h-full border-none shadow-none">
        <CardHeader className="p-7">
          <CardTitle className="text-xl font-bold">
            Change Designation
          </CardTitle>
          <CardDescription>
            Assign or update the role for {member?.name} in this workspace.
          </CardDescription>
        </CardHeader>
        <div className="px-7">
          <DottedSeparator />
        </div>
        <CardContent className="p-7 space-y-4">
          <div className="space-y-2">
            <Label>Designation</Label>
            <Select
              disabled={isPending}
              value={selectedOption}
              onValueChange={setSelectedOption}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Unassigned)</SelectItem>
                {DEFAULT_DESIGNATIONS.map((designation) => (
                  <SelectItem key={designation} value={designation}>
                    {designation}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Other (Custom title)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedOption === "custom" && (
            <div className="space-y-2">
              <Label>Custom Designation Title</Label>
              <Input
                disabled={isPending}
                placeholder="e.g. Lead Architect, QA Specialist"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                isPending ||
                (selectedOption === "custom" && !customValue.trim())
              }
            >
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </ResponsiveModal>
  );
};
