import React, { useEffect, useMemo, useState } from "react";
import App from "../App";
import {
  AuthUser,
  login,
  logout,
  me,
  register,
} from "../services/authService";

const AuthGate: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [devBypass, setDevBypass] = useState(false);

  const isDev = useMemo(() => !!import.meta.env.DEV, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const current = await me();
        setUser(current);
      } catch {
        // no-op: unauthenticated on first load is expected
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const current =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password);
      setUser(current);
    } catch (err: any) {
      setError(err?.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center">
        <div className="text-sm text-slate-400">Checking session...</div>
      </div>
    );
  }

  if (user || devBypass) {
    return (
      <div className="relative">
        {!devBypass && user && (
          <button
            onClick={async () => {
              try {
                await logout();
              } finally {
                setUser(null);
              }
            }}
            className="fixed top-3 right-3 z-[100] text-xs bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg"
          >
            Sign Out
          </button>
        )}
        <App />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h1 className="text-xl font-bold text-white mb-1">Suno Architect Access</h1>
        <p className="text-xs text-slate-400 mb-5">
          Sign in to use protected generation and proxy endpoints.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-lg"
          >
            {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <button
          className="mt-3 text-xs text-slate-400 hover:text-white"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>

        {isDev && (
          <button
            className="mt-3 block text-xs text-yellow-300 hover:text-yellow-200"
            onClick={() => setDevBypass(true)}
          >
            Continue in local dev bypass mode
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthGate;
