import { create, isAxiosError, type AxiosRequestConfig } from "axios";
import {loadToken} from "@/lib/tokenStorage";

// One shared axios instance for the app's backend.
const client = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

// ---------- Auth token ----------

// Kept in memory; the auth layer sets it after login and clears it on sign-out.
// let authToken: string | null = null;

// export function setAuthToken(token: string | null) {
//   authToken = token;
// }

client.interceptors.request.use((config) => {
  let authToken = loadToken();
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

// ---------- Errors ----------

// Every failed request is turned into an ApiError, so screens only handle one shape.
export class ApiError extends Error {
  /** HTTP status, or 0 when the server couldn't be reached. */
  readonly status: number;
  /** Response body, if the server sent one. */
  readonly data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

function toApiError(error: unknown): ApiError {
  if (!isAxiosError(error)) {
    return new ApiError("Something went wrong.", -1);
  }

  if (!error.response) {
    const message =
      error.code === "ECONNABORTED"
        ? "The server took too long to respond."
        : "Can't reach the server. Check your connection.";
    return new ApiError(message, 0);
  }

  const { status, data } = error.response;
  return new ApiError((messageFor(status, data) || "An error occurred"), status, data);
}

function messageFor(status: number, data: unknown): string {
  // Prefer a message from the server: a plain-text body (what the Axum
  // extractors send) or JSON like { message: "..." }.
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }

  switch (status) {
    case 400:
      return "Some of the details you sent aren't valid.";
    case 401:
      return "You need to log in again.";
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 409:
      return "That already exists.";
    case 429:
      return "Too many attempts. Try again in a moment.";
    default:
      return status >= 500
        ? "The server had a problem. Try again later."
        : `Request failed (${status}).`;
  }
}

// ---------- Request helpers ----------

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.request<T>(config);
    return res.data;
  } catch (error) {
    throw toApiError(error);
  }
}


// Typed helpers that return the response body directly, e.g.
//   const people = await api.get<Person[]>("/nearby");
//   await api.post("/login", { email, password });
export const api = {
  get: <T = void>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "GET", url }),

  post: <T = void>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "POST", url, data: body }),

  put: <T = void>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "PUT", url, data: body }),

  patch: <T = void>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "PATCH", url, data: body }),

  delete: <T = void>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "DELETE", url }),
};
