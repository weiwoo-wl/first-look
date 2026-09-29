// @ts-nocheck -- Cloudflare's generated SocketOptions marks allowHalfOpen as required although the runtime defaults it.
import {connect} from "cloudflare:sockets";
const enc=new TextEncoder(),dec=new TextDecoder();
async function reply(r:ReadableStreamDefaultReader<Uint8Array>){let t="";for(;;){const x=await r.read();if(x.done)throw Error("SMTP closed");t+=dec.decode(x.value,{stream:true});const last=t.split("\r\n").filter(Boolean).at(-1);if(last&&/^\d{3} /.test(last))return Number(last.slice(0,3));}}
async function sendTextEmail(to:string,subjectText:string,body:string,password:string,htmlBody?:string){
  const s=connect({hostname:"smtpdm.aliyun.com",port:465},{secureTransport:"on"}),w=s.writable.getWriter(),r=s.readable.getReader();
  const timeout=setTimeout(()=>{void s.close().catch(()=>{});},20000);
  const cmd=async(line:string,accepted:number[])=>{await w.write(enc.encode(line+"\r\n"));const code=await reply(r);if(!accepted.includes(code))throw Error(`SMTP ${code}`);};
  try{
    if(await reply(r)!==220)throw Error("SMTP greeting");
    await cmd("EHLO firstlooklab.cn",[250]);await cmd("AUTH LOGIN",[334]);await cmd(btoa("noreply@mail.firstlooklab.cn"),[334]);await cmd(btoa(password),[235]);
    await cmd("MAIL FROM:<noreply@mail.firstlooklab.cn>",[250]);await cmd(`RCPT TO:<${to}>`,[250,251]);await cmd("DATA",[354]);
    const subject=`=?UTF-8?B?${btoa(unescape(encodeURIComponent(subjectText)))}?=`,boundary=`firstlook-${crypto.randomUUID()}`;
    const message=htmlBody
      ? `From: First Look <noreply@mail.firstlooklab.cn>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${body}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${htmlBody}\r\n--${boundary}--\r\n.`
      : `From: First Look <noreply@mail.firstlooklab.cn>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${body}\r\n.`;
    await cmd(message.slice(0,-3).replace(/\r?\n/g,"\r\n").replace(/^\./gm,"..")+"\r\n.",[250]);
    await cmd("QUIT",[221]);
  }finally{clearTimeout(timeout);w.releaseLock();r.releaseLock();await s.close();}
}

export async function sendAdminEmail(to:string,subject:string,body:string,password:string){
  await sendTextEmail(to,subject,`${body}\n\nFirst Look 一眼\n联系我们：server@firstlooklab.cn`,password);
}

export async function sendVerificationEmail(to:string,code:string,password:string){
  await sendTextEmail(to,"First Look 验证码",`你的 First Look 验证码是：${code}\n\n验证码 10 分钟内有效。若不是你本人操作，请忽略。`,password);
}

export async function sendWelcomeEmail(to:string,password:string){
  const home="https://firstlooklab.cn";
  const text="嗨，欢迎加入 First Look！\n\n很高兴你来了。做东西的时候，不用等到一切都完美了才开始，也不用太担心想法会不会被模仿，因为总说完成比完美重要，经典也注定会被模仿——先按自己的节奏做下去就好。\n\n希望你在这里待得自在，也期待慢慢看到你做的东西。\n\n访问 First Look：https://firstlooklab.cn\n\nFirst Look 一眼";
  const html=`<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f7f7f4;color:#171717;font-family:Arial,'Microsoft YaHei',sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f4;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e7e5e4;border-radius:16px"><tr><td style="padding:28px 28px 12px"><a href="${home}" style="display:inline-flex;align-items:center;gap:12px;color:#171717;text-decoration:none"><img src="${home}/koi-logo.png" width="44" height="44" alt="First Look 一眼" style="display:block;width:44px;height:44px;object-fit:contain;border:0"><span style="font-size:15px;font-weight:700;line-height:1.35;letter-spacing:.04em">FIRST LOOK<br><span style="font-weight:500;letter-spacing:.08em">一眼</span></span></a></td></tr><tr><td style="padding:16px 28px 30px"><h1 style="margin:0 0 20px;font-size:24px;line-height:1.4">嗨，欢迎加入 First Look！</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.9;color:#44403c">很高兴你来了。做东西的时候，不用等到一切都完美了才开始，也不用太担心想法会不会被模仿，因为总说完成比完美重要，经典也注定会被模仿——先按自己的节奏做下去就好。</p><p style="margin:0 0 24px;font-size:15px;line-height:1.9;color:#44403c">希望你在这里待得自在，也期待慢慢看到你做的东西。</p><p style="margin:0 0 28px"><a href="${home}" style="display:inline-block;border-radius:999px;background:#171717;padding:12px 20px;color:#fff;font-size:14px;font-weight:600;text-decoration:none">访问 First Look</a></p><p style="margin:0 0 24px;font-size:12px;line-height:1.7;color:#78716c">如果上面的按钮无法打开，请复制此链接到浏览器：<br><a href="${home}" style="color:#57534e">${home}</a></p><p style="margin:0;border-top:1px solid #e7e5e4;padding-top:18px;font-size:13px;color:#78716c">First Look 一眼</p></td></tr></table></td></tr></table></body></html>`;
  await sendTextEmail(to,"欢迎来 First Look",text,password,html);
}
