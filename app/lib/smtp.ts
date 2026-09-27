// @ts-nocheck -- Cloudflare's generated SocketOptions marks allowHalfOpen as required although the runtime defaults it.
import {connect} from "cloudflare:sockets";
const enc=new TextEncoder(),dec=new TextDecoder();
async function reply(r:ReadableStreamDefaultReader<Uint8Array>){let t="";for(;;){const x=await r.read();if(x.done)throw Error("SMTP closed");t+=dec.decode(x.value,{stream:true});const last=t.split("\r\n").filter(Boolean).at(-1);if(last&&/^\d{3} /.test(last))return Number(last.slice(0,3));}}
async function sendTextEmail(to:string,subjectText:string,body:string,password:string){
  const s=connect({hostname:"smtpdm.aliyun.com",port:465},{secureTransport:"on"}),w=s.writable.getWriter(),r=s.readable.getReader();
  const cmd=async(line:string,accepted:number[])=>{await w.write(enc.encode(line+"\r\n"));const code=await reply(r);if(!accepted.includes(code))throw Error(`SMTP ${code}`);};
  try{
    if(await reply(r)!==220)throw Error("SMTP greeting");
    await cmd("EHLO firstlooklab.cn",[250]);await cmd("AUTH LOGIN",[334]);await cmd(btoa("noreply@mail.firstlooklab.cn"),[334]);await cmd(btoa(password),[235]);
    await cmd("MAIL FROM:<noreply@mail.firstlooklab.cn>",[250]);await cmd(`RCPT TO:<${to}>`,[250,251]);await cmd("DATA",[354]);
    const subject=`=?UTF-8?B?${btoa(unescape(encodeURIComponent(subjectText)))}?=`;
    await cmd(`From: First Look <noreply@mail.firstlooklab.cn>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${body}\r\n.`,[250]);
    await cmd("QUIT",[221]);
  }finally{w.releaseLock();r.releaseLock();await s.close();}
}

export async function sendVerificationEmail(to:string,code:string,password:string){
  await sendTextEmail(to,"First Look 验证码",`你的 First Look 验证码是：${code}\n\n验证码 10 分钟内有效。若不是你本人操作，请忽略。`,password);
}

export async function sendWelcomeEmail(to:string,password:string){
  await sendTextEmail(to,"欢迎来 First Look","嗨，欢迎加入 First Look！\n\n很高兴你来了。做东西的时候，不用等到一切都完美了才开始，也不用太担心想法会不会被模仿，因为总说完成比完美重要，经典也注定会被模仿——先按自己的节奏做下去就好。\n\n希望你在这里待得自在，也期待慢慢看到你做的东西。\n\nFirst Look",password);
}
