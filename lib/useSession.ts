"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { deriveAuthPhase, type AuthPhase } from "@/lib/state";
import type { Session } from "@supabase/supabase-js";

export function useSession(): { session: Session | null; loading: boolean; phase: AuthPhase } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let generation = 0;

    const sessionGen = ++generation;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted || sessionGen !== generation) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      generation += 1;
      if (!mounted) return;
      setSession(next);
      setLoading(false);
    });

    return () => {
      mounted = false;
      generation += 1;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading, phase: deriveAuthPhase(loading, !!session) };
}