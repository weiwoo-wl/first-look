"use client";
import Link from "next/link";
import { useState } from "react";
import { Edit3, ExternalLink } from "lucide-react";

export default function ProductControls({ id, slug, title, visibility, onVisibilityChange }: { id:number; slug:string; title:string; visibility:string; onVisibilityChange:(next:string)=>void }) {
  const [busy,setBusy]=useState(false), [error,setError]=useState("");
  async function setVisibility(action:"unpublish"|"republish") { setBusy(true);setError("");try{const response=await fetch("/api/creations/manage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId:id,action})});const result=await response.json() as {error?:string;visibility:string};if(!response.ok)throw Error(result.error||"操作失败");onVisibilityChange(result.visibility);}catch(e){setError(e instanceof Error?e.message:"操作失败");}finally{setBusy(false);} }
  if (visibility === "draft") return <p className="text-xs text-black/40">这件作品还没有完成首次发布</p>;
  return <div className="flex flex-wrap items-center gap-2"><a href={`/account/products/${id}/edit`} className="inline-flex items-center gap-1 rounded-full border border-black/12 px-3 py-2 text-xs"><Edit3 size={14}/>编辑</a>{visibility!=="draft"&&<button disabled={busy} onClick={()=>setVisibility(visibility==="published"?"unpublish":"republish")} className="rounded-full border border-black/12 px-3 py-2 text-xs disabled:opacity-50">{busy?"处理中…":visibility==="published"?"下架产品":"重新上架"}</button>}{visibility==="published"&&<Link href={`/work/${encodeURIComponent(slug)}`} aria-label={`查看 ${title}`} className="rounded-full border border-black/12 p-2"><ExternalLink size={15}/></Link>}{error&&<span role="alert" className="w-full text-xs text-red-600">{error}</span>}</div>;
}
