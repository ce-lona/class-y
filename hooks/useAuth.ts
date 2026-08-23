import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

export function useAuthListener() {
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUserId = useAuthStore.getState().session?.user?.id;
      const newUserId = session?.user?.id;

      // Cache leert sich beim Nutzerwechsel/Logout, damit keine Daten
      // zwischen Accounts durchsickern.
      if (currentUserId !== newUserId) {
        queryClient.clear();
      }

      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, queryClient]);
}
