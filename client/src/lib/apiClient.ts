export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(`${status}: ${message}`);
    this.name = "ApiError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

async function getErrorMessage(res: Response): Promise<string> {
  let errorMessage = res.statusText;
  try {
    const body = await res.json();
    if (body.message) {
      errorMessage = body.message;
    } else if (body.error) {
      errorMessage = body.error;
    }
  } catch {
  }
  return errorMessage;
}

export interface RequestConfig {
  on401?: "returnNull" | "throw";
  on403?: "throw" | "throwWithMessage";
  on404?: "returnNull" | "throw";
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function handleResponse<T>(
  res: Response,
  config: RequestConfig = {}
): Promise<T | null> {
  const { on401 = "throw", on403 = "throw", on404 = "throw" } = config;

  if (res.status === 401 && on401 === "returnNull") {
    return null;
  }

  if (res.status === 404 && on404 === "returnNull") {
    return null;
  }

  if (!res.ok) {
    const message = await getErrorMessage(res);
    throw new ApiError(res.status, message);
  }

  const text = await res.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

export const apiClient = {
  async get<T>(url: string, config: RequestConfig = {}): Promise<T | null> {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: config.headers,
      signal: config.signal,
    });
    return handleResponse<T>(res, config);
  },

  async post<T>(url: string, data?: unknown, config: RequestConfig = {}): Promise<T | null> {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...config.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: config.signal,
    });
    return handleResponse<T>(res, config);
  },

  async put<T>(url: string, data?: unknown, config: RequestConfig = {}): Promise<T | null> {
    const res = await fetch(url, {
      method: "PUT",
      credentials: "include",
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...config.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: config.signal,
    });
    return handleResponse<T>(res, config);
  },

  async patch<T>(url: string, data?: unknown, config: RequestConfig = {}): Promise<T | null> {
    const res = await fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...config.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: config.signal,
    });
    return handleResponse<T>(res, config);
  },

  async delete<T>(url: string, config: RequestConfig = {}): Promise<T | null> {
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "include",
      headers: config.headers,
      signal: config.signal,
    });
    return handleResponse<T>(res, config);
  },
};

export type { ApiError as ApiErrorType };
