import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { isPlatformAdmin } from "@/lib/roles";

export function useIsPlatformAdmin() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: ["is-platform-admin", userId],
    queryFn: () => isPlatformAdmin(userId!),
    enabled: !!userId,
  });
}
