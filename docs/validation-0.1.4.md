# 0.1.4 主题联动验证

2026-10-29。SillyTavern 1.19.0 / 749441e，Chrome，独立虚构 dataRoot；没有发送消息或调用模型。扩展 0.1.4 配合原生 0.1.3 主题验证。

- 通过旧主题 CSS、空 CSS、其他 CSS、禁用样式及工作台预览优先级的单元检查；原有设置迁移和历史排序检查通过。
- 原生 UI 主题控件反复切换 Dark Lite / Codex 三轮，每次仅有一套侧栏、页头、9 个抽屉装饰和活动提示。
- 其他主题保存后刷新，配套界面不挂载；切回 Codex 即恢复。外观偏好不因自动启停而变化。
- 390 × 844 手机：侧栏打开后切换其他主题，聊天区 inert 恢复 false，输入框可编辑；外观面板打开时切走也完整清理。
- 手动关闭后切主题、保存刷新仍不启动；手动开启恢复。扩展 disable / enable 重复调用不重复挂载，其他主题下 enable 仍不启动界面。
- 1440 × 900 和 390 × 844 截图确认其他主题原生顶栏与聊天输入区恢复。

源码入口为 source/extension/theme.js 与 index.js；仅检查宿主 #custom-style 和工作台 #tts-preview-style，不从扩展自带的全局 stylesheet 判断当前主题。ST 的 applyCustomCSS 使用原生 style 节点替换，MutationObserver 随设置 UI 生命周期注册并在停用时移除。

TT 沿用既有 2.3.0 / ST 1.18 契约基线，本轮未在真实 TT WebView 验证；不把 ST 浏览器结果作为 TT 实机证明。主题 CSS、工程覆盖与用户日常安装未修改。
