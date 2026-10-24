import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-blush text-slate">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    const fallback =
      user.role === "super_admin"
        ? "/super-admin"
        : user.role === "sub_account"
          ? "/academy/generator"
          : user.role === "teacher"
            ? "/teacher"
            : "/academy";
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export default ProtectedRoute;
