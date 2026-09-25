export const DEFAULT_DESIGNATIONS = [
  "UI/UX Designer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "QA / Tester",
  "Scrum Master",
  "Product Owner",
  "DevOps Engineer",
] as const;

export type DesignationType = (typeof DEFAULT_DESIGNATIONS)[number];
