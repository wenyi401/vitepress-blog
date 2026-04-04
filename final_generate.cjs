const fs = require('fs');

const postsDir = '.vitepress/dist/posts';
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));

// 按分类整理
const kotlinAll = files.filter(f => f.startsWith('kotlin')).map(f => f.replace('.html', ''));
const finalCategories = {
  'Android': files.filter(f => f.startsWith('android-')).map(f => f.replace('.html', '')),
  'Kotlin': kotlinAll,
  'Jetpack Compose': files.filter(f => f.startsWith('jetpack-compose')).map(f => f.replace('.html', '')),
  'Lua': files.filter(f => f.startsWith('lua')).map(f => f.replace('.html', '')),
  'Xposed': files.filter(f => f.startsWith('xposed')).map(f => f.replace('.html', '')),
  'OpenClaw': files.filter(f => f.startsWith('openclaw')).map(f => f.replace('.html', '')),
  'Java': files.filter(f => f.startsWith('java-')).map(f => f.replace('.html', '')),
};

// 生成标题（根据文件名生成可读的标题）
function generateTitle(filename, category) {
  let title = filename;
  // 去掉前缀
  if (category === 'Android') title = title.replace(/^android-?/, '');
  else if (category === 'Kotlin') title = title.replace(/^kotlin-?/, '');
  else if (category === 'Jetpack Compose') title = title.replace(/^jetpack-compose-?/, '');
  else if (category === 'Lua') title = title.replace(/^lua-?/, '');
  else if (category === 'Xposed') title = title.replace(/^xposed-?/, '');
  else if (category === 'OpenClaw') title = title.replace(/^openclaw-?/, '');
  else if (category === 'Java') title = title.replace(/^java-?/, '');
  // 将-换成空格
  title = title.replace(/-/g, ' ');
  return title;
}

// 生成 posts.md
let postsMd = `---
layout: page
title: 文章归档
---

# 文章归档

<div class="posts-list">
`;

for (const [cat, posts] of Object.entries(finalCategories)) {
  if (posts.length === 0) continue;
  postsMd += `\n## ${cat}\n\n`;
  for (const post of posts) {
    const title = generateTitle(post, cat);
    postsMd += `- [${title}](/posts/${post})\n`;
  }
}

postsMd += `
</div>

<style>
.posts-list {
  line-height: 2;
}
.posts-list a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.posts-list a:hover {
  text-decoration: underline;
}
</style>
`;

fs.writeFileSync('posts.md', postsMd);

// 生成 sidebar
const sidebarConfig = [];
for (const [cat, posts] of Object.entries(finalCategories)) {
  if (posts.length === 0) continue;
  sidebarConfig.push({
    text: cat,
    collapsed: false,
    items: posts.slice(0, 10).map(post => ({
      text: generateTitle(post, cat),
      link: `/posts/${post}`
    }))
  });
}

console.log('Generated posts.md and sidebar.json');
fs.writeFileSync('sidebar.json', JSON.stringify(sidebarConfig, null, 2));
