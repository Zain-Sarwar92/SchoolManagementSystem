import {
  GraduationCap,
  Layers,
  LayoutDashboard,
  Users,
  CircleDollarSign,
  ClipboardList,
  CalendarClock,
  UserCog,
  FilePlus2,
  Files,
  Activity,
  UsersRound,
} from "lucide-react";

export const academyNavItems = [
  { to: "/academy", label: "Dashboard", icon: LayoutDashboard, end: true },
  // Academy Management
  { to: "/academy/classes", label: "Classes", icon: GraduationCap, end: false },
  { to: "/academy/sections", label: "Sections", icon: Layers, end: false },
  { to: "/academy/teachers", label: "Teachers", icon: UserCog, end: false },
  { to: "/academy/schedules", label: "Schedules", icon: CalendarClock, end: false },
  { to: "/academy/students", label: "Students", icon: Users, end: false },
  { to: "/academy/fees", label: "Fees", icon: CircleDollarSign, end: false },
  { to: "/academy/results", label: "Results", icon: ClipboardList, end: false },
  // Test Generator (isolated product)
  { to: "/academy/generator", label: "Generate Paper", icon: FilePlus2, end: true },
  { to: "/academy/generator/papers", label: "Saved Papers", icon: Files, end: false },
  {
    to: "/academy/generator/sub-accounts",
    label: "Sub Accounts",
    icon: UsersRound,
    end: false,
  },
  {
    to: "/academy/generator/activities",
    label: "Account Activities",
    icon: Activity,
    end: false,
  },
];

export const teacherNavItems = [
  { to: "/teacher", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/teacher/schedules", label: "My tests", icon: CalendarClock, end: false },
  {
    to: "/academy/generator",
    label: "Generate Paper",
    icon: FilePlus2,
    end: true,
  },
  {
    to: "/academy/generator/papers",
    label: "Saved Papers",
    icon: Files,
    end: false,
  },
];
