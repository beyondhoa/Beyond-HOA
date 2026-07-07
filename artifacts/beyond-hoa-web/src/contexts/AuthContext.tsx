import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Resident } from "@workspace/api-client-react";

interface AuthContextValue {
  resident: Resident | null;
  token: string | null;
  login: (token: string, resident: Resident) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "hoa_token";
const RESIDENT_KEY = "hoa_resident";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [resident, setResident] = useState<Resident | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedResident = localStorage.getItem(RESIDENT_KEY);
    if (storedToken && storedResident) {
      try {
        setToken(storedToken);
        setResident(JSON.parse(storedResident));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(RESIDENT_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newResident: Resident) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(RESIDENT_KEY, JSON.stringify(newResident));
    setToken(newToken);
    setResident(newResident);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(RESIDENT_KEY);
    setToken(null);
    setResident(null);
  }, []);

  return (
    <AuthContext.Provider value={{ resident, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
