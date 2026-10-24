import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { academyHasModule } from "../utils/academyModules.js";

/**
 * Blocks academy_admin / teacher pages when the academy product module is off.
 * @param {"ACADEMY_MANAGEMENT"|"TEST_GENERATOR"} module
 */
function ModuleRoute({ module, children }) {
  const { user } = useAuth();

  if (!academyHasModule(user?.academy, module)) {
    const fallback =
      user?.role === "sub_account"
        ? "/login"
        : user?.role === "teacher"
          ? "/teacher"
          : "/academy";
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export default ModuleRoute;
