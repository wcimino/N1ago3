import { useQuery } from "@tanstack/react-query";

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

async function fetchAuthUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (res.status === 401) {
    return null;
  }

  if (res.status === 403) {
    let message = "Acesso negado";
    try {
      const body = await res.json();
      if (body.message) {
        message = body.message;
      }
    } catch {
    }
    throw new Error(`403: ${message}`);
  }

  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export function useAuth(): AuthState {
  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchAuthUser,
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
