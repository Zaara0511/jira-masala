import Image from "next/image";

import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface WorkspaceAvatarProps {
  image?: string;
  name: string;
  className?: string;
};

export const WorkspaceAvatar = ({
  image,
  name,
  className
}: WorkspaceAvatarProps) => {
  const hasValidImage =
    Boolean(image) &&
    typeof image === "string" &&
    !image.startsWith("[object ") &&
    (image.startsWith("data:") ||
      image.startsWith("http://") ||
      image.startsWith("https://") ||
      image.startsWith("/"));

  if (hasValidImage) {
    return (
      <div className={cn(
        "size-10 relative rounded-md overflow-hidden",
        className,
      )}>
        <Image src={image as string} alt={name} fill className="object-cover" />
      </div>
    );
  }

  return (
    <Avatar className={cn("size-10 rounded-md", className)}>
      <AvatarFallback className="text-white bg-blue-600 font-semibold text-lg uppercase rounded-md">
        {name[0]}
      </AvatarFallback>
    </Avatar>
  );
};
