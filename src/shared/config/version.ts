/**
 * Restocash System Version & Configuration
 * Provides single source of truth for app version and GitHub repo metadata
 */

export const CURRENT_VERSION = "1.3.0";
export const APP_RELEASE_NAME = "Restocash ERP v1.3.0";
export const BUILD_DATE = "2026-10-04";
export const DEFAULT_GITHUB_REPO = "mahmoudhindam9-stack/jupa-sep";
export const DEFAULT_GITHUB_REPO_URL = "https://github.com/mahmoudhindam9-stack/jupa-sep.git";

/**
 * Normalizes version strings by trimming and stripping leading 'v'
 * e.g., "v1.2.1" -> "1.2.1"
 */
export function normalizeVersion(v: string | undefined | null): string {
  if (!v) return "0.0.0";
  return v.trim().replace(/^[vV]/, "").split("-")[0];
}

/**
 * Parses user input which can be a full GitHub clone URL or owner/repo format
 * e.g.:
 *  "https://github.com/mahmoudhindam9-stack/jupa-se.git" -> "mahmoudhindam9-stack/jupa-se"
 *  "github.com/mahmoudhindam9-stack/jupa-se" -> "mahmoudhindam9-stack/jupa-se"
 *  "mahmoudhindam9-stack/jupa-se" -> "mahmoudhindam9-stack/jupa-se"
 */
export function parseGitHubRepo(input: string | undefined | null): string {
  if (!input) return DEFAULT_GITHUB_REPO;
  let trimmed = input.trim();
  trimmed = trimmed.replace(/\.git$/i, "");
  trimmed = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "");
  trimmed = trimmed.replace(/^git@github\.com:/i, "");
  trimmed = trimmed.replace(/^\/+|\/+$/g, "");
  return trimmed || DEFAULT_GITHUB_REPO;
}

/**
 * Compares two semantic version strings
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v2 is newer)
 *   0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const norm1 = normalizeVersion(v1);
  const norm2 = normalizeVersion(v2);

  const parts1 = norm1.split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = norm2.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Checks whether remote version is strictly newer than current version
 */
export function isNewerVersion(remoteVersion: string, current: string = CURRENT_VERSION): boolean {
  return compareVersions(remoteVersion, current) > 0;
}
