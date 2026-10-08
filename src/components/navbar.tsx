"use client";

import { usePathname } from "next/navigation";

import { UserButton } from "@/features/auth/components/user-button";

import { MobileSidebar } from "./mobile-sidebar";

import { GlobalSearch } from "@/features/search/components/global-search";
import { NotificationDropdown } from "@/features/notifications/components/notification-dropdown";

const pathnameMap = {
  "tasks": {
    title: "My Stories",
    description: "View all of your stories here",
  },
  "projects": {
    title: "My Project",
    description: "View stories of your project here"
  },
};

const defaultMap = {
  title: "Home",
  description: "Monitor all of your projects and stories here",
};

export const Navbar = () => {
  const pathname = usePathname();
  const pathnameParts = pathname.split("/");
  const pathnameKey = pathnameParts[3] as keyof typeof pathnameMap;

  const { title, description } = pathnameMap[pathnameKey] || defaultMap;

  return (
    <nav className="pt-4 px-6 flex items-center justify-between">
      <div className="flex-col hidden lg:flex">
        <h1 className="text-2xl font-semibold">
          {title}
        </h1>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>
      <MobileSidebar />
      <div className="flex items-center gap-x-4">
        <GlobalSearch />
        <NotificationDropdown />
        <UserButton />
      </div>
    </nav>
  );
};
