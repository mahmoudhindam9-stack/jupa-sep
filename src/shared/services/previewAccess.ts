/**
 * Unrestricted preview mode is deliberately limited to the ephemeral Google AI Studio
 * development preview. Never enable this bypass for production builds or other hosts.
 */
export function isAiStudioPreview(): boolean {
  if (typeof window === "undefined" || !import.meta.env.DEV) return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname.startsWith("ais-dev-") && hostname.endsWith(".run.app");
}
