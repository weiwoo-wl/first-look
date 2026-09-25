import Link from "next/link";

export default function PrivacyPage() {
  return <main className="min-h-dvh bg-[#f7f7f4] px-5 py-12 text-[#171717]"><article className="mx-auto max-w-3xl"><Link href="/login" className="text-sm text-black/45">← 返回注册登录</Link><p className="mt-10 text-sm text-black/45">FIRST LOOK</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.05em]">隐私政策</h1><p className="mt-3 text-sm text-black/45">更新日期：2026 年 9 月 25 日</p><div className="mt-10 space-y-9 text-[15px] leading-7 text-black/70"><Section title="1. 我们收集的信息"><p>为了提供账号和发布功能，我们会处理注册邮箱、用户名、登录会话、你主动发布的产品资料，以及喜欢、收藏、分享、浏览和举报等操作记录。</p></Section><Section title="2. 信息用途"><p>这些信息用于验证身份、提供产品展示与管理、保障账号和平台安全、处理举报、统计产品互动情况及改进服务。</p></Section><Section title="3. 公开范围"><p>公开发布的产品内容、创作者名称和互动数量会被其他访问者看到。联系邮箱只有在你主动开启“公开联系邮箱”后才会展示。私密产品仅向账号本人和必要的安全审核流程开放。</p></Section><Section title="4. 存储与保护"><p>账号及产品数据存储在 First Look 使用的云服务中。我们采用安全 Cookie、访问控制和必要的技术措施保护数据，但任何网络服务都无法保证绝对安全。</p></Section><Section title="5. 保留与删除"><p>我们按提供服务和保障安全所需的时间保留信息。产品下架不一定立即删除其历史版本和媒体文件；后续将提供更完整的账号与数据删除能力。</p></Section><Section title="6. 第三方链接"><p>产品可能包含创作者提供的外部链接。访问这些网站后，其隐私规则由相应网站负责。</p></Section><Section title="7. 你的选择"><p>你可以在账户页修改用户名和密码，在产品管理中调整展示状态，并控制是否公开联系邮箱。如发现隐私或内容问题，可使用产品详情页的举报功能。</p></Section><Section title="8. 政策更新"><p>政策发生重要变化时，我们会通过页面提示或其他合理方式通知。</p></Section></div></article></main>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 text-lg font-semibold text-black">{title}</h2><div className="space-y-3">{children}</div></section>;
}
