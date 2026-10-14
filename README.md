# CET-4 Dictation

**英语四级听写助手**

一个纯前端、无需服务器的大学英语四级词汇听写练习工具，采用 Google Material 3 Expressive 设计风格，支持手机触屏手写、语音播放、自动批改、错题本和学习统计。

![Material 3 Expressive](https://img.shields.io/badge/UI-Material%203%20Expressive-5A6B4E?style=flat-square)
![HTML5](https://img.shields.io/badge/HTML-5-orange?style=flat-square)
![CSS3](https://img.shields.io/badge/CSS-3-blue?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## 📖 项目简介

本项目面向备考大学英语四级（CET-4）的学生，提供一个简洁、高效的词汇听写练习环境。所有数据保存在浏览器本地，无需注册登录，打开网页即可使用。

**适用场景：**
- 四级词汇日常听写练习
- 错题针对性复习
- 按日期每日学习计划
- 手机/电脑随时随地练习

## ✨ 功能特性

### 🎨 设计风格
- **Google Material 3 Expressive** 设计语言
- 柔和低饱和配色（鼠尾草绿 + 暖白色）
- 有机波浪进度条（Wavy Progress Indicator）
- 圆角卡片 + 微交互动效
- 响应式布局，完美适配手机和桌面端

### 📝 听写功能
- **语音播放**：Web Speech API + 在线 TTS 双方案，美式发音
- **手写板**：Canvas 绘制，支持鼠标和触屏，含撤销/清空/笔粗调节
- **键盘输入**：备用答案输入方式
- **手写识别填入**：Tesseract.js OCR 识别手写英文，智能匹配修正
- **自动批改**：忽略大小写、首尾空格，即时反馈
- **三种模式**：顺序听写 / 随机听写 / 错词重练

### 📚 词库与学习
- **内置 CET-4 核心词库**：2000+ 个高频单词，含中文释义和例句
- **每日学习计划**：175 天计划，每天 12 个单词，按日期自动分配
- **错题本**：答错单词自动收录，支持针对性复习
- **学习统计**：今日进度、累计正确率、连续学习天数

### 💾 数据与隐私
- **纯前端架构**：所有数据保存在浏览器 IndexedDB，无需服务器
- **隐私安全**：不上传任何个人数据，完全本地运行
- **导入导出**：支持 CSV 导入自定义单词表、JSON 备份全部数据
- **零成本部署**：GitHub Pages / Cloudflare Pages 静态托管

## 🚀 快速开始

### 在线体验
部署后访问（占位符）：
```
https://你的用户名.github.io/cet4-dictation/
```

### 本地运行
**方法一：直接打开**
直接双击 `index.html` 用浏览器打开即可使用。

> 推荐使用 **Chrome** 或 **Edge** 浏览器，语音朗读效果最好。

**方法二：本地服务器（推荐）**

如果你电脑上装了 Python：
```bash
cd cet4-dictation
python -m http.server 8080
```

然后浏览器访问：http://localhost:8080

如果你装了 Node.js：
```bash
npx serve cet4-dictation
```

### 手机访问
1. 确保手机和电脑在同一 Wi-Fi 下
2. 启动本地服务器
3. 手机浏览器访问 `http://你的电脑IP:8080`

## 📁 项目结构

```
cet4-dictation/
├── index.html              # 主页面（单页应用）
├── css/
│   └── style.css           # 全部样式，Material 3 Expressive 风格
├── js/
│   ├── storage.js          # IndexedDB 封装：数据增删改查
│   ├── speech.js           # 语音播放：Web Speech API + 在线 TTS
│   ├── canvas.js           # Canvas 手写板：轨迹绘制、撤销、笔粗
│   ├── words.js            # 单词管理：CRUD、CSV导入导出、错词
│   ├── stats.js            # 学习统计：记录、正确率、连续天数
│   ├── cet4_words.js       # CET-4 词库数据
│   ├── daily_plan.js       # 每日学习计划数据
│   └── app.js              # 主逻辑：标签切换、听写流程、自动批改
├── LICENSE                 # MIT 开源许可证
└── README.md               # 本说明文档
```

## 🛠️ 技术栈

| 模块 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | 原生 HTML / CSS / JavaScript | 无需构建工具，零依赖 |
| 手写板 | HTML Canvas | 支持鼠标 + 触屏，笔画流畅 |
| 发音 | Web Speech API + 在线 TTS | 双方案备用，兼容性更好 |
| 手写识别 | Tesseract.js (CDN) | 浏览器端 OCR，识别英文手写 |
| 本地存储 | IndexedDB | 单词、错题、学习记录全部本地保存 |
| UI 设计 | Material 3 Expressive | Google 最新设计语言 |

## 📦 部署到 GitHub Pages

1. **新建仓库**：在 GitHub 上新建一个仓库，命名为 `cet4-dictation`
2. **上传文件**：把项目文件夹里的所有文件上传到仓库
3. **开启 Pages**：仓库 → Settings → Pages
4. **配置部署**：Source 选择 `main` 分支，文件夹选 `/ (root)`，点 Save
5. **等待部署**：等 1-2 分钟，会给你一个网址

## ⚠️ 已知限制

1. **语音兼容性**：Web Speech API 在 Safari 上支持较差，推荐使用 Chrome / Edge
2. **手写识别准确率**：Tesseract.js 浏览器端识别准确率有限，需配合智能匹配修正
3. **数据隔离**：数据保存在浏览器本地，换浏览器或换设备看不到之前的数据
4. **首次加载**：手写识别功能首次使用需要从 CDN 加载语言包
5. **词库说明**：内置词库为整理的 CET-4 核心高频词，并非完整官方词表

## 🗺️ 后续计划

- [ ] 多端同步功能（Supabase / Firebase）
- [ ] 例句听写模式
- [ ] 单词记忆曲线复习（艾宾浩斯遗忘曲线）
- [ ] 深色模式
- [ ] 更多词库（CET-6、考研、雅思）

## 🤖 AI 辅助开发说明

**Development Note:**
This project was developed with the assistance of Doubao AI. The project owner reviewed and organized the generated code and is responsible for testing, maintenance, and future improvements.

**中文说明：**
本项目在豆包 AI 的辅助下生成和开发。项目作者负责项目整理、功能验证、维护及后续改进。

## 📄 许可证

本项目采用 **MIT License** 开源许可证，你可以自由使用、修改和分发。

```
MIT License

Copyright (c) 2026 你的名字
```

> 请将 `你的名字` 替换为你的 GitHub 用户名或真实姓名。

## 🙏 致谢

- [Material Design 3](https://m3.material.io/) - Google 设计系统
- [Tesseract.js](https://tesseract.projectnaptha.com/) - 浏览器端 OCR 引擎
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - 浏览器语音合成
