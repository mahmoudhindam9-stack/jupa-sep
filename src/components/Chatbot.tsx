// @ts-nocheck
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "@tanstack/react-router";
import {
  Send,
  X,
  MessageCircle,
  Minimize2,
  Maximize2,
  Paperclip,
  Camera,
  Video,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileAudio,
  File as FileIcon,
  Download,
  Search,
  ArrowRight,
  CheckCheck,
  SwitchCamera,
  CircleDot,
  Square,
  RotateCcw,
  Smile,
  Reply,
  Trash2,
  FolderOpen,
  UserCheck,
  AlertCircle,
  Volume2,
  VolumeX,
  Eye,
  Mic,
  Users,
  Megaphone,
  Lock,
  ShieldCheck,
  CheckSquare,
  Bell,
} from "lucide-react";
import {
  erpStore,
  DEFAULT_EMPLOYEES,
  type Employee,
  type PayrollRecord,
} from "@/shared/services/erpStore";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface MessengerAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "video" | "audio" | "file";
  dataUrl: string;
  createdAt: string;
}

export interface SalarySlipPayload {
  month: string;
  basicSalary: number;
  bonuses: number;
  deductions: number;
  loanDeduction: number;
  netSalary: number;
  currency: string;
  status: "draft" | "paid";
  paymentDate?: string;
}

export interface MessengerMessage {
  id: string;
  conversationKey: string;
  senderId: string;
  senderName: string;
  senderJobTitle: string;
  receiverId: string;
  receiverName: string;
  receiverJobTitle: string;
  text: string;
  attachments: MessengerAttachment[];
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  reactions?: Record<string, string>; // senderId -> emoji
  createdAt: string;
  readByReceiver?: boolean;
  isBroadcast?: boolean;
  isGroupMessage?: boolean;
  groupDepartment?: string;
  isConfidentialSalary?: boolean;
  confidentialEmployeeId?: string;
  salarySlip?: SalarySlipPayload;
}

export interface DepartmentGroupRoom {
  id: string;
  name: string;
  department: string;
  subtitle: string;
  memberCount: number;
}

const MESSENGER_IDB_NAME = "RESTOCASH_MESSENGER_DB_V1";
const MESSENGER_IDB_STORE = "messages_store";
const MESSENGER_IDB_KEY = "all_coworker_messages_v1";
const MESSENGER_LS_FALLBACK_KEY = "restocash_coworker_messages_meta_v1";
const MESSENGER_ACTIVE_SENDER_KEY = "restocash_messenger_active_sender_id_v1";
const MESSENGER_SOUND_MUTED_KEY = "restocash_messenger_sound_muted_v1";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👏", "🙏"];

const AVATAR_GRADIENTS = [
  "from-blue-600 to-cyan-500",
  "from-indigo-600 to-purple-500",
  "from-emerald-600 to-teal-500",
  "from-rose-600 to-orange-500",
  "from-amber-600 to-yellow-500",
  "from-fuchsia-600 to-pink-500",
  "from-sky-600 to-blue-700",
];

function getAvatarGradient(idOrName: string): string {
  let hash = 0;
  const str = String(idOrName || "emp");
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "م";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] || ""}${parts[1][0] || ""}`;
}

export function makeConversationKey(empA: string, empB: string): string {
  if (String(empA).startsWith("group:") || String(empB).startsWith("group:")) {
    return String(empA).startsWith("group:") ? String(empA) : String(empB);
  }
  return [String(empA), String(empB)].sort().join("__");
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function classifyFileKind(mimeType: string, fileName: string): MessengerAttachment["kind"] {
  const mime = String(mimeType || "").toLowerCase();
  const ext =
    String(fileName || "")
      .split(".")
      .pop()
      ?.toLowerCase() || "";
  if (
    mime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)
  ) {
    return "image";
  }
  if (
    mime.startsWith("video/") ||
    ["mp4", "webm", "ogg", "mov", "mkv", "avi"].includes(ext)
  ) {
    return "video";
  }
  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "aac", "flac", "webm"].includes(ext)
  ) {
    return "audio";
  }
  return "file";
}

function getFileExtensionBadge(fileName: string): string {
  const parts = String(fileName || "").split(".");
  if (parts.length < 2) return "FILE";
  return parts.pop()!.toUpperCase().slice(0, 5);
}

function formatRelativeTimeAr(isoString: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 45) return "الآن";
    if (diffSec < 3600) return `منذ ${Math.max(1, Math.floor(diffSec / 60))} د`;
    if (diffSec < 86400 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// Synthesized Messenger Pop/Chime Notification via Web Audio API
export function playMessengerNotificationChime(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(MESSENGER_SOUND_MUTED_KEY) === "1") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    // Tone 1: soft bright pop (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.09);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.19);

    // Tone 2: harmonic chime (1174.66 Hz - D6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1174.66, now + 0.08);
    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.12, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // Ignore audio context autoplay restriction errors
  }
}

export function loadMessagesFromIDB(): Promise<MessengerMessage[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      try {
        const raw = localStorage.getItem(MESSENGER_LS_FALLBACK_KEY);
        resolve(raw ? JSON.parse(raw) : []);
      } catch {
        resolve([]);
      }
      return;
    }

    try {
      const req = window.indexedDB.open(MESSENGER_IDB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(MESSENGER_IDB_STORE)) {
          db.createObjectStore(MESSENGER_IDB_STORE);
        }
      };
      req.onsuccess = (e: any) => {
        try {
          const db = e.target.result;
          const tx = db.transaction(MESSENGER_IDB_STORE, "readonly");
          const store = tx.objectStore(MESSENGER_IDB_STORE);
          const getReq = store.get(MESSENGER_IDB_KEY);
          getReq.onsuccess = () => {
            if (Array.isArray(getReq.result)) {
              resolve(getReq.result);
            } else {
              try {
                const raw = localStorage.getItem(MESSENGER_LS_FALLBACK_KEY);
                resolve(raw ? JSON.parse(raw) : []);
              } catch {
                resolve([]);
              }
            }
          };
          getReq.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export function saveMessagesToIDB(messages: MessengerMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    if (window.indexedDB) {
      const req = window.indexedDB.open(MESSENGER_IDB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(MESSENGER_IDB_STORE)) {
          db.createObjectStore(MESSENGER_IDB_STORE);
        }
      };
      req.onsuccess = (e: any) => {
        try {
          const db = e.target.result;
          const tx = db.transaction(MESSENGER_IDB_STORE, "readwrite");
          const store = tx.objectStore(MESSENGER_IDB_STORE);
          store.put(messages, MESSENGER_IDB_KEY);
        } catch (err) {
          console.warn("Messenger IDB write warning:", err);
        }
      };
    }
  } catch {
    // Ignore IDB errors
  }

  try {
    const serialized = JSON.stringify(messages);
    if (serialized.length < 3_500_000) {
      localStorage.setItem(MESSENGER_LS_FALLBACK_KEY, serialized);
    }
  } catch {
    // Ignore quota exceeded on localStorage
  }
}

/**
 * Helper used by HR/Payroll (`hr.tsx`) to send strictly private 1-on-1 salary breakdown
 * messages to one or more employees. Each message is locked to that employee's private
 * conversation (`isConfidentialSalary: true`, `confidentialEmployeeId: employee.id`)
 * so no other employee can ever see another coworker's salary details.
 */
export async function sendPrivateSalarySlipMessages(
  items: Array<{ employee: Employee; payroll: PayrollRecord }>,
  customSender?: { id: string; name: string; job_title: string },
): Promise<number> {
  if (!items || items.length === 0) return 0;

  const state = erpStore.getState();
  const hrEmployees =
    Array.isArray(state?.employees) && state.employees.length > 0
      ? state.employees
      : DEFAULT_EMPLOYEES;

  // Resolve sender (HR Manager / Admin)
  const adminEmp =
    customSender ||
    hrEmployees.find(
      (e) =>
        e.department === "الإدارة" ||
        e.job_title.includes("مدير") ||
        e.job_title.includes("محاسب"),
    ) ||
    hrEmployees[0] || {
      id: "emp-hr-admin",
      name: "إدارة الموارد البشرية والرواتب",
      job_title: "الإدارة المالية",
    };

  const existing = await loadMessagesFromIDB();
  const createdMessages: MessengerMessage[] = [];

  items.forEach(({ employee, payroll }, idx) => {
    if (!employee || !employee.id || !payroll) return;

    // Ensure senderId is distinct from receiverId if possible so conversationKey is a valid 1-on-1 thread
    const effectiveSenderId =
      adminEmp.id === employee.id ? "emp-hr-payroll-system" : adminEmp.id;
    const effectiveSenderName =
      adminEmp.id === employee.id
        ? "إدارة الموارد البشرية والرواتب"
        : adminEmp.name;
    const effectiveSenderJob =
      adminEmp.id === employee.id ? "الإدارة المالية" : adminEmp.job_title;

    const convKey = makeConversationKey(effectiveSenderId, employee.id);
    const curr = payroll.currency || employee.currency || "EGP";
    const statusAr = payroll.status === "paid" ? "تم الصرف ✅" : "معتمد وجاهز للصرف ⏳";

    const lines = [
      `تم إصدار كشف مرتبات لشهر ${payroll.month} وتفاصيله الآتي:`,
      `👤 الموظف: ${employee.name} (${employee.job_title})${employee.employee_code ? ` - #${employee.employee_code}` : ""}`,
      `────────────────────`,
      `• الراتب الأساسي: ${Number(payroll.basic_salary || 0).toLocaleString()} ${curr}`,
    ];
    if (Number(payroll.bonuses || 0) > 0) {
      lines.push(`• الإضافي والبدلات: +${Number(payroll.bonuses || 0).toLocaleString()} ${curr}`);
    }
    if (Number(payroll.deductions || 0) > 0) {
      lines.push(`• خصومات الغياب والتأخير: -${Number(payroll.deductions || 0).toLocaleString()} ${curr}`);
    }
    if (Number(payroll.loan_deduction || 0) > 0) {
      lines.push(`• استقطاع قسط السلفة: -${Number(payroll.loan_deduction || 0).toLocaleString()} ${curr}`);
    }
    lines.push(
      `────────────────────`,
      `💰 صافي الراتب المستحق: ${Number(payroll.net_salary || 0).toLocaleString()} ${curr}`,
      `📌 الحالة: ${statusAr}`,
    );
    const text = lines.join("\n");

    const msg: MessengerMessage = {
      id: `sal-msg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      conversationKey: convKey,
      senderId: effectiveSenderId,
      senderName: effectiveSenderName,
      senderJobTitle: effectiveSenderJob,
      receiverId: employee.id,
      receiverName: employee.name,
      receiverJobTitle: employee.job_title,
      text,
      attachments: [],
      createdAt: new Date(Date.now() + idx * 10).toISOString(),
      readByReceiver: false,
      isConfidentialSalary: true,
      confidentialEmployeeId: employee.id,
      salarySlip: {
        month: payroll.month,
        basicSalary: Number(payroll.basic_salary || 0),
        bonuses: Number(payroll.bonuses || 0),
        deductions: Number(payroll.deductions || 0),
        loanDeduction: Number(payroll.loan_deduction || 0),
        netSalary: Number(payroll.net_salary || 0),
        currency: curr,
        status: payroll.status,
        paymentDate: payroll.payment_date,
      },
    };

    createdMessages.push(msg);
  });

  if (createdMessages.length === 0) return 0;

  const updatedList = [...existing, ...createdMessages];
  saveMessagesToIDB(updatedList);

  // Notify open Messenger instances in the same tab & across tabs
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("restocash-messenger-external-sync", {
        detail: { messages: updatedList, latestNew: createdMessages[createdMessages.length - 1] },
      }),
    );
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("restocash_employee_messenger_bc");
      bc.postMessage({ type: "SYNC_MESSAGES", payload: updatedList });
      bc.close();
    }
  } catch {
    // ignore
  }

  return createdMessages.length;
}

function buildSeedMessages(employees: Employee[]): MessengerMessage[] {
  if (!employees || employees.length < 2) return [];
  const emp1 = employees[0];
  const emp2 = employees[1];
  const emp3 = employees[2] || employees[0];
  const now = Date.now();

  return [
    {
      id: "seed-msg-1",
      conversationKey: makeConversationKey(emp1.id, emp2.id),
      senderId: emp2.id,
      senderName: emp2.name,
      senderJobTitle: emp2.job_title,
      receiverId: emp1.id,
      receiverName: emp1.name,
      receiverJobTitle: emp1.job_title,
      text: `أهلاً بك يا ${emp1.name.split(" ")[0]}! هذا نظام محادثات الزملاء الداخلي الجديد للتواصل السريع وإرسال الملفات والصور والرسائل الصوتية مباشرة.`,
      attachments: [],
      createdAt: new Date(now - 1000 * 60 * 25).toISOString(),
      readByReceiver: true,
    },
    {
      id: "seed-msg-2",
      conversationKey: makeConversationKey(emp1.id, emp3.id),
      senderId: emp3.id,
      senderName: emp3.name,
      senderJobTitle: emp3.job_title,
      receiverId: emp1.id,
      receiverName: emp1.name,
      receiverJobTitle: emp1.job_title,
      text: "تم تجهيز تقارير الوردية، يمكنك إرفاق أي مستندات أو صور مباشرة من هنا.",
      attachments: [],
      createdAt: new Date(now - 1000 * 60 * 10).toISOString(),
      readByReceiver: true,
    },
    {
      id: "seed-group-1",
      conversationKey: "group:ALL",
      senderId: emp2.id,
      senderName: emp2.name,
      senderJobTitle: emp2.job_title,
      receiverId: "group:ALL",
      receiverName: "المجموعة العامة للشركة",
      receiverJobTitle: "جميع الأقسام",
      text: "مرحباً بجميع الزملاء في المجموعة العامة للشركة! يمكنكم التواصل هنا أو عبر مجموعات الأقسام.",
      attachments: [],
      createdAt: new Date(now - 1000 * 60 * 40).toISOString(),
      readByReceiver: true,
      isGroupMessage: true,
      groupDepartment: "ALL",
    },
  ];
}

export function Chatbot() {
  const location = useLocation();

  // Hide Messenger on Customer Self-Order page (/menu) and login/setup screens
  const isHiddenRoute = useMemo(() => {
    const pathname = String(location.pathname || "");
    const searchStr =
      typeof window !== "undefined"
        ? window.location.search
        : String((location as any).searchStr || "");
    if (
      pathname.startsWith("/menu") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/setup") ||
      searchStr.includes("page=menu") ||
      searchStr.includes("selfOrder=1")
    ) {
      return true;
    }
    return false;
  }, [location.pathname, (location as any).searchStr]);

  // Prevent SSR hydration mismatch on client-dependent auth / local storage
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Subscribe to HR Employees & Users/Permissions in erpStore
  const [erpState, setErpState] = useState(() => erpStore.getState());
  useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  const roleTitleAr = (role?: string) => {
    switch (role) {
      case "super_admin":
        return "مدير النظام الأعلى";
      case "admin":
        return "مدير النظام";
      case "manager":
        return "مدير فرع / مشرف";
      case "cashier":
        return "كاشير";
      case "captain":
        return "كابتن صالة";
      case "kitchen":
        return "شيف مطبخ";
      default:
        return "موظف";
    }
  };

  // Merge HR employees with any Users from the Users page so the logged-in user and all staff are represented with their employee_code
  const hrEmployees: Employee[] = useMemo(() => {
    const baseList =
      Array.isArray(erpState?.employees) && erpState.employees.length > 0
        ? erpState.employees
        : DEFAULT_EMPLOYEES;
    const employeesMap = new Map<string, Employee>();
    baseList.forEach((e, idx) => {
      if (!e || !e.name) return;
      employeesMap.set(e.id, {
        ...e,
        employee_code: e.employee_code || String(1001 + idx),
      });
    });

    // Ensure every user in Users page has a corresponding entry or is linked by employee_code/full_name
    const users = Array.isArray(erpState?.users) ? erpState.users : [];
    users.forEach((u: any, idx: number) => {
      if (!u || (!u.full_name && !u.username)) return;
      const uName = String(u.full_name || u.username).trim();
      const uCode = String(u.employee_code || "").trim();
      const existing = Array.from(employeesMap.values()).find(
        (emp) =>
          (uCode && emp.employee_code === uCode) ||
          emp.name.trim() === uName ||
          emp.name.includes(uName) ||
          uName.includes(emp.name.trim()),
      );
      if (existing) {
        employeesMap.set(existing.id, {
          ...existing,
          employee_code: existing.employee_code || uCode || String(1001 + idx),
          name: u.full_name ? u.full_name.trim() : existing.name,
        });
      } else {
        const syntheticId = `user-emp-${u.id || u.username}`;
        employeesMap.set(syntheticId, {
          id: syntheticId,
          employee_code: uCode || String(1000 + idx),
          name: uName,
          job_title: roleTitleAr(u.role),
          department: u.role === "admin" || u.role === "super_admin" ? "الإدارة" : "المطعم",
          phone: u.phone || "",
          hire_date: (u.created_at || new Date().toISOString()).split("T")[0],
          salary: 0,
          currency: "EGP",
          status: "active",
        });
      }
    });

    return Array.from(employeesMap.values());
  }, [erpState?.employees, erpState?.users]);

  // Automatically resolve the active chat identity from the logged-in user in the Users page (no manual identity switching)
  const currentSenderEmployee: Employee = useMemo(() => {
    try {
      const storedAuth =
        typeof window !== "undefined"
          ? localStorage.getItem("restocash_auth_user") ||
            sessionStorage.getItem("restocash_auth_user") ||
            ""
          : "";
      const norm = String(storedAuth || erpState?.currentUser || "")
        .trim()
        .toLowerCase();
      const normShort = norm.split("@")[0];

      const matchedUser = (erpState?.users || []).find((u: any) => {
        const uname = String(u.username || "").trim().toLowerCase();
        const uemail = String(u.email || "").trim().toLowerCase();
        return (
          (!!norm && (uname === norm || uemail === norm)) ||
          (!!normShort && (uname === normShort || uemail.split("@")[0] === normShort))
        );
      });

      if (matchedUser) {
        const uName = String(matchedUser.full_name || matchedUser.username || "").trim();
        const uCode = String(matchedUser.employee_code || "").trim();
        const empMatch = hrEmployees.find(
          (e) =>
            (uCode && e.employee_code === uCode) ||
            e.name.trim() === uName ||
            e.name.includes(uName) ||
            uName.includes(e.name.trim()) ||
            e.id === `user-emp-${matchedUser.id || matchedUser.username}`,
        );
        if (empMatch) {
          return {
            ...empMatch,
            name: uName || empMatch.name,
            employee_code: uCode || empMatch.employee_code,
          };
        }
        return {
          id: `user-emp-${matchedUser.id || matchedUser.username}`,
          employee_code: uCode || "1000",
          name: uName || "مستخدم النظام",
          job_title: roleTitleAr(matchedUser.role),
          department: "الإدارة",
          phone: matchedUser.phone || "",
          hire_date: "",
          salary: 0,
          currency: "EGP",
          status: "active",
        };
      }
    } catch {
      // ignore
    }

    return (
      hrEmployees[0] || {
        id: "emp-admin",
        employee_code: "1000",
        name: "مدير النظام",
        job_title: "الإدارة العامة",
        department: "الإدارة",
        phone: "",
        hire_date: "",
        salary: 0,
        currency: "EGP",
        status: "active",
      }
    );
  }, [hrEmployees, erpState?.users, erpState?.currentUser]);

  // Track real Online/Offline login sessions for all users/employees
  const [onlineEmployeeIds, setOnlineEmployeeIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("restocash_online_sessions_v1");
      const sessions = raw ? JSON.parse(raw) || {} : {};
      if (currentSenderEmployee?.id) {
        sessions[`emp:${currentSenderEmployee.id}`] = Date.now();
        if (currentSenderEmployee.employee_code) {
          sessions[`code:${currentSenderEmployee.employee_code}`] = Date.now();
        }
        if (currentSenderEmployee.name) {
          sessions[`name:${currentSenderEmployee.name.trim()}`] = Date.now();
        }
        localStorage.setItem("restocash_online_sessions_v1", JSON.stringify(sessions));
      }
    } catch {
      // ignore
    }
  }, [currentSenderEmployee]);

  const isEmployeeOnline = useCallback(
    (emp: Employee | null | undefined): boolean => {
      if (!emp) return false;
      // The currently logged-in user is always Online
      if (emp.id === currentSenderEmployee.id) return true;
      if (onlineEmployeeIds[emp.id]) return true;

      // Check active login sessions in localStorage matched against Users page
      if (typeof window !== "undefined") {
        try {
          const activeAuth = (
            localStorage.getItem("restocash_auth_user") ||
            sessionStorage.getItem("restocash_auth_user") ||
            erpState?.currentUser ||
            ""
          )
            .trim()
            .toLowerCase();

          const raw = localStorage.getItem("restocash_online_sessions_v1");
          const sessions = raw ? JSON.parse(raw) || {} : {};

          if (sessions[`emp:${emp.id}`]) return true;
          if (emp.employee_code && sessions[`code:${emp.employee_code}`]) return true;
          if (emp.name && sessions[`name:${emp.name.trim()}`]) return true;

          // Check if a system user linked to this employee has an active login session
          const linkedUser = (erpState?.users || []).find(
            (u: any) =>
              (emp.employee_code && u.employee_code === emp.employee_code) ||
              (u.full_name && u.full_name.trim() === emp.name.trim()),
          );
          if (linkedUser) {
            const uname = String(linkedUser.username || "").trim().toLowerCase();
            const uemail = String(linkedUser.email || "").trim().toLowerCase();
            if (
              (activeAuth && (activeAuth === uname || activeAuth === uemail)) ||
              (uname && sessions[uname]) ||
              (uemail && sessions[uemail])
            ) {
              return true;
            }
          }
        } catch {
          // ignore
        }
      }
      return false;
    },
    [currentSenderEmployee.id, onlineEmployeeIds, erpState?.users, erpState?.currentUser],
  );

  // Check if current logged-in user or active employee has Broadcast Messaging permission
  const canSendBroadcast = useMemo(() => {
    try {
      const storedAuth = (
        typeof window !== "undefined"
          ? localStorage.getItem("restocash_auth_user") ||
            sessionStorage.getItem("restocash_auth_user") ||
            ""
          : ""
      )
        .trim()
        .toLowerCase();
      const username = String(erpState?.currentUser || storedAuth.split("@")[0] || "")
        .trim()
        .toLowerCase();
      const matchedUser = (erpState?.users || []).find(
        (u: any) =>
          String(u.username || "").toLowerCase() === username ||
          (!!storedAuth && String(u.email || "").toLowerCase() === storedAuth),
      );
      const perms =
        matchedUser?.permissions ||
        erpState?.userPermissions?.[username] ||
        erpState?.userPermissions?.[storedAuth] ||
        {};

      if (
        matchedUser?.role === "super_admin" ||
        matchedUser?.role === "admin" ||
        matchedUser?.role === "manager" ||
        perms.super_admin_full_access === true ||
        perms.messenger_broadcast === true ||
        perms.hr_manage_payroll_loans === true ||
        perms.hr === true
      ) {
        return true;
      }

      // Also check if currentSenderEmployee is in Administration / Manager role
      if (
        currentSenderEmployee.department === "الإدارة" ||
        currentSenderEmployee.job_title.includes("مدير") ||
        currentSenderEmployee.job_title.includes("مشرف")
      ) {
        return true;
      }
    } catch {
      return true;
    }
    return false;
  }, [erpState, currentSenderEmployee]);

  // Check if current viewer is HR/Admin for viewing sent salary slips
  const isHrPayrollManager = useMemo(() => {
    return (
      canSendBroadcast &&
      (currentSenderEmployee.department === "الإدارة" ||
        currentSenderEmployee.job_title.includes("مدير") ||
        currentSenderEmployee.job_title.includes("محاسب"))
    );
  }, [canSendBroadcast, currentSenderEmployee]);

  // Messenger UI States
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [contactListMode, setContactListMode] = useState<"direct" | "groups">("direct");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedGroupRoomId, setSelectedGroupRoomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [showSharedFilesDrawer, setShowSharedFilesDrawer] = useState(false);

  // Sound & Incoming Notification Popup States
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(MESSENGER_SOUND_MUTED_KEY) === "1";
    }
    return false;
  });
  const [incomingToastMsg, setIncomingToastMsg] = useState<MessengerMessage | null>(null);

  // Broadcast / Multi-User Modal States
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<"all" | "selected">("all");
  const [selectedBroadcastEmpIds, setSelectedBroadcastEmpIds] = useState<string[]>([]);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastAttachments, setBroadcastAttachments] = useState<MessengerAttachment[]>([]);
  const [broadcastSearch, setBroadcastSearch] = useState("");
  const broadcastFileInputRef = useRef<HTMLInputElement>(null);

  // Messages & Composer States
  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [stagedAttachments, setStagedAttachments] = useState<MessengerAttachment[]>([]);
  const [replyingTo, setReplyingTo] = useState<MessengerMessage | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<MessengerAttachment | null>(null);

  // Voice Note Recording States (Suggestion 1)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<any>(null);

  // Camera Modal States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraPermissionState, setCameraPermissionState] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string>("");
  const [capturedMedia, setCapturedMedia] = useState<MessengerAttachment | null>(null);
  const [cameraCaption, setCameraCaption] = useState("");
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const toggleSoundMute = () => {
    setIsSoundMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MESSENGER_SOUND_MUTED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      if (!next) {
        playMessengerNotificationChime();
      }
      return next;
    });
  };

  // Trigger incoming message sound & toast popup
  const notifyIncomingMessage = useCallback(
    (msg: MessengerMessage) => {
      if (!msg) return;
      // Strict privacy check: never show toast for another employee's confidential salary slip
      if (
        msg.isConfidentialSalary &&
        msg.confidentialEmployeeId !== currentSenderEmployee.id
      ) {
        return;
      }
      if (msg.senderId === currentSenderEmployee.id) return;

      playMessengerNotificationChime();
      setIncomingToastMsg(msg);
    },
    [currentSenderEmployee.id],
  );

  useEffect(() => {
    if (!incomingToastMsg) return;
    const timer = setTimeout(() => {
      setIncomingToastMsg(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [incomingToastMsg]);

  // Load persisted messages from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    loadMessagesFromIDB().then((stored) => {
      if (!mounted) return;
      if (stored && stored.length > 0) {
        setMessages(stored);
      } else {
        const seeded = buildSeedMessages(hrEmployees);
        setMessages(seeded);
        saveMessagesToIDB(seeded);
      }
    });
    return () => {
      mounted = false;
    };
  }, [hrEmployees.length]);

  // Sync messages across tabs, external dispatches (e.g., HR Salary Slips), & Supabase Realtime
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleExternalSync = (e: any) => {
      const detail = e?.detail;
      if (detail?.messages && Array.isArray(detail.messages)) {
        setMessages(detail.messages);
        if (detail.latestNew) {
          notifyIncomingMessage(detail.latestNew);
        }
      }
    };
    window.addEventListener("restocash-messenger-external-sync", handleExternalSync);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("restocash_employee_messenger_bc");
      bc.onmessage = (event) => {
        const data = event.data;
        if (data?.type === "NEW_MESSAGE" && data.payload) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.payload.id)) return prev;
            const next = [...prev, data.payload];
            saveMessagesToIDB(next);
            return next;
          });
          notifyIncomingMessage(data.payload);
        } else if (data?.type === "SYNC_MESSAGES" && Array.isArray(data.payload)) {
          setMessages(data.payload);
          saveMessagesToIDB(data.payload);
        }
      };
    }

    const channel = supabase
      .channel("restocash_employee_messenger_rt", {
        config: { presence: { key: currentSenderEmployee.id } },
      })
      .on("broadcast", { event: "NEW_MESSAGE" }, (payload) => {
        const incoming = payload?.payload as MessengerMessage;
        if (incoming && incoming.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            const next = [...prev, incoming];
            saveMessagesToIDB(next);
            return next;
          });
          notifyIncomingMessage(incoming);
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const nextOnline: Record<string, boolean> = {};
        Object.keys(state || {}).forEach((k) => {
          nextOnline[k] = true;
        });
        setOnlineEmployeeIds(nextOnline);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && currentSenderEmployee?.id) {
          await channel.track({
            empId: currentSenderEmployee.id,
            name: currentSenderEmployee.name,
            employee_code: currentSenderEmployee.employee_code,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      window.removeEventListener("restocash-messenger-external-sync", handleExternalSync);
      bc?.close();
      supabase.removeChannel(channel);
    };
  }, [notifyIncomingMessage, currentSenderEmployee.id, currentSenderEmployee.name, currentSenderEmployee.employee_code]);

  const broadcastNewMessage = useCallback((msg: MessengerMessage) => {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("restocash_employee_messenger_bc");
        bc.postMessage({ type: "NEW_MESSAGE", payload: msg });
        bc.close();
      }
    } catch {
      // ignore
    }

    try {
      const sizeEst = JSON.stringify(msg).length;
      if (sizeEst < 900_000) {
        const ch = supabase.channel("restocash_employee_messenger_rt");
        ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.send({
              type: "broadcast",
              event: "NEW_MESSAGE",
              payload: msg,
            });
          }
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const broadcastSyncMessages = useCallback((updatedList: MessengerMessage[]) => {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("restocash_employee_messenger_bc");
        bc.postMessage({ type: "SYNC_MESSAGES", payload: updatedList });
        bc.close();
      }
    } catch {
      // ignore
    }
  }, []);

  // Strict privacy filter: confidential salary messages are ONLY visible if the current viewer is
  // that exact recipient employee (`msg.confidentialEmployeeId === currentSenderEmployee.id`)
  // OR if the viewer is the HR/Admin sender viewing their own 1-on-1 dispatch with that employee.
  const visibleMessages = useMemo(() => {
    return messages.filter((m) => {
      if (!m.isConfidentialSalary) return true;
      if (m.confidentialEmployeeId === currentSenderEmployee.id) return true;
      if (m.senderId === currentSenderEmployee.id && isHrPayrollManager) return true;
      return false;
    });
  }, [messages, currentSenderEmployee.id, isHrPayrollManager]);

  // Department Group Rooms (Suggestion 2)
  const departmentGroups: DepartmentGroupRoom[] = useMemo(() => {
    const deptCounts: Record<string, number> = {};
    hrEmployees.forEach((e) => {
      const d = e.department || "عام";
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    });

    const rooms: DepartmentGroupRoom[] = [
      {
        id: "group:ALL",
        name: "المجموعة العامة للشركة",
        department: "ALL",
        subtitle: "جميع موظفي المؤسسة والتعميمات المشتركة",
        memberCount: hrEmployees.length,
      },
    ];

    Object.entries(deptCounts).forEach(([dept, count]) => {
      rooms.push({
        id: `group:${dept}`,
        name: `مجموعة قسم ${dept}`,
        department: dept,
        subtitle: `غرفة عمل موظفي ${dept}`,
        memberCount: count,
      });
    });

    return rooms;
  }, [hrEmployees]);

  // Selected coworker or group room
  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return hrEmployees.find((e) => e.id === selectedEmployeeId) || null;
  }, [hrEmployees, selectedEmployeeId]);

  const selectedGroupRoom = useMemo(() => {
    if (!selectedGroupRoomId) return null;
    return departmentGroups.find((g) => g.id === selectedGroupRoomId) || null;
  }, [departmentGroups, selectedGroupRoomId]);

  // Active conversation key
  const activeConversationKey = useMemo(() => {
    if (selectedGroupRoom) return selectedGroupRoom.id;
    if (!selectedEmployee) return "";
    return makeConversationKey(currentSenderEmployee.id, selectedEmployee.id);
  }, [currentSenderEmployee.id, selectedEmployee, selectedGroupRoom]);

  // Messages for the active conversation
  const activeConversationMessages = useMemo(() => {
    if (!activeConversationKey) return [];
    return visibleMessages.filter((m) => m.conversationKey === activeConversationKey);
  }, [visibleMessages, activeConversationKey]);

  // Mark unread messages as read when viewing a conversation
  useEffect(() => {
    if (!isOpen || !activeConversationKey) return;
    const hasUnread = visibleMessages.some(
      (m) =>
        m.conversationKey === activeConversationKey &&
        m.receiverId === currentSenderEmployee.id &&
        !m.readByReceiver,
    );
    if (!hasUnread) return;

    setMessages((prev) => {
      const next = prev.map((m) =>
        m.conversationKey === activeConversationKey && m.receiverId === currentSenderEmployee.id
          ? { ...m, readByReceiver: true }
          : m,
      );
      saveMessagesToIDB(next);
      broadcastSyncMessages(next);
      return next;
    });
  }, [
    isOpen,
    activeConversationKey,
    currentSenderEmployee.id,
    visibleMessages,
    broadcastSyncMessages,
  ]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [
    activeConversationMessages.length,
    selectedEmployeeId,
    selectedGroupRoomId,
    stagedAttachments.length,
  ]);

  // Calculate unread counts per employee and total unread
  const unreadByEmployeeId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const msg of visibleMessages) {
      if (
        !msg.isGroupMessage &&
        msg.receiverId === currentSenderEmployee.id &&
        !msg.readByReceiver &&
        msg.senderId !== currentSenderEmployee.id
      ) {
        map[msg.senderId] = (map[msg.senderId] || 0) + 1;
      }
    }
    return map;
  }, [visibleMessages, currentSenderEmployee.id]);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadByEmployeeId).reduce((sum, count) => sum + count, 0);
  }, [unreadByEmployeeId]);

  // Get last message for each employee
  const lastMessageByEmployeeId = useMemo(() => {
    const map: Record<string, MessengerMessage> = {};
    for (const emp of hrEmployees) {
      const convKey = makeConversationKey(currentSenderEmployee.id, emp.id);
      const convMsgs = visibleMessages.filter((m) => m.conversationKey === convKey);
      if (convMsgs.length > 0) {
        map[emp.id] = convMsgs[convMsgs.length - 1];
      }
    }
    return map;
  }, [hrEmployees, visibleMessages, currentSenderEmployee.id]);

  // Get last message for each group room
  const lastMessageByGroupId = useMemo(() => {
    const map: Record<string, MessengerMessage> = {};
    for (const grp of departmentGroups) {
      const grpMsgs = visibleMessages.filter((m) => m.conversationKey === grp.id);
      if (grpMsgs.length > 0) {
        map[grp.id] = grpMsgs[grpMsgs.length - 1];
      }
    }
    return map;
  }, [departmentGroups, visibleMessages]);

  // Departments list from HR employees
  const departments = useMemo(() => {
    const set = new Set<string>();
    hrEmployees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [hrEmployees]);

  // Filtered HR employees list (sorted by most recent message first)
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hrEmployees
      .filter((emp) => {
        if (selectedDept !== "ALL" && emp.department !== selectedDept) return false;
        if (!q) return true;
        return (
          emp.name.toLowerCase().includes(q) ||
          (emp.employee_code || "").toLowerCase().includes(q) ||
          (emp.job_title || "").toLowerCase().includes(q) ||
          (emp.department || "").toLowerCase().includes(q) ||
          (emp.phone || "").includes(q)
        );
      })
      .sort((a, b) => {
        const unreadA = unreadByEmployeeId[a.id] || 0;
        const unreadB = unreadByEmployeeId[b.id] || 0;
        if (unreadA !== unreadB) return unreadB - unreadA;
        const lastA = lastMessageByEmployeeId[a.id]?.createdAt || "";
        const lastB = lastMessageByEmployeeId[b.id]?.createdAt || "";
        if (lastA !== lastB) return lastB.localeCompare(lastA);
        return a.name.localeCompare(b.name, "ar");
      });
  }, [hrEmployees, searchQuery, selectedDept, lastMessageByEmployeeId, unreadByEmployeeId]);

  // Convert FileList / File[] into MessengerAttachment[]
  const processFilesToAttachments = async (
    files: FileList | File[],
    targetSetter: React.Dispatch<React.SetStateAction<MessengerAttachment[]>> = setStagedAttachments,
  ) => {
    const fileArray = Array.from(files || []);
    if (fileArray.length === 0) return;

    const readPromises = fileArray.map(
      (file) =>
        new Promise<MessengerAttachment | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || "");
            resolve({
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              mimeType: file.type || "application/octet-stream",
              size: file.size,
              kind: classifyFileKind(file.type, file.name),
              dataUrl,
              createdAt: new Date().toISOString(),
            });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        }),
    );

    const results = (await Promise.all(readPromises)).filter(Boolean) as MessengerAttachment[];
    if (results.length > 0) {
      targetSetter((prev) => [...prev, ...results]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFilesToAttachments(e.target.files, setStagedAttachments);
      e.target.value = "";
    }
  };

  const handleBroadcastFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFilesToAttachments(e.target.files, setBroadcastAttachments);
      e.target.value = "";
    }
  };

  const handleSendMessage = (
    e?: React.FormEvent,
    customAttachments?: MessengerAttachment[],
    customText?: string,
  ) => {
    if (e) e.preventDefault();
    if (!selectedEmployee && !selectedGroupRoom) return;

    const textToSend = (customText !== undefined ? customText : inputText).trim();
    const attachmentsToSend =
      customAttachments !== undefined ? customAttachments : stagedAttachments;

    if (!textToSend && attachmentsToSend.length === 0) return;

    const isGroup = Boolean(selectedGroupRoom);

    const newMsg: MessengerMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      conversationKey: isGroup
        ? selectedGroupRoom!.id
        : makeConversationKey(currentSenderEmployee.id, selectedEmployee!.id),
      senderId: currentSenderEmployee.id,
      senderName: currentSenderEmployee.name,
      senderJobTitle: currentSenderEmployee.job_title,
      receiverId: isGroup ? selectedGroupRoom!.id : selectedEmployee!.id,
      receiverName: isGroup ? selectedGroupRoom!.name : selectedEmployee!.name,
      receiverJobTitle: isGroup ? selectedGroupRoom!.subtitle : selectedEmployee!.job_title,
      text: textToSend,
      attachments: attachmentsToSend,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            text:
              replyingTo.text ||
              (replyingTo.attachments?.length
                ? `📎 مرفق (${replyingTo.attachments[0].name})`
                : "رسالة"),
          }
        : undefined,
      reactions: {},
      createdAt: new Date().toISOString(),
      readByReceiver: isGroup || selectedEmployee?.id === currentSenderEmployee.id,
      isGroupMessage: isGroup,
      groupDepartment: isGroup ? selectedGroupRoom!.department : undefined,
    };

    setMessages((prev) => {
      const next = [...prev, newMsg];
      saveMessagesToIDB(next);
      return next;
    });

    broadcastNewMessage(newMsg);

    if (customText === undefined) setInputText("");
    if (customAttachments === undefined) setStagedAttachments([]);
    setReplyingTo(null);
  };

  // ============================================================================
  // BROADCAST / MULTI-RECIPIENT SEND HANDLER
  // ============================================================================
  const handleSendBroadcastMessages = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSendBroadcast) return;

    const text = broadcastText.trim();
    if (!text && broadcastAttachments.length === 0) return;

    const recipients =
      broadcastTargetMode === "all"
        ? hrEmployees.filter((emp) => emp.id !== currentSenderEmployee.id)
        : hrEmployees.filter((emp) => selectedBroadcastEmpIds.includes(emp.id));

    if (recipients.length === 0) return;

    const nowMs = Date.now();
    const createdMsgs: MessengerMessage[] = recipients.map((emp, idx) => ({
      id: `bcast-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      conversationKey: makeConversationKey(currentSenderEmployee.id, emp.id),
      senderId: currentSenderEmployee.id,
      senderName: currentSenderEmployee.name,
      senderJobTitle: currentSenderEmployee.job_title,
      receiverId: emp.id,
      receiverName: emp.name,
      receiverJobTitle: emp.job_title,
      text,
      attachments: broadcastAttachments,
      createdAt: new Date(nowMs + idx * 5).toISOString(),
      readByReceiver: false,
      isBroadcast: true,
    }));

    setMessages((prev) => {
      const next = [...prev, ...createdMsgs];
      saveMessagesToIDB(next);
      broadcastSyncMessages(next);
      return next;
    });

    setBroadcastText("");
    setBroadcastAttachments([]);
    setIsBroadcastModalOpen(false);
  };

  // ============================================================================
  // VOICE NOTES RECORDING (Suggestion 1)
  // ============================================================================
  const stopVoiceRecordingCleanup = useCallback(() => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    setIsRecordingVoice(false);
    setVoiceRecordingSeconds(0);
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      voiceStreamRef.current = null;
    }
  }, []);

  const startVoiceNoteRecording = async () => {
    if (isRecordingVoice) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];

      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options = { mimeType: "audio/webm;codecs=opus" };
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options = { mimeType: "audio/mp4" };
        }
      }

      const recorder = new MediaRecorder(stream, options);
      voiceRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          voiceChunksRef.current.push(ev.data);
        }
      };

      recorder.start(200);
      setIsRecordingVoice(true);
      setVoiceRecordingSeconds(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.warn("Microphone permission denied or unavailable:", err);
      stopVoiceRecordingCleanup();
    }
  };

  const cancelVoiceNoteRecording = () => {
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== "inactive") {
      try {
        voiceRecorderRef.current.onstop = null;
        voiceRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    voiceRecorderRef.current = null;
    voiceChunksRef.current = [];
    stopVoiceRecordingCleanup();
  };

  const finishAndSendVoiceNote = () => {
    const recorder = voiceRecorderRef.current;
    const durationSec = voiceRecordingSeconds;
    if (!recorder || recorder.state === "inactive") {
      stopVoiceRecordingCleanup();
      return;
    }

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      const blob = new Blob(voiceChunksRef.current, { type: mimeType });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const voiceAttachment: MessengerAttachment = {
          id: `voice-${Date.now()}`,
          name: `رسالة-صوتية-${Math.max(1, durationSec)}ث.${ext}`,
          mimeType,
          size: blob.size,
          kind: "audio",
          dataUrl,
          createdAt: new Date().toISOString(),
        };
        handleSendMessage(undefined, [voiceAttachment], inputText.trim() || "🎤 رسالة صوتية");
      };
      reader.readAsDataURL(blob);
      stopVoiceRecordingCleanup();
    };

    try {
      recorder.stop();
    } catch {
      stopVoiceRecordingCleanup();
    }
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== msgId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        if (currentReactions[currentSenderEmployee.id] === emoji) {
          delete currentReactions[currentSenderEmployee.id];
        } else {
          currentReactions[currentSenderEmployee.id] = emoji;
        }
        return { ...m, reactions: currentReactions };
      });
      saveMessagesToIDB(next);
      broadcastSyncMessages(next);
      return next;
    });
    setActiveReactionMsgId(null);
  };

  const handleDeleteMessage = (msgId: string) => {
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== msgId);
      saveMessagesToIDB(next);
      broadcastSyncMessages(next);
      return next;
    });
  };

  // ============================================================================
  // LIVE CAMERA PHOTO & VIDEO CAPTURE (getUserMedia + MediaRecorder)
  // ============================================================================
  const stopCameraStream = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingVideo(false);
    setRecordingSeconds(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  }, []);

  const requestAndOpenCamera = useCallback(
    async (mode: "photo" | "video" = cameraMode, facing: "user" | "environment" = facingMode) => {
      stopCameraStream();
      setCapturedMedia(null);
      setCameraErrorMsg("");
      setCameraPermissionState("requesting");
      setIsCameraOpen(true);

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setCameraPermissionState("denied");
        setCameraErrorMsg(
          "المتصفح الحالي لا يدعم تشغيل الكاميرا المباشرة أو يتطلب اتصال آمن (HTTPS).",
        );
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: mode === "video",
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        mediaStreamRef.current = stream;
        setCameraPermissionState("granted");

        setTimeout(() => {
          if (videoPreviewRef.current && mediaStreamRef.current) {
            videoPreviewRef.current.srcObject = mediaStreamRef.current;
            videoPreviewRef.current.play().catch(() => {});
          }
        }, 80);
      } catch (err: any) {
        console.warn("Camera permission error:", err);
        setCameraPermissionState("denied");
        setCameraErrorMsg(
          err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
            ? "تم رفض صلاحية الوصول للكاميرا. يرجى السماح بصلاحية الكاميرا من شريط عنوان المتصفح ثم المحاولة مجدداً."
            : "تعذر فتح الكاميرا. تأكد من توصيل الكاميرا وعدم استخدامها من تطبيق آخر.",
        );
      }
    },
    [cameraMode, facingMode, stopCameraStream],
  );

  useEffect(() => {
    return () => {
      stopCameraStream();
      stopVoiceRecordingCleanup();
    };
  }, [stopCameraStream, stopVoiceRecordingCleanup]);

  const closeCameraModal = () => {
    stopCameraStream();
    setCapturedMedia(null);
    setCameraCaption("");
    setIsCameraOpen(false);
    setCameraPermissionState("idle");
  };

  const handleSwitchCameraFacing = () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    void requestAndOpenCamera(cameraMode, nextFacing);
  };

  const handleSwitchCameraMode = (nextMode: "photo" | "video") => {
    if (isRecordingVideo) return;
    setCameraMode(nextMode);
    setCapturedMedia(null);
    void requestAndOpenCamera(nextMode, facingMode);
  };

  const capturePhotoFromStream = () => {
    const videoEl = videoPreviewRef.current;
    if (!videoEl) return;

    const width = videoEl.videoWidth || 1280;
    const height = videoEl.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    const approxBytes = Math.round((dataUrl.length * 3) / 4);

    stopCameraStream();
    setCapturedMedia({
      id: `cam-photo-${Date.now()}`,
      name: `صورة-كاميرا-${new Date().toLocaleTimeString("en-GB").replace(/:/g, "-")}.jpg`,
      mimeType: "image/jpeg",
      size: approxBytes,
      kind: "image",
      dataUrl,
      createdAt: new Date().toISOString(),
    });
  };

  const startVideoRecording = () => {
    const stream = mediaStreamRef.current;
    if (!stream) return;

    recordedChunksRef.current = [];
    let options: MediaRecorderOptions = {};
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
        options = { mimeType: "video/webm;codecs=vp9,opus" };
      } else if (MediaRecorder.isTypeSupported("video/webm")) {
        options = { mimeType: "video/webm" };
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        options = { mimeType: "video/mp4" };
      }
    }

    try {
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/webm";
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          stopCameraStream();
          setCapturedMedia({
            id: `cam-video-${Date.now()}`,
            name: `فيديو-كاميرا-${new Date().toLocaleTimeString("en-GB").replace(/:/g, "-")}.${ext}`,
            mimeType,
            size: blob.size,
            kind: "video",
            dataUrl,
            createdAt: new Date().toISOString(),
          });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(250);
      setIsRecordingVideo(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start video recorder:", err);
      setCameraErrorMsg("تعذر بدء تسجيل الفيديو على هذا الجهاز.");
    }
  };

  const stopVideoRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingVideo(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const sendCapturedCameraMedia = () => {
    if (!capturedMedia || (!selectedEmployee && !selectedGroupRoom)) return;
    handleSendMessage(undefined, [capturedMedia], cameraCaption);
    closeCameraModal();
  };

  // Shared attachments in current conversation
  const sharedConversationAttachments = useMemo(() => {
    return activeConversationMessages.flatMap((m) =>
      (m.attachments || []).map((att) => ({
        ...att,
        senderName: m.senderName,
        sentAt: m.createdAt,
      })),
    );
  }, [activeConversationMessages]);

  if (!isMounted || isHiddenRoute) {
    return null;
  }

  const renderAttachmentIcon = (att: MessengerAttachment) => {
    const ext = getFileExtensionBadge(att.name).toLowerCase();
    if (att.kind === "image") return <ImageIcon className="h-5 w-5 text-sky-500" />;
    if (att.kind === "video") return <Video className="h-5 w-5 text-purple-500" />;
    if (att.kind === "audio") return <FileAudio className="h-5 w-5 text-amber-500" />;
    if (["xls", "xlsx", "csv"].includes(ext))
      return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
      return <FileArchive className="h-5 w-5 text-orange-500" />;
    if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext))
      return <FileText className="h-5 w-5 text-rose-500" />;
    return <FileIcon className="h-5 w-5 text-blue-500" />;
  };

  // ============================================================================
  // IN-CHAT NEW MESSAGE NOTIFICATION BANNER (Displayed ONLY Inside Chat Box)
  // ============================================================================
  const renderInChatNotificationBanner = () => {
    if (!incomingToastMsg) return null;
    return (
      <div
        dir="rtl"
        onClick={() => {
          if (incomingToastMsg.isGroupMessage) {
            setContactListMode("groups");
            setSelectedEmployeeId(null);
            setSelectedGroupRoomId(incomingToastMsg.conversationKey);
          } else {
            setContactListMode("direct");
            setSelectedGroupRoomId(null);
            setSelectedEmployeeId(incomingToastMsg.senderId);
          }
          setIncomingToastMsg(null);
        }}
        className="mx-3 mt-2.5 mb-1 bg-amber-50 border-2 border-[#0084FF] rounded-2xl p-2.5 shadow-md cursor-pointer hover:bg-amber-100/80 transition-all z-30 text-black"
      >
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "h-9 w-9 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs",
              getAvatarGradient(incomingToastMsg.senderId),
            )}
          >
            {getInitials(incomingToastMsg.senderName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-black text-[#006AFF] flex items-center gap-1">
                <Bell size={11} className="animate-bounce" />
                {incomingToastMsg.isConfidentialSalary
                  ? `💰 تم إصدار كشف مرتبات لشهر ${incomingToastMsg.salarySlip?.month || ""}`
                  : incomingToastMsg.isBroadcast
                    ? "📢 تنبيه: رسالة جماعية جديدة"
                    : "🔔 تنبيه: رسالة جديدة واردة"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIncomingToastMsg(null);
                }}
                className="text-black/60 hover:text-black"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex items-baseline gap-1.5 truncate mt-0.5">
              <span className="font-black text-xs text-black truncate">
                {incomingToastMsg.senderName}
              </span>
              <span className="text-[10px] font-bold text-black/70 shrink-0">
                • {incomingToastMsg.senderJobTitle}
              </span>
            </div>
            <p className="text-[11px] text-black truncate mt-0.5 font-bold">
              {incomingToastMsg.text || "📎 أرسل مرفقاً جديداً"}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // FLOATING MESSENGER LAUNCHER BUTTON (Right Side - Closed State)
  // ============================================================================
  if (!isOpen) {
    return (
      <div className="fixed bottom-5 right-5 z-50" dir="rtl">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            if (incomingToastMsg) {
              if (incomingToastMsg.isGroupMessage) {
                setContactListMode("groups");
                setSelectedEmployeeId(null);
                setSelectedGroupRoomId(incomingToastMsg.conversationKey);
              } else {
                setContactListMode("direct");
                setSelectedGroupRoomId(null);
                setSelectedEmployeeId(incomingToastMsg.senderId);
              }
            }
          }}
          className="group relative flex flex-col items-stretch rounded-3xl bg-gradient-to-tr from-[#006AFF] via-[#0084FF] to-[#00C6FF] p-3.5 pr-4 pl-5 text-white shadow-[0_10px_30px_rgba(0,132,255,0.45)] hover:shadow-[0_14px_36px_rgba(0,132,255,0.6)] hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer border border-white/25 max-w-xs"
          title="فتح محادثات الزملاء (Messenger)"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-xs shrink-0">
              <MessageCircle className="h-6 w-6 fill-white text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-[#0078FF]" />
            </div>
            <div className="text-right hidden sm:block min-w-0" suppressHydrationWarning>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight">ماسنجر الزملاء</span>
                <span className="text-[10px] font-extrabold bg-white/20 px-1.5 py-0.5 rounded-full">
                  أونلاين
                </span>
              </div>
              <p className="text-[11px] text-blue-100 font-semibold truncate max-w-[180px]" suppressHydrationWarning>
                {currentSenderEmployee.name} •{" "}
                <span className="opacity-90">#{currentSenderEmployee.employee_code}</span>
              </p>
            </div>
          </div>

          {/* In-Box Notification Preview inside the Chat Widget Button */}
          {incomingToastMsg && (
            <div className="mt-2 pt-2 border-t border-white/25 flex items-center gap-2 text-right bg-white rounded-xl px-2.5 py-1.5 text-black shadow-xs">
              <Bell size={13} className="text-[#006AFF] animate-bounce shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black text-[#006AFF] truncate">
                  رسالة جديدة من {incomingToastMsg.senderName}
                </p>
                <p className="text-[11px] font-bold text-black truncate">
                  {incomingToastMsg.text || "📎 مرفق جديد"}
                </p>
              </div>
            </div>
          )}

          {totalUnreadCount > 0 && (
            <span className="absolute -top-2 -left-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-black text-white shadow-md ring-2 ring-white animate-bounce">
              {totalUnreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  // ============================================================================
  // RENDER EMPLOYEE & GROUPS LIST PANE (Contacts & Conversations List)
  // ============================================================================
  // ============================================================================
  // RENDER EMPLOYEE & GROUPS LIST PANE (Contacts & Conversations List)
  // ============================================================================
  const renderContactsListPane = () => (
    <div className="flex flex-col h-full bg-white text-black select-none">
      {/* Messenger Top Brand Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-slate-200 bg-gradient-to-l from-[#006AFF]/10 via-[#0084FF]/5 to-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-[#006AFF] to-[#00C6FF] flex items-center justify-center text-white shadow-sm shrink-0">
              <MessageCircle className="h-5 w-5 fill-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-black text-base text-black truncate">
                  الدردشة الداخلية
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#0084FF]/15 text-[#006AFF]">
                  Messenger
                </span>
              </div>
              <p className="text-[11px] text-black/70 font-bold truncate">
                جميع موظفي المؤسسة ({hrEmployees.length})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleSoundMute}
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center transition cursor-pointer",
                isSoundMuted
                  ? "bg-amber-100 text-amber-700"
                  : "hover:bg-slate-100 text-black",
              )}
              title={isSoundMuted ? "تفعيل صوت الإشعارات" : "كتم صوت الإشعارات"}
            >
              {isSoundMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-black transition cursor-pointer"
              title={isMaximized ? "تصغير النافذة" : "ملء الشاشة"}
            >
              {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 rounded-full hover:bg-rose-50 flex items-center justify-center text-black hover:text-rose-600 transition cursor-pointer"
              title="إغلاق"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Fixed Logged-In User Identity Bar (From Users Page — No Manual Switcher) */}
        <div className="mt-2.5">
          <div className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-right">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full bg-gradient-to-br text-white flex items-center justify-center text-[10px] font-black",
                    getAvatarGradient(currentSenderEmployee.id),
                  )}
                >
                  {getInitials(currentSenderEmployee.name)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                <span className="text-xs font-black text-black truncate">
                  {currentSenderEmployee.name}
                </span>
                <span className="text-[10px] font-bold text-[#006AFF] shrink-0">
                  ({currentSenderEmployee.job_title})
                </span>
                {currentSenderEmployee.employee_code && (
                  <span className="text-[10px] font-mono font-black text-black/70 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                    #{currentSenderEmployee.employee_code}
                  </span>
                )}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              أونلاين
            </span>
          </div>
        </div>

        {/* Broadcast / Multi-Recipient Action Button (Permission Gated) */}
        {canSendBroadcast && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                setSelectedBroadcastEmpIds(
                  hrEmployees
                    .filter((e) => e.id !== currentSenderEmployee.id)
                    .map((e) => e.id),
                );
                setIsBroadcastModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-l from-indigo-600 via-[#006AFF] to-sky-500 hover:opacity-95 text-white font-black text-xs shadow-sm transition cursor-pointer"
            >
              <Megaphone size={14} />
              <span>رسالة جماعية / تحديد موظفين معينين</span>
            </button>
          </div>
        )}

        {/* Mode Switcher: Direct Coworkers vs Department Groups */}
        <div className="grid grid-cols-2 gap-1.5 mt-2.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setContactListMode("direct")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer",
              contactListMode === "direct"
                ? "bg-white text-[#006AFF] shadow-2xs"
                : "text-black hover:text-[#006AFF]",
            )}
          >
            <MessageCircle size={13} />
            <span>الزملاء ({hrEmployees.length})</span>
            {totalUnreadCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 rounded-full">
                {totalUnreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setContactListMode("groups")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer",
              contactListMode === "groups"
                ? "bg-white text-[#006AFF] shadow-2xs"
                : "text-black hover:text-[#006AFF]",
            )}
          >
            <Users size={13} />
            <span>مجموعات الأقسام ({departmentGroups.length})</span>
          </button>
        </div>

        {/* Search Input & Department Filter (when in Direct mode) */}
        {contactListMode === "direct" && (
          <>
            <div className="relative mt-2.5">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/60" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو الرقم الوظيفي أو الوظيفة..."
                style={{ color: "#000000" }}
                className="w-full rounded-full bg-white border border-slate-300 pr-9 pl-3 py-2 text-xs font-bold !text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
              />
            </div>

            {departments.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedDept("ALL")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer",
                    selectedDept === "ALL"
                      ? "bg-[#0084FF] text-white shadow-xs"
                      : "bg-slate-100 text-black hover:bg-slate-200",
                  )}
                >
                  الكل ({hrEmployees.length})
                </button>
                {departments.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer",
                      selectedDept === dept
                        ? "bg-[#0084FF] text-white shadow-xs"
                        : "bg-slate-100 text-black hover:bg-slate-200",
                    )}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Horizontal Messenger Active Now Strip (Direct mode) */}
      {contactListMode === "direct" && (
        <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            {hrEmployees.map((emp) => {
              const isSelected = selectedEmployeeId === emp.id && !selectedGroupRoomId;
              const unread = unreadByEmployeeId[emp.id] || 0;
              const online = isEmployeeOnline(emp);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedGroupRoomId(null);
                    setSelectedEmployeeId(emp.id);
                    setShowSharedFilesDrawer(false);
                  }}
                  className="group flex flex-col items-center gap-1 min-w-[64px] max-w-[70px] text-center cursor-pointer"
                >
                  <div className="relative">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-black text-xs shadow-sm transition-transform group-hover:scale-105",
                        getAvatarGradient(emp.id),
                        isSelected && "ring-2 ring-[#0084FF] ring-offset-2",
                      )}
                    >
                      {getInitials(emp.name)}
                    </div>
                    <span
                      title={online ? "أونلاين (متصل)" : "أوفلاين (غير متصل)"}
                      className={cn(
                        "absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white",
                        online ? "bg-emerald-500" : "bg-slate-400",
                      )}
                    />
                    {unread > 0 && (
                      <span className="absolute -top-1 -left-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[10px] font-black text-white flex items-center justify-center ring-2 ring-white">
                        {unread}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-black text-black truncate w-full leading-tight">
                    {emp.name.split(" ")[0]}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-bold truncate w-full -mt-0.5",
                      online ? "text-emerald-700" : "text-slate-500",
                    )}
                  >
                    {online ? "أونلاين" : "أوفلاين"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* List Body: Either Department Groups OR Vertical Employee List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200/80 bg-white">
        {contactListMode === "groups" ? (
          departmentGroups.map((grp) => {
            const isSelected = selectedGroupRoomId === grp.id;
            const lastMsg = lastMessageByGroupId[grp.id];
            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => {
                  setSelectedEmployeeId(null);
                  setSelectedGroupRoomId(grp.id);
                  setShowSharedFilesDrawer(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 text-right transition cursor-pointer",
                  isSelected ? "bg-[#0084FF]/10" : "hover:bg-slate-50",
                )}
              >
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      "h-12 w-12 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center font-black text-sm shadow-xs",
                      grp.department === "ALL"
                        ? "from-[#006AFF] to-indigo-600"
                        : getAvatarGradient(grp.id),
                    )}
                  >
                    <Users size={20} />
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black ring-2 ring-white">
                    {grp.memberCount}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm text-black truncate">
                      {grp.name}
                    </span>
                    {lastMsg && (
                      <span className="text-[10px] font-bold text-black/60 shrink-0">
                        {formatRelativeTimeAr(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-[#006AFF] truncate mt-0.5">
                    {grp.subtitle} ({grp.memberCount} موظف)
                  </p>
                  <p className="text-xs text-black/80 font-semibold truncate mt-0.5">
                    {lastMsg
                      ? `${lastMsg.senderName.split(" ")[0]}: ${lastMsg.text || "📎 مرفق"}`
                      : "اضغط لفتح محادثة المجموعة ومشاركة الملفات"}
                  </p>
                </div>
              </button>
            );
          })
        ) : filteredEmployees.length === 0 ? (
          <div className="py-12 px-4 text-center text-black/60">
            <p className="font-bold text-sm text-black">لا يوجد موظفون مطابقون للبحث</p>
            <p className="text-xs mt-1">يمكنك إضافة أو تعديل الموظفين من صفحة الموارد البشرية</p>
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isSelected = selectedEmployeeId === emp.id && !selectedGroupRoomId;
            const lastMsg = lastMessageByEmployeeId[emp.id];
            const unread = unreadByEmployeeId[emp.id] || 0;
            const isSelf = emp.id === currentSenderEmployee.id;
            const online = isEmployeeOnline(emp);

            let lastPreview = `ابدأ المحادثة مع ${emp.name.split(" ")[0]}...`;
            if (lastMsg) {
              const prefix = lastMsg.senderId === currentSenderEmployee.id ? "أنت: " : "";
              if (lastMsg.isConfidentialSalary) {
                lastPreview = `${prefix}💰 تم إصدار كشف مرتبات لشهر ${lastMsg.salarySlip?.month || ""}`;
              } else if (lastMsg.text) {
                lastPreview = `${prefix}${lastMsg.text}`;
              } else if (lastMsg.attachments?.length) {
                const firstAtt = lastMsg.attachments[0];
                const kindLabel =
                  firstAtt.kind === "image"
                    ? "📷 صورة"
                    : firstAtt.kind === "video"
                      ? "🎥 فيديو"
                      : firstAtt.kind === "audio"
                        ? "🎤 رسالة صوتية"
                        : `📎 ملف (${firstAtt.name})`;
                lastPreview = `${prefix}${kindLabel}`;
              }
            }

            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => {
                  setSelectedGroupRoomId(null);
                  setSelectedEmployeeId(emp.id);
                  setShowSharedFilesDrawer(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-right transition cursor-pointer",
                  isSelected ? "bg-[#0084FF]/10" : "hover:bg-slate-50",
                )}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      "h-12 w-12 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-black text-sm shadow-xs",
                      getAvatarGradient(emp.id),
                    )}
                  >
                    {getInitials(emp.name)}
                  </div>
                  <span
                    title={online ? "أونلاين (متصل)" : "أوفلاين (غير متصل)"}
                    className={cn(
                      "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-white",
                      online ? "bg-emerald-500" : "bg-slate-400",
                    )}
                  />
                </div>

                {/* Employee Full Name + Small Job Title + Online/Offline Badge + Preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                      <span className="text-sm font-black text-black truncate">
                        {emp.name}
                      </span>
                      <span className="text-[10px] font-bold text-[#006AFF] bg-[#0084FF]/10 px-1.5 py-0.5 rounded-md shrink-0">
                        {emp.job_title}
                      </span>
                      {emp.employee_code && (
                        <span className="text-[9px] font-mono font-bold text-black/70 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          #{emp.employee_code}
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">
                          أنت
                        </span>
                      )}
                    </div>
                    {lastMsg && (
                      <span className="text-[10px] font-bold text-black/60 shrink-0">
                        {formatRelativeTimeAr(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p
                      className={cn(
                        "text-xs truncate",
                        unread > 0 ? "font-black text-black" : "font-semibold text-black/80",
                      )}
                    >
                      {lastPreview}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded-full",
                          online
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {online ? "● أونلاين" : "○ أوفلاين"}
                      </span>
                      {unread > 0 && (
                        <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#0084FF] text-white text-[10px] font-black flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ============================================================================
  // RENDER ACTIVE CONVERSATION PANE (1-on-1 OR Department Group Chat)
  // ============================================================================
  const renderConversationPane = () => {
    if (!selectedEmployee && !selectedGroupRoom) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-50/70 dark:bg-slate-950/50 p-6 text-center select-none">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-tr from-[#006AFF] to-[#00C6FF] text-white flex items-center justify-center shadow-lg mb-3">
            <MessageCircle className="h-8 w-8 fill-white" />
          </div>
          <h3 className="font-black text-base text-slate-800 dark:text-slate-100">
            ماسنجر الزملاء الداخلي
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 leading-relaxed">
            اختر أي موظف أو مجموعة قسم من القائمة لبدء المحادثة الفورية، إرسال الملاحظات الصوتية،
            أو مشاركة كافة أنواع الملفات والصور والفيديو مباشرة من الكاميرا.
          </p>
        </div>
      );
    }

    const isGroup = Boolean(selectedGroupRoom);
    const isPeerOnline = isGroup ? true : isEmployeeOnline(selectedEmployee);
    const chatTitle = isGroup ? selectedGroupRoom!.name : selectedEmployee!.name;
    const chatJobBadge = isGroup
      ? `${selectedGroupRoom!.memberCount} عضو`
      : selectedEmployee!.job_title;
    const chatSubtitle = isGroup
      ? selectedGroupRoom!.subtitle
      : `${selectedEmployee!.department}${selectedEmployee?.employee_code ? ` • #${selectedEmployee.employee_code}` : ""}`;

    return (
      <div
        className="relative flex flex-col h-full bg-[#F8FAFC] text-black"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingFiles(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingFiles(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingFiles(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await processFilesToAttachments(e.dataTransfer.files, setStagedAttachments);
          }
        }}
      >
        {/* Drag-and-drop file overlay */}
        {isDraggingFiles && (
          <div className="absolute inset-2 z-30 rounded-2xl border-2 border-dashed border-[#0084FF] bg-[#0084FF]/10 backdrop-blur-xs flex flex-col items-center justify-center text-[#006AFF] pointer-events-none">
            <Paperclip className="h-10 w-10 mb-2 animate-bounce" />
            <p className="font-black text-sm">أفلت الملفات هنا لإرفاقها في المحادثة</p>
            <p className="text-xs font-semibold opacity-80">يدعم جميع أنواع الملفات والصور والفيديو</p>
          </div>
        )}

        {/* Chat Header */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border-b border-slate-200 shadow-2xs z-10 text-black">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setSelectedEmployeeId(null);
                setSelectedGroupRoomId(null);
              }}
              className={cn(
                "h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-black transition cursor-pointer shrink-0",
                isMaximized && "md:hidden",
              )}
              title="العودة لقائمة الزملاء"
            >
              <ArrowRight size={18} />
            </button>

            <div className="relative shrink-0">
              <div
                className={cn(
                  "h-10 w-10 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-black text-xs shadow-xs",
                  getAvatarGradient(isGroup ? selectedGroupRoom!.id : selectedEmployee!.id),
                )}
              >
                {isGroup ? <Users size={18} /> : getInitials(selectedEmployee!.name)}
              </div>
              <span
                className={cn(
                  "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                  isPeerOnline ? "bg-emerald-500" : "bg-slate-400",
                )}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <h3 className="font-black text-sm text-black truncate">
                  {chatTitle}
                </h3>
                <span className="text-[10px] font-extrabold text-[#006AFF] bg-[#0084FF]/10 px-1.5 py-0.5 rounded-md shrink-0">
                  {chatJobBadge}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-black/75 font-bold">
                {isPeerOnline ? (
                  <span className="text-emerald-700 font-black">● أونلاين (متصل الآن)</span>
                ) : (
                  <span className="text-slate-500 font-bold">○ أوفلاين (غير متصل)</span>
                )}
                <span>•</span>
                <span className="truncate">{chatSubtitle}</span>
              </div>
            </div>
          </div>

          {/* Header Quick Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCameraMode("photo");
                void requestAndOpenCamera("photo", facingMode);
              }}
              className="h-8 w-8 rounded-full hover:bg-[#0084FF]/10 text-[#006AFF] flex items-center justify-center transition cursor-pointer"
              title="التقاط صورة مباشرة من الكاميرا"
            >
              <Camera size={17} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraMode("video");
                void requestAndOpenCamera("video", facingMode);
              }}
              className="h-8 w-8 rounded-full hover:bg-[#0084FF]/10 text-[#006AFF] flex items-center justify-center transition cursor-pointer"
              title="تسجيل فيديو مباشر من الكاميرا"
            >
              <Video size={17} />
            </button>
            <button
              type="button"
              onClick={() => setShowSharedFilesDrawer((prev) => !prev)}
              className={cn(
                "relative h-8 w-8 rounded-full flex items-center justify-center transition cursor-pointer",
                showSharedFilesDrawer
                  ? "bg-[#0084FF] text-white"
                  : "hover:bg-[#0084FF]/10 text-[#006AFF]",
              )}
              title="استعراض الملفات والوسائط المشتركة في هذه المحادثة"
            >
              <FolderOpen size={16} />
              {sharedConversationAttachments.length > 0 && (
                <span className="absolute -top-1 -left-1 h-4 min-w-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">
                  {sharedConversationAttachments.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 rounded-full hover:bg-rose-50 text-black hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
              title="إغلاق النافذة"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Shared Files Drawer (if toggled) */}
        {showSharedFilesDrawer && (
          <div className="bg-white border-b border-slate-200 p-3 max-h-56 overflow-y-auto shadow-md z-20 text-black">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-black">
                الملفات والوسائط المشتركة ({sharedConversationAttachments.length})
              </span>
              <button
                type="button"
                onClick={() => setShowSharedFilesDrawer(false)}
                className="text-xs font-bold text-[#006AFF] hover:underline cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            {sharedConversationAttachments.length === 0 ? (
              <p className="text-xs text-black/60 py-4 text-center">
                لم يتم إرسال أي ملفات أو صور في هذه المحادثة بعد
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sharedConversationAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {renderAttachmentIcon(att)}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-black truncate">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-black/60">
                          {formatFileSize(att.size)} • بواسطة {att.senderName}
                        </p>
                      </div>
                    </div>
                    <a
                      href={att.dataUrl}
                      download={att.name}
                      className="h-7 w-7 rounded-lg bg-[#0084FF]/10 text-[#006AFF] hover:bg-[#0084FF] hover:text-white flex items-center justify-center shrink-0 transition"
                      title="تحميل الملف"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-white">
          {/* Top Profile Card inside Conversation */}
          <div className="flex flex-col items-center text-center py-4">
            <div
              className={cn(
                "h-16 w-16 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-black text-lg shadow-md mb-2",
                getAvatarGradient(isGroup ? selectedGroupRoom!.id : selectedEmployee!.id),
              )}
            >
              {isGroup ? <Users size={28} /> : getInitials(selectedEmployee!.name)}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <h4 className="font-black text-sm text-black">{chatTitle}</h4>
              <span className="text-[11px] font-bold text-[#006AFF] bg-[#0084FF]/10 px-2 py-0.5 rounded-full">
                {chatJobBadge}
              </span>
            </div>
            <p className="text-[11px] text-black/70 font-semibold mt-0.5">{chatSubtitle}</p>
          </div>

          {activeConversationMessages.map((msg) => {
            const isMine = msg.senderId === currentSenderEmployee.id;
            const reactionEntries = Object.entries(msg.reactions || {});

            return (
              <div
                key={msg.id}
                className={cn("group flex flex-col", isMine ? "items-start" : "items-end")}
              >
                {/* Sender Name + Small Job Title above bubble */}
                <div className="flex items-baseline gap-1.5 px-2 mb-1">
                  <span className="text-[11px] font-black text-black">
                    {isMine ? "أنت" : msg.senderName}
                  </span>
                  <span className="text-[9px] font-bold text-black/65">
                    ({msg.senderJobTitle})
                  </span>
                  {msg.isBroadcast && (
                    <span className="text-[9px] font-black bg-amber-500/15 text-amber-800 px-1.5 py-0.2 rounded-full">
                      📢 رسالة جماعية
                    </span>
                  )}
                </div>

                <div
                  className={cn(
                    "relative flex items-end gap-1.5 max-w-[88%]",
                    isMine ? "flex-row" : "flex-row-reverse",
                  )}
                >
                  {/* Small Avatar for recipient */}
                  {!isMine && (
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-black text-[10px] shrink-0 mb-1 shadow-2xs",
                        getAvatarGradient(msg.senderId),
                      )}
                    >
                      {getInitials(msg.senderName)}
                    </div>
                  )}

                  {/* Message Bubble (Black Text on White/Light Background) */}
                  <div
                    style={!msg.isConfidentialSalary ? { color: "#000000" } : undefined}
                    className={cn(
                      "relative rounded-2xl px-3.5 py-2.5 shadow-2xs transition",
                      msg.isConfidentialSalary
                        ? "bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white border-2 border-emerald-400/50 rounded-br-xs"
                        : isMine
                          ? "bg-[#E3F2FD] !text-black border border-[#0084FF]/35 rounded-br-xs"
                          : "bg-slate-100 !text-black border border-slate-300 rounded-bl-xs",
                    )}
                  >
                    {/* Salary Slip Card Rendering */}
                    {msg.isConfidentialSalary && msg.salarySlip ? (
                      <div className="space-y-2 min-w-[240px] sm:min-w-[290px]">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-400/30">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span className="font-black text-xs text-emerald-300">
                              تم إصدار كشف مرتبات لشهر {msg.salarySlip.month} وتفاصيله الآتي:
                            </span>
                          </div>
                        </div>

                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-emerald-200/80">الموظف:</span>
                            <span className="font-black">{msg.receiverName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-200/80">الراتب الأساسي:</span>
                            <span className="font-mono font-bold">
                              {msg.salarySlip.basicSalary.toLocaleString()}{" "}
                              {msg.salarySlip.currency}
                            </span>
                          </div>
                          {msg.salarySlip.bonuses > 0 && (
                            <div className="flex justify-between text-emerald-300">
                              <span>الإضافي والبدلات:</span>
                              <span className="font-mono font-bold">
                                +{msg.salarySlip.bonuses.toLocaleString()} {msg.salarySlip.currency}
                              </span>
                            </div>
                          )}
                          {msg.salarySlip.deductions > 0 && (
                            <div className="flex justify-between text-rose-300">
                              <span>خصومات الغياب والتأخير:</span>
                              <span className="font-mono font-bold">
                                -{msg.salarySlip.deductions.toLocaleString()}{" "}
                                {msg.salarySlip.currency}
                              </span>
                            </div>
                          )}
                          {msg.salarySlip.loanDeduction > 0 && (
                            <div className="flex justify-between text-amber-300">
                              <span>استقطاع قسط السلفة:</span>
                              <span className="font-mono font-bold">
                                -{msg.salarySlip.loanDeduction.toLocaleString()}{" "}
                                {msg.salarySlip.currency}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-1.5 mt-1 border-t border-emerald-400/30 text-sm font-black text-emerald-300">
                            <span>صافي الراتب المستحق:</span>
                            <span className="font-mono bg-emerald-500/25 px-2 py-0.5 rounded-lg">
                              {msg.salarySlip.netSalary.toLocaleString()} {msg.salarySlip.currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Reply Preview inside Bubble */}
                        {msg.replyTo && (
                          <div
                            className={cn(
                              "mb-2 rounded-xl px-2.5 py-1.5 text-[11px] border-r-2",
                              isMine
                                ? "bg-white/15 border-white text-blue-50"
                                : "bg-slate-100 dark:bg-slate-700/70 border-[#0084FF] text-slate-600 dark:text-slate-300",
                            )}
                          >
                            <p className="font-black text-[10px] opacity-90">
                              رداً على {msg.replyTo.senderName}
                            </p>
                            <p className="truncate opacity-85">{msg.replyTo.text}</p>
                          </div>
                        )}

                        {/* Attachments Grid inside Bubble */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="space-y-2 mb-1.5">
                            {msg.attachments.map((att) => {
                              if (att.kind === "image") {
                                return (
                                  <div
                                    key={att.id}
                                    className="relative group/img rounded-xl overflow-hidden bg-black/10 max-w-[260px]"
                                  >
                                    <img
                                      src={att.dataUrl}
                                      alt={att.name}
                                      onClick={() => setLightboxImage(att)}
                                      className="max-h-60 w-full object-cover cursor-zoom-in hover:opacity-95 transition"
                                    />
                                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition">
                                      <button
                                        type="button"
                                        onClick={() => setLightboxImage(att)}
                                        className="h-7 w-7 rounded-lg bg-black/65 text-white flex items-center justify-center cursor-pointer"
                                        title="تكبير الصورة"
                                      >
                                        <Eye size={13} />
                                      </button>
                                      <a
                                        href={att.dataUrl}
                                        download={att.name}
                                        className="h-7 w-7 rounded-lg bg-black/65 text-white flex items-center justify-center"
                                        title="تحميل الصورة"
                                      >
                                        <Download size={13} />
                                      </a>
                                    </div>
                                  </div>
                                );
                              }

                              if (att.kind === "video") {
                                return (
                                  <div
                                    key={att.id}
                                    className="rounded-xl overflow-hidden bg-black max-w-[270px]"
                                  >
                                    <video
                                      src={att.dataUrl}
                                      controls
                                      playsInline
                                      className="max-h-60 w-full"
                                    />
                                    <div className="flex items-center justify-between px-2.5 py-1 bg-black/80 text-white text-[10px]">
                                      <span className="truncate max-w-[170px]">{att.name}</span>
                                      <a
                                        href={att.dataUrl}
                                        download={att.name}
                                        className="text-sky-400 hover:underline flex items-center gap-1 shrink-0"
                                      >
                                        <Download size={11} /> حفظ
                                      </a>
                                    </div>
                                  </div>
                                );
                              }

                              if (att.kind === "audio") {
                                return (
                                  <div
                                    key={att.id}
                                    className={cn(
                                      "p-2.5 rounded-xl min-w-[230px]",
                                      isMine
                                        ? "bg-white/15"
                                        : "bg-slate-100 dark:bg-slate-700/70",
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-1.5 mb-1 text-[11px] font-bold">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Mic size={13} className="shrink-0" />
                                        <span className="truncate">{att.name}</span>
                                      </div>
                                      <a
                                        href={att.dataUrl}
                                        download={att.name}
                                        className="opacity-80 hover:opacity-100"
                                        title="تحميل المقطع الصوتي"
                                      >
                                        <Download size={12} />
                                      </a>
                                    </div>
                                    <audio src={att.dataUrl} controls className="w-full h-8" />
                                  </div>
                                );
                              }

                              // Universal File Card (PDF, Excel, Word, ZIP, Access, SQL, etc.)
                              return (
                                <div
                                  key={att.id}
                                  className={cn(
                                    "flex items-center justify-between gap-2.5 p-2.5 rounded-xl border min-w-[220px] max-w-[280px]",
                                    isMine
                                      ? "bg-white/15 border-white/25 text-white"
                                      : "bg-slate-50 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100",
                                  )}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={cn(
                                        "h-10 w-10 rounded-xl flex flex-col items-center justify-center shrink-0 font-black text-[9px]",
                                        isMine
                                          ? "bg-white text-[#006AFF]"
                                          : "bg-[#0084FF]/10 text-[#006AFF]",
                                      )}
                                    >
                                      {renderAttachmentIcon(att)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-extrabold truncate">{att.name}</p>
                                      <div className="flex items-center gap-1.5 text-[10px] opacity-80">
                                        <span className="font-mono font-bold">
                                          {getFileExtensionBadge(att.name)}
                                        </span>
                                        <span>•</span>
                                        <span>{formatFileSize(att.size)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <a
                                    href={att.dataUrl}
                                    download={att.name}
                                    className={cn(
                                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition",
                                      isMine
                                        ? "bg-white/20 hover:bg-white text-white hover:text-[#006AFF]"
                                        : "bg-[#0084FF]/10 hover:bg-[#0084FF] text-[#006AFF] hover:text-white",
                                    )}
                                    title="تنزيل الملف"
                                  >
                                    <Download size={15} />
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Message Text */}
                        {msg.text && (
                          <p
                            style={{ color: "#000000" }}
                            className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words font-bold !text-black"
                          >
                            {msg.text}
                          </p>
                        )}
                      </>
                    )}

                    {/* Timestamp & Read Status */}
                    <div
                      className={cn(
                        "flex items-center justify-end gap-1 mt-1 text-[9px] font-bold",
                        msg.isConfidentialSalary ? "text-emerald-200" : "text-black/65",
                      )}
                    >
                      <span>{formatRelativeTimeAr(msg.createdAt)}</span>
                      {isMine && (
                        <CheckCheck
                          size={12}
                          className={cn(
                            msg.readByReceiver ? "text-emerald-600" : "text-black/50",
                          )}
                        />
                      )}
                    </div>

                    {/* Reactions Pill */}
                    {reactionEntries.length > 0 && (
                      <div
                        className={cn(
                          "absolute -bottom-2.5 flex items-center gap-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 shadow-xs text-[11px]",
                          isMine ? "left-2" : "right-2",
                        )}
                      >
                        {reactionEntries.map(([uid, emoji]) => (
                          <span key={uid}>{emoji}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message Hover Actions (React, Reply, Delete) */}
                  <div className="relative flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveReactionMsgId((prev) => (prev === msg.id ? null : msg.id))
                      }
                      className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
                      title="تفاعل"
                    >
                      <Smile size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(msg)}
                      className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
                      title="رد على الرسالة"
                    >
                      <Reply size={13} />
                    </button>
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="h-6 w-6 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/50 flex items-center justify-center text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="حذف الرسالة"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}

                    {/* Quick Reaction Picker */}
                    {activeReactionMsgId === msg.id && (
                      <div
                        className={cn(
                          "absolute bottom-7 z-20 flex items-center gap-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 shadow-lg",
                          isMine ? "left-0" : "right-0",
                        )}
                      >
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className="hover:scale-125 transition text-sm cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Replying To Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="min-w-0 border-r-2 border-[#0084FF] pr-2">
              <p className="font-black text-[#006AFF] dark:text-sky-400 text-[11px]">
                الرد على {replyingTo.senderName}
              </p>
              <p className="text-slate-600 dark:text-slate-300 truncate text-[11px]">
                {replyingTo.text || "📎 مرفق"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Staged Attachments Preview Bar (Before Sending) */}
        {stagedAttachments.length > 0 && (
          <div className="px-3 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-[#006AFF] dark:text-sky-400">
                المرفقات الجاهزة للإرسال ({stagedAttachments.length})
              </span>
              <button
                type="button"
                onClick={() => setStagedAttachments([])}
                className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
              >
                إزالة الكل
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {stagedAttachments.map((att) => (
                <div
                  key={att.id}
                  className="relative flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 pr-2 min-w-[140px] max-w-[200px] shrink-0"
                >
                  {att.kind === "image" ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="h-9 w-9 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
                      {renderAttachmentIcon(att)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
                      {att.name}
                    </p>
                    <p className="text-[9px] text-slate-400">{formatFileSize(att.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setStagedAttachments((prev) => prev.filter((item) => item.id !== att.id))
                    }
                    className="h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] shrink-0 cursor-pointer"
                    title="حذف المرفق"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messenger Bottom Composer Bar */}
        <form
          onSubmit={(e) => handleSendMessage(e)}
          className="flex items-center gap-1.5 p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800"
        >
          {/* Universal File Input (accepts ALL file types) */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {isRecordingVoice ? (
            /* Live Voice Recording Bar (Suggestion 1) */
            <div className="flex-1 flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-full px-3.5 py-1.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-600 animate-ping" />
                <span className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono">
                  {String(Math.floor(voiceRecordingSeconds / 60)).padStart(2, "0")}:
                  {String(voiceRecordingSeconds % 60).padStart(2, "0")}
                </span>
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  جاري تسجيل رسالة صوتية...
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cancelVoiceNoteRecording}
                  className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold hover:text-rose-600 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={finishAndSendVoiceNote}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-tr from-[#006AFF] to-[#00C6FF] text-white text-[11px] font-black shadow-xs cursor-pointer"
                >
                  <Send size={12} />
                  <span>إرسال الصوت</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Attach Any File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 rounded-full hover:bg-[#0084FF]/10 text-[#006AFF] dark:text-sky-400 flex items-center justify-center transition cursor-pointer shrink-0"
                title="إرفاق ملفات (صور، فيديو، PDF، إكسيل، وورد، مضغوط، وجميع أنواع الملفات)"
              >
                <Paperclip size={18} />
              </button>

              {/* Open Camera Photo Button */}
              <button
                type="button"
                onClick={() => {
                  setCameraMode("photo");
                  void requestAndOpenCamera("photo", facingMode);
                }}
                className="h-9 w-9 rounded-full hover:bg-[#0084FF]/10 text-[#006AFF] dark:text-sky-400 flex items-center justify-center transition cursor-pointer shrink-0"
                title="فتح الكاميرا لالتقاط صورة أو تسجيل فيديو مباشر"
              >
                <Camera size={18} />
              </button>

              {/* Record Quick Voice Note Button (Suggestion 1) */}
              <button
                type="button"
                onClick={startVoiceNoteRecording}
                className="h-9 w-9 rounded-full hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center transition cursor-pointer shrink-0"
                title="تسجيل رسالة صوتية سريعة (Voice Note)"
              >
                <Mic size={18} />
              </button>

              {/* Message Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`اكتب رسالة إلى ${
                  isGroup ? selectedGroupRoom!.name : selectedEmployee!.name.split(" ")[0]
                }...`}
                style={{ color: "#000000" }}
                className="flex-1 rounded-full bg-white border border-slate-300 px-4 py-2 text-xs sm:text-sm font-bold !text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() && stagedAttachments.length === 0}
                className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#006AFF] to-[#0084FF] hover:opacity-95 disabled:opacity-40 text-white flex items-center justify-center shadow-xs transition cursor-pointer shrink-0"
                title="إرسال"
              >
                <Send size={16} />
              </button>
            </>
          )}
        </form>
      </div>
    );
  };

  return (
    <>
      {/* Main Messenger Window (Right Side) */}
      <div
        dir="rtl"
        style={{ color: "#000000" }}
        className={cn(
          "fixed z-50 bg-white text-black border border-slate-300 shadow-[0_20px_60px_rgba(0,0,0,0.28)] overflow-hidden transition-all duration-200 flex flex-col",
          isMaximized
            ? "inset-2 sm:inset-4 rounded-3xl"
            : "bottom-4 right-4 w-[calc(100vw-2rem)] sm:w-[430px] h-[630px] max-h-[calc(100vh-2rem)] rounded-3xl",
        )}
      >
        {/* New Message Notification Alert ONLY Inside the Chat Box */}
        {renderInChatNotificationBanner()}

        <div className="flex-1 min-h-0 overflow-hidden">
          {isMaximized ? (
            <div className="grid grid-cols-1 md:grid-cols-12 h-full overflow-hidden">
              <div
                className={cn(
                  "md:col-span-4 lg:col-span-4 border-l border-slate-200 h-full overflow-hidden",
                  (selectedEmployee || selectedGroupRoom) ? "hidden md:block" : "block",
                )}
              >
                {renderContactsListPane()}
              </div>
              <div
                className={cn(
                  "md:col-span-8 lg:col-span-8 h-full overflow-hidden",
                  (selectedEmployee || selectedGroupRoom) ? "block" : "hidden md:block",
                )}
              >
                {renderConversationPane()}
              </div>
            </div>
          ) : (selectedEmployee || selectedGroupRoom) ? (
            renderConversationPane()
          ) : (
            renderContactsListPane()
          )}
        </div>
      </div>

      {/* ============================================================================ */}
      {/* BROADCAST / MULTI-USER SELECTION MODAL */}
      {/* ============================================================================ */}
      {isBroadcastModalOpen && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-l from-indigo-600 via-[#006AFF] to-sky-500 text-white">
              <div className="flex items-center gap-2.5">
                <Megaphone className="h-5 w-5" />
                <div>
                  <h3 className="font-black text-sm">
                    إرسال رسالة جماعية أو لمستخدمين محددين
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    بصفتك: {currentSenderEmployee.name} ({currentSenderEmployee.job_title})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSendBroadcastMessages}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {/* Target Mode Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setBroadcastTargetMode("all")}
                  className={cn(
                    "py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer",
                    broadcastTargetMode === "all"
                      ? "bg-[#006AFF] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300",
                  )}
                >
                  📢 جميع الموظفين ({hrEmployees.filter((e) => e.id !== currentSenderEmployee.id).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastTargetMode("selected")}
                  className={cn(
                    "py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer",
                    broadcastTargetMode === "selected"
                      ? "bg-[#006AFF] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300",
                  )}
                >
                  ☑️ تحديد موظفين معينين ({selectedBroadcastEmpIds.length})
                </button>
              </div>

              {/* Multi-User Selection Checklist */}
              {broadcastTargetMode === "selected" && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      اختر الموظفين المستلمين:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedBroadcastEmpIds(
                            hrEmployees
                              .filter((e) => e.id !== currentSenderEmployee.id)
                              .map((e) => e.id),
                          )
                        }
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#0084FF]/10 text-[#006AFF] hover:bg-[#0084FF]/20 cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBroadcastEmpIds([])}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 cursor-pointer"
                      >
                        إلغاء الكل
                      </button>
                      {departments.map((dept) => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() =>
                            setSelectedBroadcastEmpIds(
                              hrEmployees
                                .filter(
                                  (e) =>
                                    e.department === dept &&
                                    e.id !== currentSenderEmployee.id,
                                )
                                .map((e) => e.id),
                            )
                          }
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          قسم {dept}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={broadcastSearch}
                    onChange={(e) => setBroadcastSearch(e.target.value)}
                    placeholder="ابحث عن موظف لتحديده..."
                    style={{ color: "#000000" }}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-1.5 text-xs font-bold !text-black placeholder:text-slate-500"
                  />

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {hrEmployees
                      .filter((e) => e.id !== currentSenderEmployee.id)
                      .filter(
                        (e) =>
                          !broadcastSearch.trim() ||
                          e.name.toLowerCase().includes(broadcastSearch.toLowerCase()) ||
                          e.job_title.toLowerCase().includes(broadcastSearch.toLowerCase()),
                      )
                      .map((emp) => {
                        const checked = selectedBroadcastEmpIds.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className={cn(
                              "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition",
                              checked
                                ? "bg-[#0084FF]/10 text-[#006AFF] font-bold"
                                : "hover:bg-slate-100 text-black",
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBroadcastEmpIds((prev) => [...prev, emp.id]);
                                  } else {
                                    setSelectedBroadcastEmpIds((prev) =>
                                      prev.filter((id) => id !== emp.id),
                                    );
                                  }
                                }}
                                className="rounded accent-[#006AFF]"
                              />
                              <span className="truncate font-bold text-black">{emp.name}</span>
                              <span className="text-[10px] text-black/65 shrink-0">
                                ({emp.job_title})
                              </span>
                            </div>
                            <span className="text-[10px] text-black/65 shrink-0">
                              {emp.department}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Broadcast Message Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black block">
                  نص الرسالة الجماعية / التعميم:
                </label>
                <textarea
                  rows={4}
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="اكتب نص الرسالة أو التعميم الإداري هنا..."
                  style={{ color: "#000000" }}
                  className="w-full rounded-2xl bg-white border border-slate-300 p-3 text-xs sm:text-sm font-bold !text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
                />
              </div>

              {/* Broadcast Attachments */}
              <div className="space-y-2">
                <input
                  ref={broadcastFileInputRef}
                  type="file"
                  multiple
                  accept="*/*"
                  onChange={handleBroadcastFileInputChange}
                  className="hidden"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => broadcastFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold text-[#006AFF] cursor-pointer"
                  >
                    <Paperclip size={14} />
                    <span>إرفاق ملفات أو صور مع الرسالة الجماعية</span>
                  </button>
                  {broadcastAttachments.length > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600">
                      تم إرفاق {broadcastAttachments.length} ملف
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={
                    (!broadcastText.trim() && broadcastAttachments.length === 0) ||
                    (broadcastTargetMode === "selected" &&
                      selectedBroadcastEmpIds.length === 0)
                  }
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-[#006AFF] text-white text-xs font-black shadow-md disabled:opacity-40 cursor-pointer"
                >
                  <Send size={14} />
                  <span>
                    إرسال الآن (
                    {broadcastTargetMode === "all"
                      ? hrEmployees.filter((e) => e.id !== currentSenderEmployee.id).length
                      : selectedBroadcastEmpIds.length}{" "}
                    مستلم)
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* LIVE CAMERA CAPTURE MODAL (Photo & Video with Permission Request) */}
      {/* ============================================================================ */}
      {isCameraOpen && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
        >
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 text-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-[#0084FF]" />
                <div>
                  <h3 className="font-black text-sm">
                    كاميرا الماسنجر المباشرة ({cameraMode === "photo" ? "التقاط صورة" : "تسجيل فيديو"})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    إرسال مباشر إلى{" "}
                    {selectedGroupRoom ? selectedGroupRoom.name : selectedEmployee?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCameraModal}
                className="h-8 w-8 rounded-full bg-slate-800 hover:bg-rose-600 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
              {cameraPermissionState === "requesting" && (
                <div className="flex flex-col items-center gap-3 text-center p-6">
                  <div className="h-12 w-12 rounded-full border-4 border-[#0084FF] border-t-transparent animate-spin" />
                  <p className="font-black text-sm">جاري طلب صلاحية الكاميرا من المتصفح...</p>
                  <p className="text-xs text-slate-400">
                    يرجى الضغط على &quot;سماح / Allow&quot; عند ظهور نافذة المتصفح
                  </p>
                </div>
              )}

              {cameraPermissionState === "denied" && (
                <div className="flex flex-col items-center gap-3 text-center p-6 max-w-sm">
                  <AlertCircle className="h-12 w-12 text-rose-500" />
                  <p className="font-black text-sm text-rose-400">{cameraErrorMsg}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => void requestAndOpenCamera(cameraMode, facingMode)}
                      className="px-4 py-2 rounded-xl bg-[#0084FF] hover:bg-[#006AFF] text-xs font-black text-white transition cursor-pointer"
                    >
                      إعادة طلب الصلاحية
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeCameraModal();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
                    >
                      اختيار من الجهاز بدلاً من ذلك
                    </button>
                  </div>
                </div>
              )}

              {cameraPermissionState === "granted" && !capturedMedia && (
                <>
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      "w-full h-full object-cover",
                      facingMode === "user" && "-scale-x-100",
                    )}
                  />
                  {isRecordingVideo && (
                    <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-rose-600/90 px-3 py-1 text-xs font-black text-white shadow-lg animate-pulse">
                      <span className="h-2.5 w-2.5 rounded-full bg-white" />
                      <span>
                        جاري التسجيل {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                        {String(recordingSeconds % 60).padStart(2, "0")}
                      </span>
                    </div>
                  )}
                </>
              )}

              {capturedMedia && (
                <div className="w-full h-full flex items-center justify-center bg-black">
                  {capturedMedia.kind === "image" ? (
                    <img
                      src={capturedMedia.dataUrl}
                      alt="Captured"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <video
                      src={capturedMedia.dataUrl}
                      controls
                      autoPlay
                      className="max-h-full max-w-full"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="p-4 space-y-3 bg-slate-900">
              {!capturedMedia ? (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchCameraMode("photo")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer",
                        cameraMode === "photo"
                          ? "bg-[#0084FF] text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white",
                      )}
                    >
                      📷 صورة فوتوغرافية
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchCameraMode("video")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer",
                        cameraMode === "video"
                          ? "bg-[#0084FF] text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white",
                      )}
                    >
                      🎥 مقطع فيديو
                    </button>
                  </div>

                  {cameraPermissionState === "granted" && (
                    <div className="flex items-center justify-between px-4 pt-1">
                      <button
                        type="button"
                        onClick={handleSwitchCameraFacing}
                        disabled={isRecordingVideo}
                        className="h-10 w-10 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center text-white transition cursor-pointer"
                        title="تبديل الكاميرا (أمامية / خلفية)"
                      >
                        <SwitchCamera size={18} />
                      </button>

                      {cameraMode === "photo" ? (
                        <button
                          type="button"
                          onClick={capturePhotoFromStream}
                          className="h-16 w-16 rounded-full border-4 border-white bg-[#0084FF] hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition cursor-pointer"
                          title="التقاط الصورة"
                        >
                          <CircleDot className="h-7 w-7 text-white" />
                        </button>
                      ) : !isRecordingVideo ? (
                        <button
                          type="button"
                          onClick={startVideoRecording}
                          className="h-16 w-16 rounded-full border-4 border-white bg-rose-600 hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition cursor-pointer"
                          title="بدء تسجيل الفيديو"
                        >
                          <div className="h-6 w-6 rounded-full bg-white" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopVideoRecording}
                          className="h-16 w-16 rounded-full border-4 border-rose-400 bg-rose-600 hover:scale-105 flex items-center justify-center shadow-lg transition cursor-pointer animate-pulse"
                          title="إيقاف التسجيل"
                        >
                          <Square className="h-6 w-6 fill-white text-white" />
                        </button>
                      )}

                      <div className="w-10" />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={cameraCaption}
                    onChange={(e) => setCameraCaption(e.target.value)}
                    placeholder="أضف تعليقاً أو ملاحظة مع الصورة/الفيديو (اختياري)..."
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void requestAndOpenCamera(cameraMode, facingMode)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
                    >
                      <RotateCcw size={15} />
                      <span>إعادة الالتقاط</span>
                    </button>
                    <button
                      type="button"
                      onClick={sendCapturedCameraMedia}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#006AFF] to-[#00C6FF] hover:opacity-95 text-xs font-black text-white shadow-lg transition cursor-pointer"
                    >
                      <Send size={15} />
                      <span>إرسال الآن في المحادثة</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* FULL-SCREEN IMAGE LIGHTBOX */}
      {/* ============================================================================ */}
      {lightboxImage && (
        <div
          dir="rtl"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center p-4"
        >
          <div className="flex items-center justify-between w-full max-w-4xl mb-3 text-white">
            <span className="font-bold text-sm truncate">{lightboxImage.name}</span>
            <div className="flex items-center gap-2">
              <a
                href={lightboxImage.dataUrl}
                download={lightboxImage.name}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0084FF] text-white text-xs font-bold"
              >
                <Download size={14} /> تحميل
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <img
            src={lightboxImage.dataUrl}
            alt={lightboxImage.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
