const fs = require('fs');

const postsDir = '.vitepress/dist/posts';
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));

// 按分类整理
const categories = {
  'Android': files.filter(f => f.startsWith('android-')).map(f => f.replace('.html', '')),
  'Kotlin': files.filter(f => f.startsWith('kotlin')).map(f => f.replace('.html', '')),
  'Jetpack Compose': files.filter(f => f.startsWith('jetpack-compose')).map(f => f.replace('.html', '')),
  'Lua': files.filter(f => f.startsWith('lua-')).map(f => f.replace('.html', '')),
  'Xposed': files.filter(f => f.startsWith('xposed-')).map(f => f.replace('.html', '')),
  'OpenClaw': files.filter(f => f.startsWith('openclaw-')).map(f => f.replace('.html', '')),
  'Java': files.filter(f => f.startsWith('java-')).map(f => f.replace('.html', '')),
};

// 生成 posts.md
let postsMd = `---
layout: page
title: 文章归档
---

# 文章归档

<div class="posts-list">
`;

for (const [cat, posts] of Object.entries(categories)) {
  if (posts.length === 0) continue;
  postsMd += `\n## ${cat}\n\n`;
  for (const post of posts) {
    // 标题：去掉前缀，将-和特殊字符换成空格
    let title = post;
    // 去掉分类前缀
    if (cat === 'Android') title = title.replace(/^android-/, '');
    else if (cat === 'Kotlin') title = title.replace(/^kotlin-?/, '');
    else if (cat === 'Jetpack Compose') title = title.replace(/^jetpack-compose-?/, '');
    else if (cat === 'Lua') title = title.replace(/^lua-?/, '');
    else if (cat === 'Xposed') title = title.replace(/^xposed-?/, '');
    else if (cat === 'OpenClaw') title = title.replace(/^openclaw-?/, '');
    else if (cat === 'Java') title = title.replace(/^java-?/, '');
    // 将-换成空格
    title = title.replace(/-/g, ' ');
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
let sidebarItems = {};
for (const [cat, posts] of Object.entries(categories)) {
  if (posts.length === 0) continue;
  sidebarItems[cat] = posts.slice(0, 10).map(post => {
    let title = post;
    if (cat === 'Android') title = title.replace(/^android-/, '');
    else if (cat === 'Kotlin') title = title.replace(/^kotlin-?/, '');
    else if (cat === 'Jetpack Compose') title = title.replace(/^jetpack-compose-?/, '');
    else if (cat === 'Lua') title = title.replace(/^lua-?/, '');
    else if (cat === 'Xposed') title = title.replace(/^xposed-?/, '');
    else if (cat === 'OpenClaw') title = title.replace(/^openclaw-?/, '');
    else if (cat === 'Java') title = title.replace(/^java-?/, '');
    title = title.replace(/-/g, ' ');
    return { text: title, link: `/posts/${post}` };
  });
}

console.log('Generated posts.md with', files.length, 'links');
console.log('Sidebar categories:', Object.keys(sidebarItems));

// 输出 sidebar JSON 供 config.js 使用
fs.writeFileSync('sidebar.json', JSON.stringify(sidebarItems, null, 2));
console.log('Generated sidebar.json');
