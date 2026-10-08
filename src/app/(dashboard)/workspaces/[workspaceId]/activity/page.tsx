import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";

import { ActivityClient } from "./client";

const ActivityPage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <ActivityClient />;
};

export default ActivityPage;
