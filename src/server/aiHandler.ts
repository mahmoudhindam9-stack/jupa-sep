import { GoogleGenAI, Type } from "@google/genai";

const MODEL_ID = "gemini-4-hydrogen";
const aiRequestsByKey = new Map<string, number[]>();

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isPreviewOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  ) {
    return true;
  }
  if ((host.startsWith("ais-dev-") || host.startsWith("ais-pre-")) && host.endsWith(".run.app")) {
    return true;
  }
  if (
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".webcontainer.io")
  ) {
    return true;
  }
  return false;
}

async function authorizeAiRequest(
  request: Request,
  url: URL,
): Promise<{ ok: true; rateKey: string } | { ok: false; response: Response }> {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== url.origin) {
        return { ok: false, response: jsonResponse({ error: "مصدر الطلب غير مسموح." }, 403) };
      }
    } catch {
      return { ok: false, response: jsonResponse({ error: "مصدر الطلب غير صالح." }, 403) };
    }
  }

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";

  if (!accessToken) {
    if (isPreviewOrLocalHost(url.hostname)) {
      const forwarded = request.headers.get("x-forwarded-for") || "preview-client";
      return { ok: true, rateKey: `preview:${forwarded}` };
    }
    return {
      ok: false,
      response: jsonResponse({ error: "يجب تسجيل الدخول أولاً لاستخدام ميزات الذكاء الاصطناعي." }, 401),
    };
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "";

    if (!supabaseUrl || !supabaseAnonKey) {
      if (isPreviewOrLocalHost(url.hostname)) {
        return { ok: true, rateKey: "preview:no-supabase" };
      }
      return { ok: false, response: jsonResponse({ error: "إعداد Supabase غير مكتمل." }, 503) };
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userResult, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userResult?.user?.id) {
      if (isPreviewOrLocalHost(url.hostname)) {
        return { ok: true, rateKey: "preview:fallback" };
      }
      return { ok: false, response: jsonResponse({ error: "انتهت جلسة المستخدم." }, 401) };
    }

    return { ok: true, rateKey: `user:${userResult.user.id}` };
  } catch {
    if (isPreviewOrLocalHost(url.hostname)) {
      return { ok: true, rateKey: "preview:err-fallback" };
    }
    return { ok: false, response: jsonResponse({ error: "تعذر التحقق من الجلسة." }, 401) };
  }
}

function checkRateLimit(rateKey: string): Response | null {
  const MAX_PER_MIN = 30;
  const WINDOW_MS = 60_000;
  const now = Date.now();
  const list = (aiRequestsByKey.get(rateKey) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_MIN) {
    return jsonResponse({ error: "تم تجاوز الحد المؤقت للطلبات. انتظر دقيقة وحاول مجدداً." }, 429);
  }
  list.push(now);
  aiRequestsByKey.set(rateKey, list);
  return null;
}

function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("MISSING_GEMINI_API_KEY");
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function buildMultimodalContents(body: any, promptText: string) {
  const parts: any[] = [];
  if (typeof body?.base64 === "string" && body.base64.length > 0) {
    parts.push({
      inlineData: {
        mimeType: typeof body?.mimeType === "string" ? body.mimeType : "image/jpeg",
        data: body.base64,
      },
    });
  }
  const textPayload = typeof body?.textData === "string" ? body.textData.slice(0, 60_000) : "";
  parts.push({
    text: textPayload ? `${promptText}\n\nDATA:\n${textPayload}` : promptText,
  });
  return { parts };
}

export async function handleAiApiRequest(request: Request, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/ai/") || request.method !== "POST") {
    return null;
  }

  const authCheck = await authorizeAiRequest(request, url);
  if (!authCheck.ok) return authCheck.response;

  const limitRes = checkRateLimit(authCheck.rateKey);
  if (limitRes) return limitRes;

  let body: any = {};
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8_000_000) {
      return jsonResponse({ error: "حجم الملف أكبر من 8 ميجابايت." }, 413);
    }
    body = JSON.parse(rawBody || "{}");
  } catch {
    return jsonResponse({ error: "بيانات الطلب غير صالحة." }, 400);
  }

  let ai: GoogleGenAI;
  try {
    ai = getGeminiClient();
  } catch {
    return jsonResponse(
      { error: "مفتاح Gemini غير مهيأ على الخادم. أضف GEMINI_API_KEY في الإعدادات." },
      503,
    );
  }

  try {
    if (url.pathname === "/api/ai/parse-invoice") {
      const existingNames = Array.isArray(body?.inventoryNames)
        ? body.inventoryNames.slice(0, 200).join(", ")
        : "";
      const prompt = [
        "Extract this purchase invoice into structured JSON.",
        "Use Arabic names for items if the invoice is in Arabic or translate concisely to clear Arabic + keep standard quantities and unit prices.",
        existingNames
          ? `Match item names closely to these existing warehouse items when appropriate: ${existingNames}`
          : "",
        "Compute unit_price per unit cleanly (if only line total and quantity are given, divide total by quantity).",
        "Units should be concise: كجم, جم, لتر, مل, علبة, or pcs.",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: buildMultimodalContents(body, prompt),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplier_name: { type: Type.STRING },
              invoice_number: { type: Type.STRING },
              notes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name_ar: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unit_price: { type: Type.NUMBER },
                  },
                  required: ["name_ar", "unit", "quantity", "unit_price"],
                },
              },
            },
            required: ["items"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      return jsonResponse(parsed);
    }

    if (url.pathname === "/api/ai/parse-menu") {
      const existingCats = Array.isArray(body?.existingCategories)
        ? body.existingCategories.slice(0, 60).join(", ")
        : "";
      const existingInv = Array.isArray(body?.existingInventory)
        ? body.existingInventory
            .slice(0, 200)
            .map((i: any) => `${i.name_ar} (${i.unit})`)
            .join(", ")
        : "";

      const prompt = [
        "Extract ALL menu dishes, categories, prices, oven flag, image preset, and standard restaurant recipe ingredients from the supplied file/image/text.",
        "For EVERY dish, infer realistic standard recipe ingredients (raw materials + typical single-serving quantity + unit: كجم, جم, لتر, مل, or pcs) if recipes are not explicitly listed.",
        existingCats ? `Prefer reusing existing categories when they match: ${existingCats}` : "",
        existingInv ? `Prefer matching ingredient names to existing warehouse stock: ${existingInv}` : "",
        "requires_oven should be true for grilled, baked, pizza, fried, or hot cooked kitchen dishes, and false for cold drinks, juices, cold desserts, salads.",
        "image_preset MUST be one of: burger, grill, pizza, pasta, salad, drink, dessert, appetizer.",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: buildMultimodalContents(body, prompt),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categories: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name_ar: { type: Type.STRING },
                    category_name: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    requires_oven: { type: Type.BOOLEAN },
                    image_preset: { type: Type.STRING },
                    ingredients: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name_ar: { type: Type.STRING },
                          weight: { type: Type.NUMBER },
                          unit: { type: Type.STRING },
                        },
                        required: ["name_ar", "weight", "unit"],
                      },
                    },
                  },
                  required: ["name_ar", "category_name", "price", "requires_oven", "image_preset", "ingredients"],
                },
              },
            },
            required: ["categories", "items"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      return jsonResponse(parsed);
    }

    if (url.pathname === "/api/ai/parse-employees") {
      const prompt = [
        "Extract ALL employees and their salaries from this spreadsheet, text list, or image.",
        "Map each employee's role strictly to one of: cashier, captain, kitchen, delivery, accountant, inventory, hr, manager, admin.",
        "Map department to Arabic: المطبخ, الصالة والتوصيل, or الإدارة.",
        "Map currency strictly to EGP or USD (default EGP).",
      ].join("\n");

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: buildMultimodalContents(body, prompt),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              employees: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    job_title: { type: Type.STRING },
                    department: { type: Type.STRING },
                    salary: { type: Type.NUMBER },
                    currency: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    email: { type: Type.STRING },
                    role: { type: Type.STRING },
                  },
                  required: ["name", "job_title", "salary"],
                },
              },
            },
            required: ["employees"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      return jsonResponse(parsed);
    }

    if (url.pathname === "/api/ai/parse-inventory") {
      const prompt = [
        "Extract ALL existing warehouse stock items from this spreadsheet, text list, or image.",
        "Return clean Arabic name_ar, unit (كجم, جم, لتر, مل, علبة, pcs), current quantity, min_level (default 5 if absent), and unit cost (default 0 if absent).",
      ].join("\n");

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: buildMultimodalContents(body, prompt),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name_ar: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    min_level: { type: Type.NUMBER },
                    cost: { type: Type.NUMBER },
                  },
                  required: ["name_ar", "unit", "quantity", "min_level", "cost"],
                },
              },
            },
            required: ["items"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      return jsonResponse(parsed);
    }

    if (url.pathname === "/api/ai/insights") {
      const snapshotJson = JSON.stringify(body?.snapshot || {}).slice(0, 12_000);
      const prompt = [
        "Analyze this restaurant/ERP operational snapshot and produce exactly 3 to 4 ultra-concise Arabic KPI insight cards.",
        "Each card must have a very short title (2-4 words), a short sharp action/metric value (max 8 words), and tone (positive, warning, or info). No paragraphs.",
        `Snapshot: ${snapshotJson}`,
      ].join("\n");

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    value: { type: Type.STRING },
                    tone: { type: Type.STRING },
                  },
                  required: ["title", "value", "tone"],
                },
              },
            },
            required: ["insights"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      return jsonResponse(parsed);
    }

    return jsonResponse({ error: "المسار غير مدعوم." }, 404);
  } catch (err: any) {
    console.error("AI endpoint error:", err);
    const status = Number(err?.status) || 500;
    if (status === 429) {
      return jsonResponse({ error: "تم بلوغ حد استخدام Gemini المؤقت." }, 429);
    }
    return jsonResponse(
      { error: "تعذر معالجة الملف بالذكاء الاصطناعي. تأكد من وضوح البيانات وحاول مجدداً." },
      status >= 400 && status < 600 ? status : 500,
    );
  }
}
