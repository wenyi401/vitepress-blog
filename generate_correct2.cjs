const fs = require('fs');

const postsDir = '.vitepress/dist/posts';
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));

// 按分类整理 - 更准确的匹配
const categories = {
  'Android': files.filter(f => f.startsWith('android-')).map(f => f.replace('.html', '')),
  'Kotlin': files.filter(f => f.startsWith('kotlin') && !f.startsWith('kotlin-')).map(f => f.replace('.html', '')),
  'Kotlin': files.filter(f => /^kotlin-\d/.test(f) || /^kotlin-[a-z]/.test(f)).map(f => f.replace('.html', '')),
  'Jetpack Compose': files.filter(f => f.startsWith('jetpack-compose')).map(f => f.replace('.html', '')),
  'Lua': files.filter(f => f.startsWith('lua')).map(f => f.replace('.html', '')),
  'Xposed': files.filter(f => f.startsWith('xposed')).map(f => f.replace('.html', '')),
  'OpenClaw': files.filter(f => f.startsWith('openclaw')).map(f => f.replace('.html', '')),
  'Java': files.filter(f => f.startsWith('java-')).map(f => f.replace('.html', '')),
};

// 合并 Kotlin 分类（因为有 kotlin- 前缀和无前缀两种）
const kotlinFiles = [
  ...files.filter(f => /^kotlin-\d/.test(f) || /^kotlin-[a-z]/.test(f)),
  ...files.filter(f => f.startsWith('kotlin') && !f.startsWith('kotlin-'))
].map(f => f.replace('.html', '')).filter((v, i, a) => a.indexOf(v) === i);

const finalCategories = {
  'Android': files.filter(f => f.startsWith('android-')).map(f => f.replace('.html', '')),
  'Kotlin': kotlinFiles,
  'Jetpack Compose': files.filter(f => f.startsWith('jetpack-compose')).map(f => f.replace('.html', '')),
  'Lua': files.filter(f => f.startsWith('lua')).map(f => f.replace('.html', '')),
  'Xposed': files.filter(f => f.startsWith('xposed')).map(f => f.replace('.html', '')),
  'OpenClaw': files.filter(f => f.startsWith('openclaw')).map(f => f.replace('.html', '')),
  'Java': files.filter(f => f.startsWith('java-')).map(f => f.replace('.html', '')),
};

console.log('Categories:');
for (const [cat, posts] of Object.entries(finalCategories)) {
  console.log(`  ${cat}: ${posts.length} posts`);
}
