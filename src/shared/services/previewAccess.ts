/**
 * Preview mode covers Google AI Studio preview containers (ais-dev-* and ais-pre-*)
 * as well as Lovable preview environments, while keeping production hosts strict.
 */
export function isAiStudioPreview(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  if (
    (hostname.startsWith("ais-dev-") || hostname.startsWith("ais-pre-")) &&
    hostname.endsWith(".run.app")
  ) {
    return true;
  }
  if (
    hostname.endsWith(".lovableproject.com") ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".webcontainer.io")
  ) {
    return true;
  }
  return false;
}

export function isHostedDeployment(mounted = true): boolean {
  if (typeof window === "undefined" || !mounted) return false;
  if (isAiStudioPreview()) return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
}

