import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiClient, ApiError } from "./apiClient";

export { apiClient, ApiError };

export interface FetchOptions {
  on401?: "returnNull" | "throw";
  on403?: "throw" | "throwWithMessage";
}

export async function fetchWithAuth<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T | null> {
  return apiClient.get<T>(url, options);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const body = await res.json();
      if (body.message) {
        errorMessage = body.message;
      }
    } catch {
    }
    throw new Error(`${res.status}: ${errorMessage}`);
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  return async ({ queryKey }) => {
    const result = await apiClient.get<T>(queryKey[0] as string, {
      on401: options.on401,
    });
    return result as T;
  };
}

export async function fetchApi<T>(url: string): Promise<T> {
  const result = await apiClient.get<T>(url);
  return result as T;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
