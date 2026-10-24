import { useMemo } from "react";
import { academyNavItems, teacherNavItems } from "../constants/academyNav.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  filterAcademyNavItems,
  filterTeacherNavItems,
} from "../utils/academyModules.js";

export function useAcademyNav() {
  const { user } = useAuth();
  return useMemo(
    () => filterAcademyNavItems(academyNavItems, user?.academy),
    [user?.academy]
  );
}

export function useTeacherNav() {
  const { user } = useAuth();
  return useMemo(
    () => filterTeacherNavItems(teacherNavItems, user?.academy),
    [user?.academy]
  );
}
