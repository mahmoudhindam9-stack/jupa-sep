import React, { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, Check, ChevronDown, Code2, FileCode2, FolderGit2, GitBranch, GitCommit,
  Loader2, Play, RefreshCw, Save, Search, ShieldCheck, Sparkles, TerminalSquare,
  UploadCloud, X,
} from "lucide-react";

type RepoFile = { path: string; sha: string; size: number; type: "blob" };
type OpenFile = { path: string; sha: string; original: string; content: string; aiContent?: string };
type RunInfo = { id: number; name: string; status: string; conclusion: string | null; html_url: string; created_at: string };

const DEFAULT_REPO = "mahmoudhindam9-stack/jupa-sep";
const DEFAULT_BRANCH = "feat/independent-developer-workspace";
const WORKFLOW = "verify-users-page-auth.yml";
const MAX_FILE_BYTES = 800 * 1024;
const MAX_AI_CONTEXT = 45_000;

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function friendlyError(value: any) {
  const message = value?.message || value?.error || String(value || "حدث خطأ غير معروف");
  if (/Bad credentials|Unauthorized/i.test(message)) return "رمز GitHub غير صحيح أو انتهت صلاحيته.";
  if (/Resource not accessible by personal access token/i.test(message)) return "صلاحيات الرمز غير كافية. امنح المستودع صلاحية Contents وActions حسب العملية المطلوبة.";
  if (/Not Found/i.test(message)) return "المستودع أو الفرع أو الملف غير موجود، أو أن الرمز لا يملك صلاحية الوصول إليه.";
  if (/Update is not a fast forward/i.test(message)) return "تغير الفرع من جلسة أخرى. حدّث الملفات وأعد المحاولة؛ لم يتم استبدال التحديث البعيد.";
  return message;
}

export function IndependentCodeWorkspace({ onBackToVisual }: { onBackToVisual: () => void }) {
  const [repo,setRepo]=useState(DEFAULT_REPO);
  const [branch,setBranch]=useState(DEFAULT_BRANCH);
  const [token,setToken]=useState("");
  const [connected,setConnected]=useState(false);
  const [files,setFiles]=useState<RepoFile[]>([]);
  const [openFiles,setOpenFiles]=useState<OpenFile[]>([]);
  const [activePath,setActivePath]=useState("");
  const [filter,setFilter]=useState("");
  const [isLoading,setIsLoading]=useState(false);
  const [isSaving,setIsSaving]=useState(false);
  const [isRunning,setIsRunning]=useState(false);
  const [error,setError]=useState("");
  const [output,setOutput]=useState("جاهز. اتصل بمستودع GitHub لفتح ملفات المشروع.");
  const [prompt,setPrompt]=useState("");
  const [aiAnswer,setAiAnswer]=useState("");
  const [aiSuggestion,setAiSuggestion]=useState("");
  const [isThinking,setIsThinking]=useState(false);
  const [runs,setRuns]=useState<RunInfo[]>([]);
  const [tab,setTab]=useState<"code"|"ai"|"git"|"tests">("code");
  const [commitMessage,setCommitMessage]=useState("");
  const activeFile=openFiles.find(file=>file.path===activePath)||null;
  const dirtyCount=openFiles.filter(file=>file.content!==file.original).length;
  const visibleFiles=useMemo(()=>files.filter(file=>file.path.toLowerCase().includes(filter.trim().toLowerCase())),[files,filter]);

  const github = async (path:string,init:RequestInit={}) => {
    if(!token.trim())throw new Error("أدخل GitHub Token أولًا.");
    const headers = new Headers(init.headers);
    headers.set("Accept","application/vnd.github+json");
    headers.set("Authorization","Bearer "+token.trim());
    headers.set("X-GitHub-Api-Version","2022-11-28");
    if(init.body)headers.set("Content-Type","application/json");
    const response=await fetch("https://api.github.com"+path,{...init,headers,cache:"no-store"});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(friendlyError(body));
    return body;
  };

  const connect = async () => {
    setError("");setIsLoading(true);
    try{
      if(!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo.trim()))throw new Error("اكتب المستودع بصيغة owner/repository.");
      if(!/^[A-Za-z0-9._/-]+$/.test(branch.trim())||branch.includes(".."))throw new Error("اسم الفرع غير صالح.");
      const [repository,ref]=await Promise.all([
        github("/repos/"+repo.trim()),
        github("/repos/"+repo.trim()+"/git/ref/heads/"+encodeURIComponent(branch.trim()).replace(/%2F/g,"/"))
      ]);
      if(repository.archived)throw new Error("هذا المستودع مؤرشف ولا يمكن تعديله.");
      const tree=await github("/repos/"+repo.trim()+"/git/trees/"+ref.object.sha+"?recursive=1");
      if(tree.truncated)throw new Error("المستودع كبير جدًا للفهرسة في جلسة واحدة. استخدم فرعًا أصغر أو ابدأ بمجلد محدد.");
      const entries=(tree.tree||[]).filter((item:any)=>item.type==="blob"&&Number(item.size||0)<=MAX_FILE_BYTES&&!/(^|\/)(node_modules|dist|build|coverage|\.git|\.next|\.turbo|\.cache|vendor)(\/|$)/i.test(item.path)&&!/\.(png|jpe?g|gif|webp|ico|pdf|mp4|mp3|zip|woff2?|ttf|lockb)$/i.test(item.path));
      setFiles(entries.map((item:any)=>({path:item.path,sha:item.sha,size:item.size||0,type:"blob"})));
      setOpenFiles([]);setActivePath("");setConnected(true);setOutput("تم الاتصال بالمستودع "+repo+" · الفرع "+branch+" · "+entries.length+" ملفًا نصيًا قابلًا للتحرير.");
      setRuns([]);
    }catch(cause:any){setConnected(false);setError(friendlyError(cause));}
    finally{setIsLoading(false);}
  };

  const openFile=async(path:string)=>{
    const existing=openFiles.find(file=>file.path===path);
    if(existing){setActivePath(path);setTab("code");return;}
    setError("");setIsLoading(true);
    try{
      const data=await github("/repos/"+repo+"/contents/"+path.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(branch));
      if(data.type!=="file"||!data.content)throw new Error("GitHub لم يُرجع محتوى نصيًا لهذا الملف.");
      const content=decodeBase64(data.content);
      setOpenFiles(current=>[...current,{path,sha:data.sha,original:content,content}]);
      setActivePath(path);setTab("code");
    }catch(cause:any){setError(friendlyError(cause));}
    finally{setIsLoading(false);}
  };

  const updateActive=(content:string)=>{
    setOpenFiles(current=>current.map(file=>file.path===activePath?{...file,content}:file));
  };

  const saveChanges=async()=>{
    const changed=openFiles.filter(file=>file.content!==file.original);
    if(!changed.length)return;
    setError("");setIsSaving(true);
    try{
      const ref=await github("/repos/"+repo+"/git/ref/heads/"+encodeURIComponent(branch).replace(/%2F/g,"/"));
      const parent=await github("/repos/"+repo+"/git/commits/"+ref.object.sha);
      const blobs=await Promise.all(changed.map(file=>github("/repos/"+repo+"/git/blobs",{
        method:"POST",body:JSON.stringify({content:file.content,encoding:"utf-8"})
      })));
      const tree=await github("/repos/"+repo+"/git/trees",{
        method:"POST",body:JSON.stringify({base_tree:parent.tree.sha,tree:changed.map((file,index)=>({path:file.path,mode:"100644",type:"blob",sha:blobs[index].sha}))})
      });
      const message=(commitMessage.trim()||"Update code from Jupa Developer Studio").slice(0,180);
      const commit=await github("/repos/"+repo+"/git/commits",{
        method:"POST",body:JSON.stringify({message,tree:tree.sha,parents:[ref.object.sha]})
      });
      await github("/repos/"+repo+"/git/refs/heads/"+encodeURIComponent(branch).replace(/%2F/g,"/"),{
        method:"PATCH",body:JSON.stringify({sha:commit.sha,force:false})
      });
      setOpenFiles(current=>current.map(file=>changed.some(item=>item.path===file.path)?{...file,sha:blobs[changed.findIndex(item=>item.path===file.path)].sha,original:file.content}:file));
      setCommitMessage("");setOutput("تم إنشاء commit على "+branch+" · "+changed.length+" ملفًا · "+commit.sha.slice(0,8));
      setFiles(current=>current.map(item=>{const changedFile=changed.find(file=>file.path===item.path);return changedFile?{...item,sha:blobs[changed.findIndex(file=>file.path===item.path)].sha,size:new Blob([changedFile.content]).size}:item;}));
    }catch(cause:any){setError(friendlyError(cause));}
    finally{setIsSaving(false);}
  };

  const askAi=async()=>{
    const message=prompt.trim();if(!message)return;
    if(!activeFile){setError("افتح ملفًا أولًا حتى يستطيع المساعد فهم سياقه واقتراح تعديل آمن.");return;}
    setError("");setIsThinking(true);setAiSuggestion("");setAiAnswer("");
    try{
      const {data}=await supabase.auth.getSession();
      const accessToken=data.session?.access_token;
      if(!accessToken)throw new Error("انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة.");
      const context={
        prompt:message,
        repository:repo,
        branch,
        filePath:activeFile.path,
        fileContent:activeFile.content.slice(0,MAX_AI_CONTEXT),
        mode:"code",
      };
      const response=await fetch("/api/developer-studio/agent",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+accessToken},
        body:JSON.stringify(context),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"تعذر تشغيل مساعد الذكاء الاصطناعي.");
      setAiAnswer(result.message||"انتهى التحليل.");
      if(typeof result.updatedContent==="string")setAiSuggestion(result.updatedContent);
      setPrompt("");
    }catch(cause:any){setError(friendlyError(cause));}
    finally{setIsThinking(false);}
  };

  const runVerification=async()=>{
    setError("");setIsRunning(true);setOutput("يتم طلب تشغيل الاختبارات والبناء على GitHub Actions...");
    try{
      await github("/repos/"+repo+"/actions/workflows/"+WORKFLOW+"/dispatches",{
        method:"POST",body:JSON.stringify({ref:branch})
      });
      const result=await github("/repos/"+repo+"/actions/workflows/"+WORKFLOW+"/runs?branch="+encodeURIComponent(branch)+"&per_page=5");
      setRuns(result.workflow_runs||[]);
      setOutput("تم إرسال طلب تشغيل Workflow. افتح تبويب الاختبارات لتحديث حالة التنفيذ والنتائج.");
      setTab("tests");
    }catch(cause:any){setError(friendlyError(cause));setOutput("تعذر تشغيل التحقق عن بُعد.");}
    finally{setIsRunning(false);}
  };

  const refreshRuns=async()=>{
    setIsRunning(true);setError("");
    try{const result=await github("/repos/"+repo+"/actions/workflows/"+WORKFLOW+"/runs?branch="+encodeURIComponent(branch)+"&per_page=5");setRuns(result.workflow_runs||[]);}
    catch(cause:any){setError(friendlyError(cause));}
    finally{setIsRunning(false);}
  };

  const lineCount=activeFile?.content.split("\n").length||0;
  const appendOutput=(message:string)=>setOutput(value=>value+"\n"+message);

  return (
    <div className="h-full min-h-0 flex flex-col bg-background" dir="rtl">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border bg-primary/10 text-primary"><Code2 className="h-4 w-4"/></span>
          <div><div className="text-sm font-black">بيئة التطوير المستقلة</div><div className="text-[10px] text-muted-foreground">محرر ملفات + مساعد AI + Git + اختبارات وبناء</div></div>
          {connected&&<span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700">متصل بـ GitHub</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onBackToVisual} className="h-8 text-xs">المحرر البصري</Button>
          <Button type="button" size="sm" onClick={()=>void saveChanges()} disabled={!dirtyCount||isSaving||!connected} className="h-8 gap-1 text-xs"><Save className="h-3.5 w-3.5"/>{isSaving?"جارٍ الحفظ":"حفظ Commit"}{dirtyCount>0&&" ("+dirtyCount+")"}</Button>
        </div>
      </header>

      {!connected?(
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-8">
          <div className="mx-auto max-w-3xl space-y-4">
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><FolderGit2 className="h-5 w-5 text-primary"/><h2 className="font-black">فتح مشروع برمجي داخل صفحة جوبا</h2></div>
              <p className="text-xs leading-6 text-muted-foreground">هذه بيئة مدمجة داخل جوبا ولا تعتمد على برنامج سطح المكتب. اربط مستودع GitHub الذي تريد تعديله، ثم افتح الملفات وحررها واحفظ التغييرات على الفرع المحدد.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-bold">المستودع <Input dir="ltr" value={repo} onChange={e=>setRepo(e.target.value)} placeholder="owner/repository"/></label>
                <label className="space-y-1 text-xs font-bold">الفرع <Input dir="ltr" value={branch} onChange={e=>setBranch(e.target.value)} placeholder="main"/></label>
                <label className="space-y-1 text-xs font-bold sm:col-span-2">GitHub Personal Access Token <Input dir="ltr" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="ghp_... (يبقى في ذاكرة الصفحة فقط)"/></label>
              </div>
              <Button type="button" disabled={isLoading||!token.trim()} onClick={()=>void connect()} className="mt-4 gap-2">{isLoading?<Loader2 className="h-4 w-4 animate-spin"/>:<GitBranch className="h-4 w-4"/>}اتصال وفتح الملفات</Button>
              <p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>الرمز يبقى في ذاكرة هذه الصفحة ولا يُرسل إلى خادم جوبا. استخدم Fine-grained token لهذا المستودع فقط بصلاحية Contents، وأضف Actions للتشغيل والاطلاع على الاختبارات. لا تحفظه في المتصفح ولا تشاركه.</p>
            </section>
            <section className="rounded-2xl border bg-muted/30 p-5 text-xs leading-6 text-muted-foreground">
              **ماذا يوجد في هذه البيئة؟** محرر ملفات متعدد التبويبات، البحث في أسماء الملفات، تعديل وحفظ مجموعة ملفات في commit واحد، مساعد Gemini لمراجعة الملف الحالي واقتراح نسخة معدلة، وتشغيل Workflow الاختبارات والبناء على GitHub Actions. لا تحتاج إلى تثبيت Developer Studio Desktop.
            </section>
          </div>
        </div>
      ):(
        <div className="min-h-0 flex flex-1 overflow-hidden">
          <aside className="hidden w-[260px] shrink-0 flex-col border-l bg-card md:flex">
            <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-black"><span>ملفات المشروع ({files.length})</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={()=>void connect()} title="تحديث قائمة الملفات"><RefreshCw className="h-3.5 w-3.5"/></Button></div>
            <div className="border-b p-2"><div className="relative"><Search className="absolute right-2 top-2.5 h-3.5 w-3.5 text-muted-foreground"/><Input value={filter} onChange={e=>setFilter(e.target.value)} className="h-8 pr-7 text-xs" placeholder="بحث عن ملف..."/></div></div>
            <div className="min-h-0 flex-1 overflow-auto p-1">
              {visibleFiles.slice(0,1500).map(file=><button key={file.path} type="button" onClick={()=>void openFile(file.path)} className={"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-[11px] hover:bg-muted "+(activePath===file.path?"bg-primary/10 text-primary":"text-foreground")}>
                <FileCode2 className="h-3.5 w-3.5 shrink-0"/><span className="min-w-0 flex-1 truncate" dir="ltr">{file.path}</span>{openFiles.some(open=>open.path===file.path&&open.content!==open.original)&&<span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>}
              </button>)}
              {visibleFiles.length===0&&<p className="p-3 text-xs text-muted-foreground">لا توجد ملفات مطابقة.</p>}
            </div>
            <div className="border-t p-2 text-[10px] text-muted-foreground" dir="ltr">{repo} · {branch}</div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-2 py-1.5">
              <div className="flex gap-1">
                {([["code","الكود",Code2],["ai","مساعد AI",Bot],["git","Git",GitBranch],["tests","اختبارات",TerminalSquare]] as const).map(([key,label,Icon])=><Button key={key} type="button" size="sm" variant={tab===key?"default":"ghost"} onClick={()=>setTab(key)} className="h-7 gap-1 px-2 text-[10px]"><Icon className="h-3 w-3"/>{label}</Button>)}
              </div>
              <div className="flex items-center gap-1">
                {tab==="code"&&<><span className="text-[10px] text-muted-foreground">{activeFile?activeFile.path:"اختر ملفًا"}</span>{activeFile&&<span className="text-[10px] text-muted-foreground">{lineCount} سطر</span>}</>}
                <Button type="button" size="sm" variant="outline" disabled={!connected||isRunning} onClick={()=>void runVerification()} className="h-7 gap-1 px-2 text-[10px]"><Play className="h-3 w-3"/>Build & Test</Button>
              </div>
            </div>

            {tab==="code"&&(
              <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                <div className="flex min-h-8 items-center gap-1 overflow-x-auto border-b bg-muted/30 px-2">
                  {openFiles.map(file=><button key={file.path} type="button" onClick={()=>setActivePath(file.path)} className={"flex max-w-56 shrink-0 items-center gap-2 border-l px-2 py-1 text-[10px] "+(activePath===file.path?"bg-background text-primary":"text-muted-foreground")}>
                    <FileCode2 className="h-3 w-3"/><span className="truncate" dir="ltr">{file.path.split("/").pop()}</span>{file.content!==file.original&&<span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>}<span onClick={e=>{e.stopPropagation();setOpenFiles(v=>v.filter(x=>x.path!==file.path));if(activePath===file.path)setActivePath("");}}><X className="h-3 w-3"/></span>
                  </button>)}
                </div>
                {activeFile?<Textarea value={activeFile.content} onChange={e=>updateActive(e.target.value)} spellCheck={false} dir="ltr" className="min-h-0 flex-1 resize-none rounded-none border-0 bg-[#0d1625] p-4 font-mono text-[12px] leading-6 text-slate-100 focus-visible:ring-0" placeholder="Code..." />:<div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">اختر ملفًا من مستكشف المشروع لبدء التحرير.</div>}
                {aiSuggestion&&activeFile&&<div className="shrink-0 border-t bg-emerald-500/5 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2"><b className="text-xs">اقتراح AI جاهز للمراجعة</b><div className="flex gap-1"><Button type="button" size="sm" onClick={()=>{updateActive(aiSuggestion);setAiSuggestion("");setTab("code");}} className="h-7 gap-1 text-[10px]"><Check className="h-3 w-3"/>تطبيق على المحرر</Button><Button type="button" variant="ghost" size="sm" onClick={()=>setAiSuggestion("")} className="h-7 text-[10px]">رفض</Button></div></div>
                  <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-left text-[10px]" dir="ltr">{aiSuggestion.slice(0,5000)}</pre>
                </div>}
              </div>
            )}

            {tab==="ai"&&<div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="mx-auto max-w-3xl space-y-3">
                <div className="rounded-xl border bg-card p-4"><div className="mb-2 flex items-center gap-2 font-black"><Sparkles className="h-4 w-4 text-primary"/>Gemini Code Agent</div><p className="text-xs leading-6 text-muted-foreground">يفهم محتوى الملف المفتوح، يشرح الأخطاء ويقترح نسخة كاملة معدلة. لن تتغير الملفات إلا بعد ضغطك على «تطبيق على المحرر»، ولن تُرفع إلى GitHub إلا بحفظ commit صريح.</p></div>
                <Textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={5} placeholder="مثال: افحص الملف، اكتشف الأخطاء، أصلحها مع الحفاظ على السلوك الحالي، واشرح التعديلات..." />
                <div className="flex justify-end"><Button type="button" disabled={isThinking||!prompt.trim()||!activeFile} onClick={()=>void askAi()} className="gap-2">{isThinking?<Loader2 className="h-4 w-4 animate-spin"/>:<Bot className="h-4 w-4"/>}تحليل واقتراح تعديل</Button></div>
                {aiAnswer&&<div className="rounded-xl border bg-card p-4 text-xs leading-7 whitespace-pre-wrap">{aiAnswer}</div>}
                {error&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
              </div>
            </div>}

            {tab==="git"&&<div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="mx-auto max-w-3xl space-y-3">
                <div className="rounded-xl border bg-card p-4"><b className="text-sm">تغييرات الملفات</b><p className="mt-1 text-xs text-muted-foreground">{dirtyCount} ملفًا به تعديلات غير محفوظة محليًا داخل الصفحة.</p>
                  <div className="mt-3 space-y-1">{openFiles.filter(file=>file.content!==file.original).map(file=><div key={file.path} className="flex justify-between gap-2 rounded bg-muted/50 p-2 text-xs"><span dir="ltr" className="truncate">{file.path}</span><span className="text-amber-600">Modified</span></div>)}</div>
                </div>
                <Input value={commitMessage} onChange={e=>setCommitMessage(e.target.value)} placeholder="رسالة commit..." className="text-xs"/>
                <Button type="button" disabled={!dirtyCount||isSaving} onClick={()=>void saveChanges()} className="gap-2"><GitCommit className="h-4 w-4"/>إنشاء Commit ورفع التعديلات إلى الفرع</Button>
                <p className="text-[10px] leading-5 text-muted-foreground">هذه العملية تكتب مباشرة على الفرع الذي اخترته. راجع التغييرات قبل التأكيد، ولا تستخدم main إلا عندما تقصد تعديل النسخة الأساسية.</p>
              </div>
            </div>}

            {tab==="tests"&&<div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="mx-auto max-w-3xl space-y-3"><div className="flex items-center justify-between"><b className="text-sm">GitHub Actions · Typecheck / Tests / Build</b><Button type="button" size="sm" variant="outline" onClick={()=>void refreshRuns()} disabled={isRunning} className="h-8 gap-1 text-xs"><RefreshCw className="h-3.5 w-3.5"/>تحديث</Button></div>
                {runs.length?runs.map(run=><a key={run.id} href={run.html_url} target="_blank" rel="noreferrer" className="block rounded-xl border bg-card p-3 text-xs hover:bg-muted/50"><div className="flex justify-between gap-2"><b>{run.name}</b><span className={run.conclusion==="success"?"text-emerald-600":run.status==="in_progress"?"text-amber-600":"text-muted-foreground"}>{run.status==="in_progress"?"قيد التنفيذ":run.conclusion||run.status}</span></div><p className="mt-1 text-muted-foreground">{new Date(run.created_at).toLocaleString("ar-EG")} · #{run.id}</p></a>):<p className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">لم يتم تحميل نتائج بعد. اضغط Build & Test لتشغيل فحوص المشروع عن بُعد.</p>}
                {error&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
              </div>
            </div>}
            <div className="shrink-0 flex items-center justify-between gap-2 border-t bg-card px-3 py-1.5 text-[10px] text-muted-foreground"><span dir="ltr">{branch} · {repo}</span><span>{activeFile?activeFile.path:"لا يوجد ملف مفتوح"} · {dirtyCount} تغييرات</span></div>
          </main>
        </div>
      )}
      <footer className="shrink-0 flex items-center gap-2 border-t bg-[#0d1625] px-3 py-2 text-[10px] text-slate-300"><TerminalSquare className="h-3.5 w-3.5 text-emerald-400"/><span className="min-w-0 flex-1 truncate">{output}</span>{error&&<span className="max-w-[35%] truncate text-red-400" title={error}>{error}</span>}</footer>
    </div>
  );
}
