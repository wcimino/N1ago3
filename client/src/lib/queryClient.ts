import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function getErrorMessage(res: Response): Promise<string> {
  let errorMessage = res.statusText;
  try {
    const body = await res.json();
    if (body.message) {
      errorMessage = body.message;
    }
  } catch {
  }
  return errorMessage;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const message = await getErrorMessage(res);
    throw new Error(`${res.status}: ${message}`);
  }
}

export interface FetchOptions {
  on401?: "returnNull" | "throw";
  on403?: "throw" | "throwWithMessage";
}

export async function fetchWithAuth<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T | null> {
  const { on401 = "throw", on403 = "throw" } = options;
  
  const res = await fetch(url, { credentials: "include" });

  if (res.status === 401 && on401 === "returnNull") {
    return null;
  }

  if (res.status === 403 && on403 === "throwWithMessage") {
    const message = await getErrorMessage(res);
    throw new Error(`403: ${message}`);
  }

  await throwIfResNotOk(res);
  return res.json();
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

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  await throwIfResNotOk(res);
  return res.json();
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
