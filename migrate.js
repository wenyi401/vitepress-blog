const fs = require('fs');
const path = require('path');

const hexoDir = '/home/node/.openclaw/workspace/blog/source/_posts';
const outputDir = '/home/node/.openclaw/workspace/vitepress-blog/posts';

const files = fs.readdirSync(hexoDir);
let count = 0;

files.forEach(file => {
    if (!file.endsWith('.md')) return;
    
    const hexoPath = path.join(hexoDir, file);
    let content = fs.readFileSync(hexoPath, 'utf8');
    
    // 解析 front-matter
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return;
    
    const frontMatterStr = match[1];
    const body = content.slice(match[0].length);
    
    // 解析 front-matter 字段
    const frontMatter = {};
    frontMatterStr.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            let key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            
            // 转换字段名
            const fieldMap = {
                'title': 'title',
                'date': 'date', 
                'updated': 'date',
                'tags': 'tags',
                'categories': 'tags',
                'photos': 'cover',
                'description': 'description',
                'keywords': 'tags'
            };
            
            if (fieldMap[key]) {
                // 处理数组格式
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
                }
                frontMatter[fieldMap[key]] = value;
            }
        }
    });
    
    // 清理正文中的"持续学习中"等词
    let cleanBody = body
        .replace(/持续学习中[.\s]*/g, '')
        .replace(/持续更新中[.\s]*/g, '')
        .replace(/最后更新:.*/g, '')
        .replace(/_标签:.*/g, '')
        .replace(/---.*?---/gs, '') // 移除残留的分割线
        .replace(/^\s*\*+\s*/gm, '') // 移除星号列表
        .replace(/^\s*#+\s*/gm, '') // 清理空标题
        .trim();
    
    // 生成 VitePress 格式
    let output = '---\n';
    if (frontMatter.title) output += `title: ${frontMatter.title}\n`;
    if (frontMatter.date) output += `date: ${frontMatter.date}\n`;
    if (frontMatter.tags) {
        if (Array.isArray(frontMatter.tags)) {
            output += `tags: [${frontMatter.tags.join(', ')}]\n`;
        } else {
            output += `tags: [${frontMatter.tags}]\n`;
        }
    }
    if (frontMatter.description) output += `description: ${frontMatter.description}\n`;
    output += '---\n\n';
    output += cleanBody;
    
    // 生成文件名
    const baseName = file.replace(/\.md$/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-');
    const outputPath = path.join(outputDir, baseName + '.md');
    
    fs.writeFileSync(outputPath, output);
    count++;
    
    if (count <= 5) {
        console.log(`[OK] ${file} -> ${baseName}.md`);
    }
});

console.log(`\n总计迁移 ${count} 篇文章`);
