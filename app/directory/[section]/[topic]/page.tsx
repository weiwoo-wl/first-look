import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";
import { directorySections, topicHref } from "../../content";

export default async function DirectoryTopicPage({ params }: { params: Promise<{ section: string; topic: string }> }) {
  const { section, topic: slug } = await params;
  const data = directorySections[section];
  const topic = data?.topics.find(item => item.slug === slug);
  if (!data || !topic) notFound();
  return <main className="directory-page">
    <header className="directory-top"><Link href="/" className="directory-brand">FIRST LOOK <span>一眼</span></Link><Link href="/" className="directory-back"><ArrowLeft size={15}/>返回发现</Link></header>
    <nav className="directory-breadcrumb" aria-label="面包屑导航"><Link href={`/directory/${section}`}>{data.title}</Link><span>/</span><span>{topic.title}</span></nav>
    <section className="directory-hero directory-topic-hero"><p>{data.eyebrow} / {topic.title}</p><h1>{topic.title}</h1><div>{topic.description}</div></section>
    <section className="directory-empty"><span>FIRST LOOK · 一眼</span><h2>好内容，正在路上。</h2><p>这个主题的内容还在整理中。如需联系网站，请发邮件至下方地址。</p><a className="directory-contact" href="mailto:server@firstlooklab.cn">server@firstlooklab.cn</a></section>
    <footer className="directory-footer"><Link href={`/directory/${section}`}><ArrowLeft size={14}/>返回{data.title}总览</Link><span>FIRST LOOK · 一眼</span><Link href={topicHref(section,data.topics[(data.topics.findIndex(item=>item.slug===slug)+1)%data.topics.length].slug)}>下一个主题 <ArrowUpRight size={14}/></Link></footer>
  </main>;
}
