import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  error: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const currentUserId = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    const timer = setTimeout(() => {
      if (!active || authEventReceived) return;
      setError(new Error("Your session check took too long. Please refresh or sign in again."));
      setLoading(false);
    }, 15000);
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      authEventReceived = true;
      clearTimeout(timer);
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== currentUserId.current) {
        queryClient.clear();
        currentUserId.current = nextUserId;
      }
      setSession(nextSession);
      setError(null);
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authEventReceived) return;
        clearTimeout(timer);
        if (sessionError) throw sessionError;
        setSession(data.session);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (!active || authEventReceived) return;
        clearTimeout(timer);
        setError(new Error("We could not check your session. Please refresh or sign in again."));
        setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      error,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
