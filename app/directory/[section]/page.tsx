import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";
import { directorySections, topicHref } from "../content";

export default async function DirectorySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const data = directorySections[section];
  if (!data) notFound();
  return <main className="directory-page">
    <header className="directory-top"><a href="/" aria-label="First Look（一眼）首页" className="directory-brand">FIRST LOOK <span>一眼</span></a><a href="/" className="directory-back"><ArrowLeft size={15}/>返回发现</a></header>
    <section className="directory-hero"><p>{data.eyebrow}</p><h1>{data.title}</h1><div>{data.description}</div></section>
    <section className="directory-topics"><div className="directory-section-heading"><div><p>EXPLORE</p><h2>浏览主题</h2></div><span>{data.topics.length} 个主题，持续补充</span></div><div className="directory-topic-grid">{data.topics.map((topic,index)=><Link key={topic.slug} href={topicHref(section,topic.slug)} className="directory-topic-card"><span className="directory-topic-number">{String(index+1).padStart(2,"0")}</span><ArrowUpRight className="directory-topic-arrow" size={18}/><h3>{topic.title}</h3><p>{topic.description}</p><span className="directory-topic-link">进入主题 <ArrowUpRight size={14}/></span></Link>)}</div></section>
    <footer className="directory-footer"><span>FIRST LOOK · 一眼</span><span>联系网站：<a href="mailto:server@firstlooklab.cn">server@firstlooklab.cn</a></span></footer>
  </main>;
}
