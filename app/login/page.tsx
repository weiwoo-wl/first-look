"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

type Intent = "login" | "register" | "recover";
type Step = "form" | "verify" | "set-password";

export default function LoginPage() {
  const [intent, setIntent] = useState<Intent>("login");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  const next = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const candidate = new URLSearchParams(window.location.search).get("next") || "/";
    return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
  }, []);

  const title = step === "set-password" ? (intent === "recover" ? "设置新密码" : "设置登录密码") : intent === "register" ? "注册 First Look" : intent === "recover" ? "找回密码" : "登录 First Look";
  const description = step === "set-password" ? "设置完成后，将直接进入 First Look。" : intent === "register" ? "验证邮箱并设置密码，创建你的账号。" : intent === "recover" ? "通过注册邮箱验证身份并重设密码。" : "使用注册邮箱和密码登录。";

  function switchIntent(value: Intent) {
    setIntent(value); setStep("form"); setCode(""); setPassword(""); setConfirm(""); setSent(false); setMessage("");
  }
  function showError(value: unknown) { setMessage(value instanceof Error ? value.message : "操作失败，请稍后重试"); }
  async function continueAfterLogin() {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const session = response.ok ? await response.json() as { isAdmin?: boolean } : {};
    window.location.assign(session.isAdmin ? "/admin" : next);
  }
  async function submitPassword(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw Error(data.error || "登录失败");
      await continueAfterLogin();
    } catch (error) { showError(error); } finally { setBusy(false); }
  }
  async function sendCode() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw Error(data.error || "发送失败");
      setSent(true); setStep("verify"); setMessage("验证码已发送，请查看邮箱");
    } catch (error) { showError(error); } finally { setBusy(false); }
  }
  async function verifyCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code, intent, acceptTerms: intent === "register" && terms }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw Error(data.error || "验证失败");
      setStep("set-password"); setMessage("邮箱验证成功，请设置密码");
    } catch (error) { showError(error); } finally { setBusy(false); }
  }
  async function setNewPassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setMessage("两次输入的密码不一致"); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password/set", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw Error(data.error || "设置失败");
      await continueAfterLogin();
    } catch (error) { showError(error); } finally { setBusy(false); }
  }

  return <main className="min-h-dvh bg-[#f7f7f4] px-5 py-12 text-[#171717] sm:py-16"><section className="mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-7 shadow-sm"><Link href="/" className="text-sm text-black/45">← 返回首页</Link><div className="mt-8 flex rounded-full bg-black/[.04] p-1" aria-label="账号入口">{(["login", "register"] as Intent[]).map((value) => <button key={value} type="button" onClick={() => switchIntent(value)} className={`flex-1 rounded-full px-4 py-2 text-sm ${intent === value && step !== "set-password" ? "bg-white font-medium shadow-sm" : "text-black/50"}`}>{value === "login" ? "登录" : "注册"}</button>)}</div><h1 className="mt-8 text-3xl font-semibold tracking-[-0.05em]">{title}</h1><p className="mt-2 text-sm leading-6 text-black/50">{description}</p>
    {intent === "login" && step === "form" && <form onSubmit={submitPassword} className="mt-8 space-y-5"><EmailField value={email} setValue={setEmail} /><PasswordField label="密码" value={password} setValue={setPassword} /><button disabled={busy} className="primary-button">{busy ? "登录中…" : "登录"}</button><button type="button" onClick={() => switchIntent("recover")} className="w-full text-sm text-black/50 hover:text-black">忘记密码？</button></form>}
    {intent !== "login" && step === "form" && <div className="mt-8 space-y-5"><EmailField value={email} setValue={setEmail} />{intent === "register" && <label className="flex items-start gap-2 text-sm leading-5 text-black/55"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1" /><span>我已阅读并同意 <a href="/terms" target="_blank" className="text-black underline underline-offset-2">用户协议</a> 和 <a href="/privacy" target="_blank" className="text-black underline underline-offset-2">隐私政策</a></span></label>}<button type="button" disabled={busy || !email || (intent === "register" && !terms)} onClick={sendCode} className="primary-button">{busy ? "发送中…" : "获取验证码"}</button>{intent === "recover" && <button type="button" onClick={() => switchIntent("login")} className="w-full text-sm text-black/50">返回登录</button>}</div>}
    {step === "verify" && <form onSubmit={verifyCode} className="mt-8 space-y-5"><p className="rounded-lg bg-black/[.035] p-3 text-sm text-black/55">验证码已发送至 <strong className="text-black">{email}</strong></p><label className="block"><span className="mb-2 block text-sm font-medium">验证码</span><input autoFocus inputMode="numeric" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="六位验证码" className="form-input tracking-[0.35em]" /></label><button disabled={busy || code.length !== 6} className="primary-button">{busy ? "验证中…" : "验证邮箱"}</button><div className="flex justify-between text-sm text-black/50"><button type="button" disabled={busy} onClick={sendCode}>{sent ? "重新发送" : "获取验证码"}</button><button type="button" onClick={() => setStep("form")}>修改邮箱</button></div></form>}
    {step === "set-password" && <form onSubmit={setNewPassword} className="mt-8 space-y-5"><PasswordField label={intent === "recover" ? "新密码" : "设置密码"} value={password} setValue={setPassword} /><PasswordField label="再次输入密码" value={confirm} setValue={setConfirm} /><button disabled={busy} className="primary-button">{busy ? "保存中…" : "保存密码并继续"}</button></form>}
    {message && <p role="status" className={`mt-5 text-sm ${message.includes("成功") || message.includes("已发送") ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}</section></main>;
}

function EmailField({ value, setValue }: { value: string; setValue: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium">邮箱</span><input type="email" required autoComplete="email" value={value} onChange={(event) => setValue(event.target.value)} placeholder="name@example.com" className="form-input" /></label>;
}

function PasswordField({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><input type="password" required minLength={8} autoComplete="current-password" value={value} onChange={(event) => setValue(event.target.value)} placeholder="至少八位密码" className="form-input" /></label>;
}
