export type DirectoryTopic = { slug: string; title: string; description: string };
export type DirectorySection = { title: string; eyebrow: string; description: string; topics: DirectoryTopic[] };

export const directorySections: Record<string, DirectorySection> = {
  experience: {
    title: "经验",
    eyebrow: "FIELD NOTES",
    description: "从第一次上线，到持续运营与复盘。这里收集 AI 创作者一路走来的真实经验。",
    topics: [
      { slug: "website-launch", title: "网站上线", description: "从想法到可访问的网站，记录搭建、部署和上线过程。" },
      { slug: "filing", title: "备案经历", description: "分享备案准备、办理流程和实际遇到的问题。" },
      { slug: "product-publishing", title: "产品发布", description: "产品如何准备、介绍并正式发布。" },
      { slug: "growth", title: "运营推广", description: "探索如何找到第一批用户，并持续与他们交流。" },
      { slug: "lessons", title: "踩坑复盘", description: "把走过的弯路和后来找到的解法留给下一位创作者。" },
      { slug: "more-experience", title: "其他经验", description: "不属于以上主题的实践、心得与小发现。" },
    ],
  },
  tools: {
    title: "工具",
    eyebrow: "MAKER TOOLBOX",
    description: "发现创作者实际使用的 Skills、模板和其他好用工具。分类会随着内容一起生长。",
    topics: [
      { slug: "skills", title: "Skills", description: "可复用的 AI 技能、工作流和创作方法。" },
      { slug: "templates", title: "模板", description: "帮助创作者更快开始的模板与素材。" },
      { slug: "more-tools", title: "其他工具", description: "不属于固定分类的工具、资源与小帮手。" },
    ],
  },
};

export function topicHref(section: string, topic: string) {
  return `/directory/${section}/${topic}`;
}
