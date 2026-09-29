"use client";
import { useState } from "react";
import AdminEmailManager from "./admin-email-manager";
import AdminInbox from "./admin-inbox";

export default function AdminMailManager({ users }: { users: { id: string; email: string; display_name: string; disabled_at: string | null }[] }) {
  const [view, setView] = useState<"inbox" | "send">("inbox");
  return <><div className="mb-5 flex gap-2" role="group" aria-label="邮件管理">
    <button type="button" aria-pressed={view==="inbox"} onClick={()=>setView("inbox")} className={`rounded-full border px-5 py-2 text-sm ${view==="inbox"?"bg-black text-white":"border-black/15"}`}>收件箱</button>
    <button type="button" aria-pressed={view==="send"} onClick={()=>setView("send")} className={`rounded-full border px-5 py-2 text-sm ${view==="send"?"bg-black text-white":"border-black/15"}`}>发送邮件与记录</button>
  </div><div hidden={view!=="inbox"}><AdminInbox /></div><div hidden={view!=="send"}><AdminEmailManager users={users} /></div></>;
}
