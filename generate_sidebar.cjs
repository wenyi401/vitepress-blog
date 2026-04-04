const fs = require('fs');

const postsDir = '.vitepress/dist/posts';
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html')).map(f => f.replace('.html', ''));

// 按分类整理
const categories = {
  'Android': files.filter(f => f.startsWith('android-')).slice(0, 10).map(f => ({ text: f.replace(/^android-/, '').replace(/-/g, ' '), link: `/posts/${f}` })),
  'Kotlin': files.filter(f => f.startsWith('kotlin-')).slice(0, 8).map(f => ({ text: f.replace(/^kotlin-/, '').replace(/-/g, ' '), link: `/posts/${f}` })),
  'Jetpack Compose': files.filter(f => f.startsWith('jetpack-compose')).map(f => ({ text: f.replace(/^jetpack-compose-/, '').replace(/-/g, ' '), link: `/posts/${f}` })),
  'Xposed / LSPosed': files.filter(f => f.startsWith('xposed-')).map(f => ({ text: f.replace(/^xposed-/, '').replace(/-/g, ' '), link: `/posts/${f}` })),
  '其他': [...files.filter(f => f.startsWith('lua-')).map(f => ({ text: f.replace(/^lua-/, '').replace(/-/g, ' '), link: `/posts/${f}` })),
           ...files.filter(f => f.startsWith('openclaw-')).map(f => ({ text: f.replace(/^openclaw-/, '').replace(/-/g, ' '), link: `/posts/${f}` }))].slice(0, 5),
};

let sidebarConfig = '[\n';
for (const [cat, items] of Object.entries(categories)) {
  if (items.length === 0) continue;
  sidebarConfig += `  {\n    text: '${cat}',\n    collapsed: false,\n    items: [\n`;
  for (const item of items) {
    sidebarConfig += `      { text: '${item.text}', link: '${item.link}' },\n`;
  }
  sidebarConfig += `    ]\n  },\n`;
}
sidebarConfig += ']';

console.log(sidebarConfig);
