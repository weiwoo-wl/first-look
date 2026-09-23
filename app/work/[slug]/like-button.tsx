"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

export default function LikeButton({ creationId, slug }: { creationId:number; slug:string }) {
  const [count,setCount]=useState(0),[liked,setLiked]=useState(false),[error,setError]=useState("");
  useEffect(()=>{fetch(`/api/creations/react?creationId=${creationId}`).then(r=>r.ok?r.json() as Promise<{count:number;liked:boolean}>:null).then(data=>{if(data){setCount(data.count);setLiked(data.liked);}}).catch(()=>{});},[creationId]);
  async function toggle(){setError("");const response=await fetch("/api/creations/react",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId})});if(response.status===401){location.assign(`/login?next=${encodeURIComponent(`/work/${slug}`)}`);return;}const data=await response.json() as {count:number;liked:boolean;error?:string};if(!response.ok){setError(data.error||"操作失败");return;}setCount(data.count);setLiked(data.liked);}
  return <div className="mt-10"><button onClick={toggle} aria-pressed={liked} className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm ${liked?"border-[#e15d36] text-[#c64b2c]":"border-black/15 bg-white"}`}><Heart size={16} fill={liked?"currentColor":"none"}/>{liked?"已喜欢":"喜欢"} · {count}</button>{error&&<p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}</div>;
}
