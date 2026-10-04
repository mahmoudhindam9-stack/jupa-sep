import "./lib/error-capture";
import { GoogleGenAI } from "@google/genai";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Sanitize malformed environment variables (e.g. if an API key was mistakenly assigned to SUPABASE_URL)
if (
  process.env.VITE_SUPABASE_URL &&
  !process.env.VITE_SUPABASE_URL.startsWith("http://") &&
  !process.env.VITE_SUPABASE_URL.startsWith("https://")
) {
  process.env.VITE_SUPABASE_URL = "https://myqtvbfibvgxkqwxvuru.supabase.co";
}
if (
  process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.startsWith("http://") &&
  !process.env.SUPABASE_URL.startsWith("https://")
) {
  process.env.SUPABASE_URL = "https://myqtvbfibvgxkqwxvuru.supabase.co";
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/chat" && request.method === "POST") {
        const { messages, model = "gemini-3.5-flash" } = await request.json();
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const contents = messages.map((m: any) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }));

        const response = await ai.models.generateContentStream({
          model: model,
          contents: contents,
          config: {
            systemInstruction:
              "You are a helpful and professional AI assistant for Restocash, a restaurant management and point-of-sale system. Help users with their questions, suggest features, and provide clear and concise answers.",
          },
        });

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of response) {
                if (chunk.text) {
                  controller.enqueue(encoder.encode(chunk.text));
                }
              }
            } catch (err) {
              console.error("Gemini stream error:", err);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain",
            "Transfer-Encoding": "chunked",
          },
        });
      }

      if (url.pathname === "/api/github/push" && request.method === "POST") {
        try {
          const body = await request.json();
          const token = body?.token?.trim();
          const targetRepo = body?.repo?.trim() || "mahmoudhindam9-stack/jupa-sep";
          const commitMsg = body?.commitMessage?.trim() || "تحديثات النظام وإصلاح الأكواد";

          if (!token) {
            return new Response(
              JSON.stringify({
                error: "يرجى إدخال GitHub Personal Access Token (رمز الوصول الشخصي) لتخويل الرفع.",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const { execSync } = await import("node:child_process");
          const fs = await import("node:fs");

          // Ensure git repo is initialized if missing
          if (!fs.existsSync(".git")) {
            try {
              execSync("git init -b main", { stdio: "pipe" });
            } catch (e) {}
          }

          // Ensure git user is set
          try {
            execSync('git config user.name "mahmoudhindam9-stack"', { stdio: "pipe" });
            execSync('git config user.email "mahmoudhindam9@gmail.com"', { stdio: "pipe" });
          } catch (e) {}

          // Add any pending changes and commit
          try {
            execSync("git add -A", { stdio: "pipe" });
            const cleanMsg = commitMsg.replace(/"/g, '\\"');
            execSync(`git commit -m "${cleanMsg}"`, { stdio: "pipe" });
          } catch (cErr) {
            // Nothing new to commit is fine
          }

          // Push to GitHub using token authentication (standard GitHub x-access-token format)
          const sanitizedToken = encodeURIComponent(token);
          const pushUrl = `https://x-access-token:${sanitizedToken}@github.com/${targetRepo}.git`;

          const pushOutput = execSync(`git push ${pushUrl} main`, {
            encoding: "utf8",
            stdio: "pipe",
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: `تم رفع التحديثات إلى GitHub (${targetRepo}) بنجاح! 🚀`,
              output: pushOutput || "Updates pushed successfully",
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (pushErr: any) {
          console.error("Git push failed:", pushErr);
          const errMsg = pushErr?.stderr?.toString() || pushErr?.message || "فشلت عملية الرفع";
          let friendlyMsg = errMsg;
          if (
            errMsg.includes("Authentication failed") ||
            errMsg.includes("Invalid username or token")
          ) {
            friendlyMsg =
              "فشل المصادقة: رمز GitHub Token غير صحيح أو انتهت صلاحيته أو لا يملك صلاحية repo.";
          } else if (errMsg.includes("Permission to") && errMsg.includes("denied")) {
            friendlyMsg =
              "تم رفض الإذن: تأكد من أن الرمز يملك صلاحيات الكتابة write على هذا المستودع.";
          }
          return new Response(
            JSON.stringify({
              error: friendlyMsg,
              details: errMsg,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      if (url.pathname === "/api/github/release" && request.method === "POST") {
        try {
          const body = await request.json();
          const token = body?.token?.trim();
          const targetRepo = body?.repo?.trim() || "mahmoudhindam9-stack/jupa-sep";
          const tagName = body?.tagName?.trim() || "v1.3.0";
          const releaseName = body?.releaseName?.trim() || `Restocash ERP ${tagName}`;
          const releaseNotes =
            body?.releaseNotes?.trim() || "تحديثات وإصدار جديد لنظام Restocash ERP";
          const targetCommitish = body?.targetCommitish?.trim() || "main";

          if (!token) {
            return new Response(
              JSON.stringify({
                error:
                  "يرجى إدخال GitHub Personal Access Token (رمز الوصول الشخصي) لتخويل إنشاء الإصدار.",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const { execSync } = await import("node:child_process");
          const fs = await import("node:fs");

          // Ensure git repo and user are configured
          if (!fs.existsSync(".git")) {
            try {
              execSync("git init -b main", { stdio: "pipe" });
            } catch (e) {}
          }
          try {
            execSync('git config user.name "mahmoudhindam9-stack"', { stdio: "pipe" });
            execSync('git config user.email "mahmoudhindam9@gmail.com"', { stdio: "pipe" });
          } catch (e) {}

          // Commit any uncommitted changes first
          try {
            execSync("git add -A", { stdio: "pipe" });
            const cleanMsg = releaseName.replace(/"/g, '\\"');
            execSync(`git commit -m "Release ${tagName}: ${cleanMsg}"`, { stdio: "pipe" });
          } catch (e) {}

          // Push to GitHub main branch first
          const sanitizedToken = encodeURIComponent(token);
          const pushUrl = `https://x-access-token:${sanitizedToken}@github.com/${targetRepo}.git`;
          try {
            execSync(`git push ${pushUrl} main`, { encoding: "utf8", stdio: "pipe" });
          } catch (pushErr) {
            console.warn("Git push warning during release:", pushErr);
          }

          // Create release via GitHub REST API
          const ghRes = await fetch(`https://api.github.com/repos/${targetRepo}/releases`, {
            method: "POST",
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
              "X-GitHub-Api-Version": "2022-11-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tag_name: tagName,
              target_commitish: targetCommitish,
              name: releaseName,
              body: releaseNotes,
              draft: false,
              prerelease: false,
              generate_release_notes: false,
            }),
          });

          const ghData = await ghRes.json();

          if (!ghRes.ok) {
            let errorMsg = ghData?.message || "فشل إنشاء الإصدار على GitHub";
            if (ghData?.errors && Array.isArray(ghData.errors)) {
              errorMsg +=
                ": " +
                ghData.errors.map((e: any) => e.message || e.code || JSON.stringify(e)).join(", ");
            }
            return new Response(
              JSON.stringify({
                error: errorMsg,
                details: ghData,
              }),
              {
                status: ghRes.status,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: `تم إنشاء الإصدار ${tagName} على GitHub (${targetRepo}) بنجاح! 🚀`,
              release: {
                id: ghData.id,
                tag_name: ghData.tag_name,
                name: ghData.name,
                html_url: ghData.html_url,
                published_at: ghData.published_at,
              },
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (relErr: any) {
          console.error("Release creation failed:", relErr);
          return new Response(
            JSON.stringify({
              error: relErr?.message || "حدث خطأ غير متوقع أثناء إنشاء الإصدار",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
