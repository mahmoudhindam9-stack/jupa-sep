import { supabase } from "@/integrations/supabase/client";

async function getOptionalAccessToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  } catch {
    return "";
  }
}

export async function postAiEndpoint<T = any>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const token = await getOptionalAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "تعذر الاتصال بخدمة الذكاء الاصطناعي.");
  }
  return data as T;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
