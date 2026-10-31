"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseEnabled } from "@/lib/supabase/client";

type AuthState = {
  /** false = no Supabase keys, app runs in guest mode */
  enabled: boolean;
  loading: boolean;
  user: User | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  enabled: false,
  loading: false,
  user: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    // getSession also completes the OAuth / magic-link redirect (?code=...)
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ enabled: supabaseEnabled, loading, user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
