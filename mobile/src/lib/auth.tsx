import {createContext, useContext, useState, type ReactNode, useEffect, useLayoutEffect} from "react";
import { api } from "@/lib/api";
import {clearToken, loadToken, saveToken} from "@/lib/tokenStorage";

type AuthContextValue = {
  isLoggedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type LoginResponse = { email: string; success: boolean, session: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  async function signIn(email: string, password: string) {
    const res = await api.post<LoginResponse>("/login", { email, password });
    // The server currently uses the email as the bearer token (see
    // server/src/extract/current_user.rs). Swap in a real token when it issues one.
    saveToken(res.session)
    setIsLoggedIn(true);
  }

  useLayoutEffect(() => {
    if (loadToken()){
      console.log("called")
      api
          .get<{
            email: string,
            display_name: string|null,
            avatar_url: string|null,
            onboarding_completed: boolean,
            onboarding_next_step: string|null
          }>("/me")
          .then((resp) => {
            setIsLoggedIn(true)
          })
          .catch((e) => console.warn("GET /me failed:", e.message));
    }
  }, []);

  const value: AuthContextValue = {
    isLoggedIn,
    signIn,
    signUp: async (email, password) => {
      await api.post("/signup", { email, password });
      // Log straight in so the user lands on Home after creating the account.
      await signIn(email, password);
    },
    signOut: () => {
      api.post("logout",{});
      clearToken();
      setIsLoggedIn(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
