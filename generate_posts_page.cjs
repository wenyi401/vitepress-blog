const fs = require('fs');
const path = require('path');

const postsDir = '.vitepress/dist/posts';
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));

// 按分类整理
const categories = {
  'Android': files.filter(f => f.startsWith('android-')).map(f => f.replace('.html', '')),
  'Kotlin': files.filter(f => f.startsWith('kotlin-')).map(f => f.replace('.html', '')),
  'Jetpack Compose': files.filter(f => f.startsWith('jetpack-compose')).map(f => f.replace('.html', '')),
  'Lua': files.filter(f => f.startsWith('lua-')).map(f => f.replace('.html', '')),
  'Xposed': files.filter(f => f.startsWith('xposed-')).map(f => f.replace('.html', '')),
  'OpenClaw': files.filter(f => f.startsWith('openclaw-')).map(f => f.replace('.html', '')),
  'Java': files.filter(f => f.startsWith('java-')).map(f => f.replace('.html', '')),
};

let output = `---
layout: page
title: 文章归档
---

# 文章归档

<div class="posts-list">
`;

// 生成目录
for (const [cat, posts] of Object.entries(categories)) {
  if (posts.length === 0) continue;
  output += `\n## ${cat}\n\n`;
  for (const post of posts) {
    const title = post.replace(/^[a-z]+-/, '').replace(/-/g, ' ');
    output += `- [${title}](/posts/${post})\n`;
  }
}

output += `
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

fs.writeFileSync('posts.md', output);
console.log('Generated posts.md with', files.length, 'links');
