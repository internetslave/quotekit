const ACCESS_STORAGE_KEY = "reading-made-fun:access-code";

export function rememberAccessCodeFromUrl(): void {
  if (typeof window === "undefined") {
    return;
  }

  const accessCode = new URLSearchParams(window.location.search).get("access");

  if (accessCode) {
    window.localStorage.setItem(ACCESS_STORAGE_KEY, accessCode);
    return;
  }

  const cookieAccessCode = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("rmf_access_client="))
    ?.slice("rmf_access_client=".length);

  if (cookieAccessCode) {
    window.localStorage.setItem(ACCESS_STORAGE_KEY, decodeURIComponent(cookieAccessCode));
  }
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(withAccessCode(path), {
    ...init,
    credentials: "same-origin"
  });
}

function withAccessCode(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  const storedAccessCode = window.localStorage.getItem(ACCESS_STORAGE_KEY);

  if (!storedAccessCode) {
    return path;
  }

  const url = new URL(path, window.location.origin);
  url.searchParams.set("access", storedAccessCode);
  return `${url.pathname}${url.search}${url.hash}`;
}
