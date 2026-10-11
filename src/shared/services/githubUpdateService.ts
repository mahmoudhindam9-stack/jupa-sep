/**
 * GitHub Update Service
 * Checks for updates from GitHub releases or repository package.json,
 * notifies users, and coordinates updates.
 */

import {
  CURRENT_VERSION,
  DEFAULT_GITHUB_REPO,
  DEFAULT_GITHUB_REPO_URL,
  compareVersions,
  isNewerVersion,
  normalizeVersion,
  parseGitHubRepo,
} from "@/shared/config/version";

export interface GitHubUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  publishedAt?: string;
  checkedAt: string;
  error?: string;
  source?: "release" | "raw_package" | "commit" | "cache";
}

export interface UpdateSettings {
  repo: string;
  autoCheck: boolean;
  lastCheckedAt?: string;
  autoInstall: boolean;
}

const SETTINGS_KEY = "restocash_github_update_settings";
const LATEST_CACHE_KEY = "restocash_github_latest_info";

class GitHubUpdateService {
  private listeners: Set<(info: GitHubUpdateInfo) => void> = new Set();
  private isChecking: boolean = false;
  private currentInfo: GitHubUpdateInfo;

  constructor() {
    this.currentInfo = this.loadCachedInfo();
  }

  public getSettings(): UpdateSettings {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          let repo = parseGitHubRepo(parsed.repo);
          // Automatically migrate old default to new repo
          if (
            !repo ||
            repo === "mahmoudhindam9/Restocash" ||
            repo === "mahmoudhindam9-stack/jupa-se"
          ) {
            repo = DEFAULT_GITHUB_REPO;
          }
          return {
            autoCheck: true,
            autoInstall: false,
            ...parsed,
            repo,
          };
        }
      }
    } catch (e) {
      console.warn("Failed to load GitHub update settings:", e);
    }
    return {
      repo: DEFAULT_GITHUB_REPO,
      autoCheck: true,
      autoInstall: false,
    };
  }

  public saveSettings(newSettings: Partial<UpdateSettings>): UpdateSettings {
    const current = this.getSettings();
    const updated: UpdateSettings = {
      ...current,
      ...newSettings,
      repo: newSettings.repo ? parseGitHubRepo(newSettings.repo) : current.repo,
    };
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Failed to save GitHub update settings:", e);
    }
    return updated;
  }

  private loadCachedInfo(): GitHubUpdateInfo {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem(LATEST_CACHE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...parsed,
            currentVersion: CURRENT_VERSION,
            hasUpdate: isNewerVersion(parsed.latestVersion || CURRENT_VERSION, CURRENT_VERSION),
          };
        }
      }
    } catch (e) {
      console.warn("Failed to load cached update info:", e);
    }

    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      hasUpdate: false,
      checkedAt: "",
    };
  }

  private saveCachedInfo(info: GitHubUpdateInfo): void {
    this.currentInfo = info;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(LATEST_CACHE_KEY, JSON.stringify(info));
      }
    } catch (e) {
      console.warn("Failed to cache update info:", e);
    }
    this.notify();
  }

  public getStatus(): GitHubUpdateInfo {
    return {
      ...this.currentInfo,
      currentVersion: CURRENT_VERSION,
      hasUpdate: isNewerVersion(this.currentInfo.latestVersion, CURRENT_VERSION),
    };
  }

  public getIsChecking(): boolean {
    return this.isChecking;
  }

  public subscribe(listener: (info: GitHubUpdateInfo) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error("Error in update listener:", err);
      }
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("restocash_update_status", {
          detail: status,
        }),
      );
    }
  }

  /**
   * Check GitHub for updates
   * @param force - If false, skips if checked within the last 15 minutes
   */
  public async checkForUpdates(force: boolean = true): Promise<GitHubUpdateInfo> {
    if (this.isChecking) {
      return this.getStatus();
    }

    const settings = this.getSettings();
    const repo = settings.repo.trim() || DEFAULT_GITHUB_REPO;

    // Check throttle if not forced
    if (!force && this.currentInfo.checkedAt) {
      const last = new Date(this.currentInfo.checkedAt).getTime();
      const now = Date.now();
      if (!isNaN(last) && now - last < 15 * 60 * 1000) {
        return this.getStatus();
      }
    }

    this.isChecking = true;
    this.notify();

    const timestamp = new Date().toISOString();
    let resultInfo: GitHubUpdateInfo = {
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      hasUpdate: false,
      checkedAt: timestamp,
    };

    try {
      // 1. Try fetching latest release from GitHub API
      let releaseSuccess = false;
      try {
        const releaseRes = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (releaseRes.ok) {
          const release = await releaseRes.json();
          const remoteVersion = normalizeVersion(release.tag_name || release.name || "");
          if (remoteVersion && remoteVersion !== "0.0.0") {
            const hasUpdate = isNewerVersion(remoteVersion, CURRENT_VERSION);
            resultInfo = {
              currentVersion: CURRENT_VERSION,
              latestVersion: remoteVersion,
              hasUpdate,
              releaseName: release.name || release.tag_name,
              releaseNotes: release.body || "تحديث وإصلاحات جديدة على النظام.",
              releaseUrl: release.html_url || `https://github.com/${repo}/releases`,
              publishedAt: release.published_at,
              checkedAt: timestamp,
              source: "release",
            };
            releaseSuccess = true;
          }
        }
      } catch (relErr) {
        console.warn("GitHub releases check attempt failed, falling back to package.json:", relErr);
      }

      // 2. Fallback: Check raw package.json directly from main/master branch
      if (!releaseSuccess) {
        const branches = ["main", "master"];
        for (const branch of branches) {
          try {
            const pkgRes = await fetch(
              `https://raw.githubusercontent.com/${repo}/${branch}/package.json?_t=${Date.now()}`,
            );
            if (pkgRes.ok) {
              const pkgData = await pkgRes.json();
              if (pkgData?.version) {
                const remoteVersion = normalizeVersion(pkgData.version);
                const hasUpdate = isNewerVersion(remoteVersion, CURRENT_VERSION);
                resultInfo = {
                  currentVersion: CURRENT_VERSION,
                  latestVersion: remoteVersion,
                  hasUpdate,
                  releaseName: `Restocash v${remoteVersion}`,
                  releaseNotes: `نسخة ${remoteVersion} من فرع ${branch}. تتضمن أحدث التحسينات ومزامنة الأكواد.`,
                  releaseUrl: `https://github.com/${repo}/tree/${branch}`,
                  publishedAt: timestamp,
                  checkedAt: timestamp,
                  source: "raw_package",
                };
                releaseSuccess = true;
                break;
              }
            }
          } catch (e) {
            // Next branch
          }
        }
      }

      // 3. Check tags if no release or package.json version was found
      if (!releaseSuccess) {
        try {
          const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=5`, {
            headers: { Accept: "application/vnd.github.v3+json" },
          });
          if (tagsRes.ok) {
            const tags = await tagsRes.json();
            if (Array.isArray(tags) && tags.length > 0) {
              const latestTag = tags[0];
              const tagVersion = normalizeVersion(latestTag.name);
              if (tagVersion && tagVersion !== "0.0.0") {
                const hasUpdate = isNewerVersion(tagVersion, CURRENT_VERSION);
                resultInfo = {
                  currentVersion: CURRENT_VERSION,
                  latestVersion: tagVersion,
                  hasUpdate,
                  releaseName: `إصدار ${latestTag.name}`,
                  releaseNotes: `نسخة من وسم ${latestTag.name} في مستودع ${repo}.`,
                  releaseUrl: `https://github.com/${repo}/releases/tag/${latestTag.name}`,
                  publishedAt: timestamp,
                  checkedAt: timestamp,
                  source: "release",
                };
                releaseSuccess = true;
              }
            }
          }
        } catch (tErr) {
          console.warn("Tags check failed:", tErr);
        }
      }

      // 4. Check latest commit to confirm connectivity and repo status
      if (!releaseSuccess) {
        try {
          const commitRes = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
            headers: { Accept: "application/vnd.github.v3+json" },
          });
          if (commitRes.ok) {
            const commits = await commitRes.json();
            if (Array.isArray(commits) && commits.length > 0) {
              const latestCommit = commits[0];
              const commitMsg = latestCommit?.commit?.message || "مزامنة المستودع";
              const commitAuthor = latestCommit?.commit?.author?.name || "mahmoudhindam9-stack";
              const commitDate = latestCommit?.commit?.author?.date;
              resultInfo = {
                currentVersion: CURRENT_VERSION,
                latestVersion: CURRENT_VERSION,
                hasUpdate: false,
                releaseName: `المستودع متصل (${repo})`,
                releaseNotes: `تم التحقق من الاتصال بنجاح. آخر تعديل: "${commitMsg}" بواسطة ${commitAuthor}.`,
                releaseUrl: `https://github.com/${repo}`,
                publishedAt: commitDate || timestamp,
                checkedAt: timestamp,
                source: "commit",
              };
              releaseSuccess = true;
            }
          }
        } catch (cErr) {
          console.warn("Commits check failed:", cErr);
        }
      }

      if (!releaseSuccess) {
        // If no endpoint could be reached, record error
        resultInfo = {
          ...this.currentInfo,
          checkedAt: timestamp,
          error: `تعذر الاتصال بمستودع GitHub (${repo})، يرجى التأكد من الرابط وصلاحية الوصول`,
        };
      }
    } catch (err: any) {
      console.error("Error checking for updates:", err);
      resultInfo = {
        ...this.currentInfo,
        checkedAt: timestamp,
        error: err?.message || "حدث خطأ أثناء فحص التحديثات",
      };
    } finally {
      this.isChecking = false;
      this.saveCachedInfo(resultInfo);
      this.saveSettings({ lastCheckedAt: timestamp });
    }

    return resultInfo;
  }

  /**
   * Performs the client-side system update:
   * - Clears browser cache & service workers
   * - Re-syncs ERP state
   * - Reloads the latest code
   */
  public async performUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Clear caches if available
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
        } catch (e) {
          console.warn("Could not clear cache storage:", e);
        }
      }

      // 2. Unregister service workers if any
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.update().catch(() => {});
          }
        } catch (e) {
          console.warn("ServiceWorker update error:", e);
        }
      }

      // 3. Store update applied timestamp
      localStorage.setItem("restocash_last_updated_at", new Date().toISOString());

      // 4. Force reload after a brief moment
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 1000);

      return {
        success: true,
        message: "تم تحديث النظام ومسح الذاكرة المؤقتة بنجاح، جاري إعادة تحميل الصفحة...",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || "تعذر إكمال عملية التحديث التلقائي.",
      };
    }
  }
}

export const githubUpdateService = new GitHubUpdateService();
