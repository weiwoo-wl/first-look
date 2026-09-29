"use client";
import { Check, ChevronDown, Copy, Heart, Image as ImageIcon, Link2, Share2, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReportButton from "./report-button";
import ProductSharePoster from "./product-share-poster";
type State = { likes:number; favorites:number; shares:number; share_opens:number; views:number; liked:boolean; favorited:boolean; selfInteractionLimited?:boolean; selfLikeUsed?:boolean; selfFavoriteUsed?:boolean; contactEmail?:string|null };
type ShareLink = { token:string; url:string };
type PosterMedia = { object_key:string; media_type:string };
export default function ProductActions({creationId,slug,title,description,media}:{creationId:number;slug:string;title:string;description:string;media:PosterMedia[]}) {
  const [state,setState]=useState<State>({likes:0,favorites:0,shares:0,share_opens:0,views:0,liked:false,favorited:false});
  const [ready,setReady]=useState(false),[pending,setPending]=useState(false),[shareLink,setShareLink]=useState<ShareLink|null>(null);
  const [error,setError]=useState(""),[shareStatus,setShareStatus]=useState("");
  const [contactOpen,setContactOpen]=useState(false),[emailCopied,setEmailCopied]=useState(false),[posterOpen,setPosterOpen]=useState(false),[shareMenuOpen,setShareMenuOpen]=useState(false);
  const shareMenuRef=useRef<HTMLDivElement>(null),busy=useRef(false),requests=useRef<Record<string,string>>({});
  const viewId=useRef(crypto.randomUUID());
  async function prepareShare() {
    const response=await fetch("/api/creations/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId,action:"prepare-share"})});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"分享链接准备失败，请重试");
    return data as ShareLink;
  }
  useEffect(()=>{
    let active=true,sent=false,timer:ReturnType<typeof setTimeout>|undefined;
    const controller=new AbortController();
    function scheduleView() {
      clearTimeout(timer);
      if(!active||sent||document.visibilityState!=="visible")return;
      timer=setTimeout(()=>{
        if(!active||sent||document.visibilityState!=="visible")return;
        sent=true;
        const ref=new URL(location.href).searchParams.get("ref");
        fetch("/api/creations/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId,action:"view",requestId:viewId.current,shareToken:ref}),signal:controller.signal}).then(async response=>{
          if(response.ok){const data=await response.json();if(active)setState(current=>({...current,views:Math.max(current.views,data.views),shares:Math.max(current.shares,data.shares),share_opens:Math.max(current.share_opens,data.share_opens)}));}
        }).catch(()=>undefined);
      },1200);
    }
    async function load() {
      const response=await fetch(`/api/creations/actions?creationId=${creationId}`,{cache:"no-store",signal:controller.signal});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||"互动数据加载失败");
      if(!active)return;
      setState(data);setReady(true);
      document.addEventListener("visibilitychange",scheduleView);scheduleView();
      const link=await prepareShare();if(active)setShareLink(link);
    }
    load().catch(problem=>{if(active)setError(problem instanceof Error?problem.message:"加载失败，请刷新重试");});
    return ()=>{active=false;controller.abort();clearTimeout(timer);document.removeEventListener("visibilitychange",scheduleView);};
  },[creationId]);
  useEffect(()=>{
    if(!shareMenuOpen)return;
    const pointer=(event:PointerEvent)=>{if(!shareMenuRef.current?.contains(event.target as Node))setShareMenuOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setShareMenuOpen(false);};
    document.addEventListener("pointerdown",pointer);document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("pointerdown",pointer);document.removeEventListener("keydown",key);};
  },[shareMenuOpen]);
  async function interact(kind:"like"|"favorite") {
    if(busy.current||!ready)return;
    busy.current=true;setPending(true);setError("");
    const requestId=requests.current[kind]||(requests.current[kind]=crypto.randomUUID());
    try {
      const response=await fetch(kind==="like"?"/api/creations/react":"/api/creations/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creationId,requestId,...(kind==="favorite"?{action:"favorite"}:{})})});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||"操作失败");
      delete requests.current[kind];
      setState(current=>({...current,...(kind==="like"?{liked:true,likes:Math.max(current.likes,data.count),selfLikeUsed:true}:{favorited:true,favorites:Math.max(current.favorites,data.favorites),selfFavoriteUsed:true})}));
    }catch(problem){setError(problem instanceof Error?problem.message:"操作未完成，请再次点击重试");}
    finally{busy.current=false;setPending(false);}
  }
  async function confirmShare(link:ShareLink,source:"copy-link"|"native-share") {
    const payload=JSON.stringify({creationId,action:"share",source,shareToken:link.token});
    let response:Response;
    try{response=await fetch("/api/creations/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:payload});}
    catch{response=await fetch("/api/creations/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:payload});}
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"分享统计暂未更新");
    setState(current=>({...current,shares:Math.max(current.shares,data.shares),share_opens:Math.max(current.share_opens,data.share_opens)}));
  }
  async function share() {
    if(!shareLink||busy.current)return;
    const link=shareLink,url=new URL(link.url,location.origin).toString();
    busy.current=true;setPending(true);setError("");
    let source:"copy-link"|"native-share"="copy-link",completed=false;
    try{
      if(typeof navigator.share==="function"){
        try{await navigator.share({title,text:description,url});source="native-share";}
        catch(problem){if(problem instanceof DOMException&&problem.name==="AbortError")return;await navigator.clipboard.writeText(url);}
      }else await navigator.clipboard.writeText(url);
      completed=true;
      await confirmShare(link,source);
      setShareStatus(source==="native-share"?"系统分享已完成":"链接已复制，可粘贴发送给朋友");
    }catch(problem){setError(problem instanceof Error?problem.message:"分享未成功，请重试");}
    finally{
      if(completed){setShareLink(null);try{setShareLink(await prepareShare());}catch{setError("分享链接准备失败，请重新打开分享菜单重试");}}
      busy.current=false;setPending(false);
    }
  }
  async function posterShared() {
    if(!shareLink)return;
    const link=shareLink;
    setPending(true);setError("");
    try{await confirmShare(link,"native-share");setShareLink(await prepareShare());}
    catch(problem){setError(problem instanceof Error?problem.message:"分享统计暂未更新");}
    finally{setPending(false);}
  }
  async function copyEmail(){if(!state.contactEmail)return;try{await navigator.clipboard.writeText(state.contactEmail);setEmailCopied(true);setTimeout(()=>setEmailCopied(false),1800);}catch{setError("复制失败，请手动选择邮箱地址复制");}}
  const likeLimited=Boolean(state.selfInteractionLimited&&(state.selfLikeUsed||state.liked)),favoriteLimited=Boolean(state.selfInteractionLimited&&(state.selfFavoriteUsed||state.favorited));
  return <div className="product-actions mt-8">
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={()=>void interact("like")} disabled={!ready||pending||likeLimited} className={`product-action-trigger inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-55 ${state.liked?"bg-[#e15d36] text-white":"bg-black text-white"}`}><Heart size={16} fill={state.liked?"currentColor":"none"}/>{likeLimited?"已喜欢":"喜欢"}<span className="text-xs opacity-65">{state.likes}</span></button>
      <button onClick={()=>void interact("favorite")} disabled={!ready||pending||favoriteLimited} className={`product-action-trigger inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-55 ${state.favorited?"bg-[#e15d36] text-white":"border border-black/15 bg-white text-black"}`}><Star size={16} fill={state.favorited?"currentColor":"none"}/>{favoriteLimited?"已收藏":"收藏"}<span className="text-xs opacity-65">{state.favorites}</span></button>
      <div ref={shareMenuRef} className="relative">
        <button type="button" disabled={!ready||pending} aria-haspopup="menu" aria-expanded={shareMenuOpen} onClick={()=>{setShareMenuOpen(open=>!open);if(!shareLink)prepareShare().then(setShareLink).catch(problem=>setError(problem.message));}} className="product-action-trigger inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-medium"><Share2 size={16}/>分享<ChevronDown size={14}/></button>
        {shareMenuOpen&&<div role="menu" aria-label="分享方式" className="absolute left-0 top-full z-40 mt-2 min-w-44 overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-xl">
          <button type="button" role="menuitem" disabled={!shareLink||pending} onClick={()=>{setShareMenuOpen(false);void share();}} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/5 disabled:opacity-40"><Link2 size={16}/>分享链接</button>
          <button type="button" role="menuitem" disabled={!shareLink||pending} onClick={()=>{setShareMenuOpen(false);setPosterOpen(true);}} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/5 disabled:opacity-40"><ImageIcon size={16}/>分享海报</button>
        </div>}
      </div>
      {state.contactEmail&&<button type="button" onClick={()=>setContactOpen(open=>!open)} aria-expanded={contactOpen} className="product-action-trigger inline-flex items-center rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-medium">联系创作者</button>}
      <ReportButton creationId={creationId}/>
    </div>
    {state.selfInteractionLimited&&<p className="mt-3 text-xs text-black/40">自己的产品，喜欢和收藏各计一次；分享不限次数</p>}
    {contactOpen&&state.contactEmail&&<div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white p-4"><span className="select-all break-all text-sm font-medium">{state.contactEmail}</span><button type="button" onClick={()=>void copyEmail()} className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2 text-xs font-medium">{emailCopied?<Check size={14}/>:<Copy size={14}/>} {emailCopied?"已复制":"复制邮箱"}</button></div>}
    {shareStatus&&<p role="status" className="mt-3 text-sm text-black/55">{shareStatus}</p>}
    {posterOpen&&shareLink&&<ProductSharePoster open={posterOpen} onClose={()=>setPosterOpen(false)} title={title} description={description} slug={slug} shareUrl={new URL(shareLink.url,location.origin).toString()} media={media} onShared={posterShared}/>}
    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-black/45"><span>{state.views} 次浏览</span><span>{state.shares} 次分享</span></div>
    {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
  </div>;
}
