const fs = require('fs');

let content = fs.readFileSync('posts.md', 'utf8');

// 移除 /vitepress-blog/ 前缀和 .html 后缀
content = content.replace(/\/vitepress-blog\//g, '/');
content = content.replace(/\.html/g, '');

// 写回
fs.writeFileSync('posts.md', content);
console.log('Fixed posts.md links');
