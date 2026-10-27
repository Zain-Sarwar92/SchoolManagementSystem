import { BookOpen, LayoutDashboard, Library } from "lucide-react";

export const superAdminNavItems = [
  { to: "/super-admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/super-admin/curriculum", label: "Curriculum", icon: BookOpen },
  { to: "/super-admin/question-bank", label: "Question Bank", icon: Library },
];
