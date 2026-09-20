import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { AdminUser } from "../lib/types";

type AuthState = {
  user: AdminUser | null;
  loading: boolean;
  googleEnabled: boolean;
  allowDevLogin: boolean;
  refresh: () => Promise<void>;
  devLogin: (email: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [allowDevLogin, setAllowDevLogin] = useState(false);

  const refresh = async () => {
    const data = await api<{
      user: AdminUser | null;
      googleEnabled: boolean;
      allowDevLogin: boolean;
    }>("/api/auth/me");
    setUser(data.user);
    setGoogleEnabled(data.googleEnabled);
    setAllowDevLogin(data.allowDevLogin);
  };

  useEffect(() => {
    refresh()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const devLogin = async (email: string) => {
    const data = await api<{ user: AdminUser }>("/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, googleEnabled, allowDevLogin, refresh, devLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth");
  return ctx;
}
