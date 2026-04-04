import { defineConfig } from 'vitepress'
import sidebar from './sidebar.json'

export default defineConfig({
  title: "Wenyi's Blog",
  description: '学习笔记与技术分享 | Android开发 | Kotlin | LSPosed | Jetpack Compose',
  
  base: '/vitepress-blog/',
  
  ignoreDeadLinks: true,
  
  themeConfig: {
    logo: '/vitepress-blog/logo.svg',
    
    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/posts' },
      { text: '关于', link: '/about' }
    ],

    sidebar: sidebar,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wenyi401' }
    ],

    footer: {
      message: '基于 VitePress 构建',
      copyright: 'Copyright © 2024-2026 Wenyi'
    },

    search: {
      provider: 'local'
    }
  },

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  markdown: {
    theme: {
      light: 'vitesse-light',
      dark: 'vitesse-dark'
    }
  }
})
