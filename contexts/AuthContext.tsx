import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";

const TOKEN_KEY = "beyond_hoa_token";

export interface AuthResident {
  id: number;
  name: string;
  unit: string;
  email: string | null;
  phone: string | null;
  status: "owner" | "tenant";
  move_in_date: string | null;
  notes: string | null;
  created_at: string;
}

interface AuthContextType {
  resident: AuthResident | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshResident: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  resident: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refreshResident: async () => {},
});

function apiUrl(path: string) {
  return new URL(path, getApiUrl()).toString();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [resident, setResident] = useState<AuthResident | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      if (!stored) { setIsLoading(false); return; }
      const res = await fetch(apiUrl("/api/auth/me"), {
        headers: { Authorization: `Bearer ${stored}` },
      });
      if (!res.ok) {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setToken(stored);
      setResident(data.resident);
    } catch {
      // Network error — keep user logged out
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setResident(data.resident);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setResident(null);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const refreshResident = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResident(data.resident);
      }
    } catch {}
  }, [token]);

  return (
    <AuthContext.Provider value={{ resident, token, isLoading, login, logout, refreshResident }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
