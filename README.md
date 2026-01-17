# 📅 ScheduleMyClass - 你的本地隐私课表

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Privacy First](https://img.shields.io/badge/Privacy-Local%20Storage-green)
![Responsive](https://img.shields.io/badge/Mobile-Ready-blue)

一个现代、极简且注重隐私的课程表管理工具。不需要注册账号，不需要下载 App，支持多端打开，**所有数据仅保存在你的浏览器本地**。

支持多学期管理、时间冲突自动排版、手机端完美适配，以及**一键导出到苹果/谷歌日历**。

**这不仅仅是一个排课工具，更是建立规律生活的 Weekly Routine 规划神器！**
无论你是需要安排学期课程的大学生，还是想要固定健身、阅读、冥想时间的“自律达人”，它都能帮你把一周安排得明明白白。

### 🚀 [点击这里直接开始使用](https://wyf02.github.io/ScheduleMyClass/)

---

## ✨ 核心亮点

* 🧘 **规律生活 (New)**：专为**建立 Weekly Routine** 设计。不仅适用于排课，也能完美规划“早八晨读”、“周三健身”、“周五复盘”等固定生活节奏。**J人狂喜！**
* 🔒 **隐私安全**：数据存储在本地 (LocalStorage)，不上传服务器(纯前端......作者不想要弄任何数据库也不想要接收任何人的数据)。
* 📱 **手机适配**：精心设计的响应式布局，支持“抽屉式”列表和横向滑动视图，手机操作顺滑。
* ⚡ **智能排版**：当两门课程时间重叠时，自动左右分栏显示，拒绝遮挡。
* 🗓️ **日历同步**：支持生成 `.ics` 文件，将整学期课程一键导入 iPhone/Android 日历。
* 💾 **数据迁移**：支持导出 JSON 备份文件，在不同设备间无缝切换。
* 💾 **AI协作**：针对部分固定日程，建议可以先让市面上的AI读取您的excel、pdf 生成固定格式的JSON文件，直接导入课表。
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

### 第一步：添加课程/日程
1. 点击右上角的 **“+ 添加”** 按钮。
2. 在底部的列表中输入名称（如“高等数学”或“力量训练”）、周几、开始结束时间，支持note项（比如 课程序号、教室位置、授课老师、想对自己说的话等任何备注）
3. **支持直接输入时间**（如 08:00），系统会自动生成可视化色块。
4. 可以选择不显示/显示，还是直接删除。
5. 不需要保存按钮，输入即自动保存。

![编辑课程](docs/demo-edit.png)

### 第二步：导入到手机日历 (强烈推荐!)
想在手机自带的日历里看到课程，并收到上课提醒？
1. 点击顶部的 **“🗓️ 日历”** 按钮。
2. 输入本学期/本次规划 **第一周的周一** 和 **最后一周的周日** 日期。
3. 系统会自动生成 `.ics` 文件。
4. **iPhone 用户**： 目前手机端我没有找到好的方式去引入ics,目前看来只能你给自己的邮箱发邮件，把ics文件作为附件发过去，然后你在手机上接收它，它才会被添加到你的日历。 mac端直接下载文件拖拽到日历就行。

![日历导出](docs/demo-calendar.png)

### 第三步：数据备份
**⚠️ 注意：清理浏览器缓存会丢失数据！**
建议定期点击 **“备份📥”** 按钮下载 JSON 文件。换电脑时，点击 **“恢复📤”** 导入JSON即可还原所有数据。

---

### 可选：AI协作
可自行撰写提示词，并向您常用的AI发送您的pdf安排文档，让它以如下形式输出

```json
[
  {
    "id": "ais1hs62z",
    "name": "第二学期",
    "courses": [
      {
        "id": "qufial81k",
        "name": "新课程",
        "day": 1,
        "startHour": 8,
        "endHour": 9.5,
        "credit": 2,
        "serialNumber": "",
        "notes": "",
        "isVisible": true
      }
    ],
    "startHour": 8,
    "endHour": 22
  },
  {
    "id": "ibq6fmuup",
    "name": "2026第一学期",
    "courses": [
      {
        "id": "z42el2bb8",
        "name": "锻炼",
        "day": 1,
        "startHour": 8,
        "endHour": 9.5,
        "credit": 2,
        "serialNumber": "",
        "notes": "XX体育馆",
        "isVisible": true
      }
    ],
    "startHour": 8,
    "endHour": 22
  }
]
``` 

---

## 🛠️ 技术栈

* **Core**: React + TypeScript + Vite
* **Styling**: Tailwind CSS
* **Logic**: 纯前端架构 (No Backend)
* **Library**: `ics` (用于生成日历文件)

## 🤝 贡献与反馈

如果你有好的更多功能建议或发现了 Bug，欢迎提交 Issue 或 Pull Request。

如果这个小工具帮到了你，麻烦给个 ⭐ Star 喽！

---

Made with ❤️ by [Yifan Wang](https://wyf02.github.io/#/) and [Gemini](https://gemini.google.com/)