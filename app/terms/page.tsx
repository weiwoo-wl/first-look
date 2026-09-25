import Link from "next/link";

export default function TermsPage() {
  return <LegalPage title="用户协议" updated="2026 年 9 月 25 日">
    <Section title="1. 服务说明"><p>First Look 是用于发现、展示和交流 AI 产品与创作成果的平台。用户可以浏览公开内容，注册后可以发布、管理和互动。</p></Section>
    <Section title="2. 账号与安全"><p>你应使用本人可以正常接收邮件的邮箱注册，并妥善保管密码。不得冒用他人身份、批量注册账号或以自动化方式干扰服务。</p></Section>
    <Section title="3. 发布内容"><p>你应确保有权发布上传的文字、图片、视频、文件和链接。不得发布违法、侵权、欺诈、恶意软件、仇恨骚扰、色情或泄露他人隐私的内容。</p><p>你保留内容的权利，同时授权 First Look 为提供展示、存储、审核和分享功能而处理这些内容。</p></Section>
    <Section title="4. 平台管理"><p>为保护用户和平台安全，我们可以对被举报内容进行审核，并视情况限制展示、下架内容或暂停账号。用户可以通过网站中的举报功能反馈问题。</p></Section>
    <Section title="5. 服务变化"><p>First Look 仍处于早期阶段，功能可能调整或短暂中断。我们会尽力保护数据和维持服务，但不保证服务永不出错或永久可用。</p></Section>
    <Section title="6. 协议更新"><p>协议发生重要变化时，我们会通过页面提示或其他合理方式通知。继续使用服务表示接受更新后的协议。</p></Section>
  </LegalPage>;
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <main className="min-h-dvh bg-[#f7f7f4] px-5 py-12 text-[#171717]"><article className="mx-auto max-w-3xl"><Link href="/login" className="text-sm text-black/45">← 返回注册登录</Link><p className="mt-10 text-sm text-black/45">FIRST LOOK</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.05em]">{title}</h1><p className="mt-3 text-sm text-black/45">更新日期：{updated}</p><div className="mt-10 space-y-9 text-[15px] leading-7 text-black/70">{children}</div></article></main>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 text-lg font-semibold text-black">{title}</h2><div className="space-y-3">{children}</div></section>;
}
