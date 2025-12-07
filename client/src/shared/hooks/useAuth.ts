import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/queryClient";

interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isUnauthorized: boolean;
  unauthorizedMessage: string | null;
  error: Error | null;
}

export function useAuth(): AuthState {
  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: () => fetchWithAuth<AuthUser>("/api/auth/user", {
      on401: "returnNull",
      on403: "throwWithMessage",
    }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isUnauthorized = error instanceof Error && error.message.startsWith("403:");
  const unauthorizedMessage = isUnauthorized 
    ? error.message.replace(/^403:\s*/, "") 
    : null;

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    isUnauthorized,
    unauthorizedMessage,
    error: error instanceof Error ? error : null,
  };
}
