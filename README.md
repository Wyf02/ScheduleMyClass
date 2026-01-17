# 📅 ScheduleMyClass - 你的本地隐私课表

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Privacy First](https://img.shields.io/badge/Privacy-Local%20Storage-green)
![Responsive](https://img.shields.io/badge/Mobile-Ready-blue)

一个现代、极简且注重隐私的课程表管理工具。不需要注册账号，不需要下载 App，**所有数据仅保存在你的浏览器本地**。

支持多学期管理、时间冲突自动排版、手机端完美适配，以及**一键导出到苹果/谷歌日历**。

### 🚀 [点击这里直接开始使用](https://你的在线链接.vercel.app)

---

## ✨ 核心亮点

* 🔒 **隐私安全**：数据存储在本地 (LocalStorage)，不上传服务器，完全由你掌控。
* 📱 **手机适配**：精心设计的响应式布局，支持“抽屉式”列表和横向滑动视图，手机操作顺滑。
* ⚡ **智能排版**：当两门课程时间重叠时，自动左右分栏显示，拒绝遮挡。
* 🗓️ **日历同步**：支持生成 `.ics` 文件，将整学期课程一键导入 iPhone/Android 日历。
* 💾 **数据迁移**：支持导出 JSON 备份文件，在不同设备间无缝切换。

---

## 📸 功能演示

### 1. 清晰的周视图 (Desktop)
在大屏幕上，课程表一目了然。支持时间冲突检测，多门课重叠时会自动并排显示。
左侧时间轴和顶部星期表头支持 **“冻结窗格”**，滚动查看时永远不迷路。

![桌面端概览](docs/demo-overview.png)

### 2. 完美的手机体验 (Mobile)
在手机上，底部列表采用 **“抽屉式”设计**。点击标题栏即可展开编辑，再次点击收起以查看课表。
表格支持横向滑动，并在超小屏幕上自动优化按钮布局。

<img src="docs/demo-mobile.png" width="300" alt="手机端演示">

---

## 📖 使用教程

### 第一步：添加课程
1. 点击右上角的 **“+ 添加”** 按钮。
2. 在底部的列表中输入课程名称、周几、开始结束时间。
3. **支持直接输入时间**（如 08:00），系统会自动生成可视化色块。
4. 不需要保存按钮，输入即自动保存。

![编辑课程](docs/demo-edit.png)

### 第二步：导入到手机日历 (强烈推荐!)
想在手机自带的日历里看到课程，并收到上课提醒？
1. 点击顶部的 **“🗓️ 日历”** 按钮。
2. 输入本学期 **第一周的周一** 和 **最后一周的周日** 日期。
3. 系统会自动生成 `.ics` 文件。
4. **iPhone 用户**：AirDrop 发送到手机或用微信发送，打开后点击“添加到日历”。

![日历导出](docs/demo-calendar.png)

### 第三步：数据备份
**⚠️ 注意：清理浏览器缓存会丢失数据！**
建议定期点击 **“📥 备份”** 按钮下载 JSON 文件。换电脑时，点击 **“📤 恢复”** 即可还原所有数据。

---

## 🛠️ 技术栈

* **Core**: React + TypeScript + Vite
* **Styling**: Tailwind CSS
* **Logic**: 纯前端架构 (No Backend)
* **Library**: `ics` (用于生成日历文件)

## 🤝 贡献与反馈

如果你有好的建议或发现了 Bug，欢迎提交 Issue 或 Pull Request。
如果这个工具帮到了你，请给一个 ⭐ Star！

---

Made with ❤️ by [Yifan Wang](https://wyf02.github.io/#/) and [Gemini](https://gemini.google.com/)