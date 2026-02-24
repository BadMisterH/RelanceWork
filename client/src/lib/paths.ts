const BASE_URL = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

function withBase(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${normalized}`;
}

export function authUrl(): string {
  return withBase("/auth.html");
}

export function appRootUrl(): string {
  return BASE_URL ? `${BASE_URL}/` : "/";
}
