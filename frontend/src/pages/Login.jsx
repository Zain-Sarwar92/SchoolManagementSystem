import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, School } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { toast } from "../components/ui/toast.jsx";

function Login() {
  const { login, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const homeFor = (role) => {
    if (role === "super_admin") return "/super-admin";
    if (role === "sub_account") return "/academy/generator";
    if (role === "teacher") return "/teacher";
    return "/academy";
  };

  if (!loading && isAuthenticated) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const loggedInUser = await login(email.trim(), password);
      toast.success(`Welcome back, ${loggedInUser.name}`);
      navigate(homeFor(loggedInUser.role));
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center p-3 sm:p-4">
      <section className="w-full max-w-md rounded-2xl border border-rose/50 bg-white/90 p-5 shadow-[0_18px_40px_rgb(31_34_50_/0.12)] backdrop-blur-md sm:rounded-3xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-navy text-blush">
            <School className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-xl text-navy">Paper PRO</p>
            <p className="text-sm text-slate">Sign in to your academy workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-navy">
              Email <span className="text-[#a33b4a]">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-rose/60 bg-bg-soft px-4 py-3 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
              placeholder="admin@academy.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-navy">
              Password <span className="text-[#a33b4a]">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-rose/60 bg-bg-soft px-4 py-3 pr-12 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-slate transition hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-lavender"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full cursor-pointer rounded-2xl bg-navy px-4 py-3 font-semibold text-blush transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;
