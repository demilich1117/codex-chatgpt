# 0.1.3 阅读、侧栏与嵌入前端修复验证

2026-10-28。SillyTavern 1.19.0 / 749441e，独立虚构 dataRoot，Chromium。没有访问日常私人对话，没有发送消息或请求模型。

- 原生主题：导入 0.1.3、选择、保存刷新；最终 CSS 经原生自定义 CSS 与“更新主题”入口保存，再刷新逐字比较。
- 用户设置 > 页面宽度：真实滑块 36 → 92，1440px 下消息宽度 508.4 → 1054px，输入区 518.4 → 1064px。保留侧栏/抽屉避让和视口上限。
- 用户设置 > 字号：真实滑块 0.75 → 1.35，正文与输入区 10.5 → 18.9px；还原 1。主题原生字段未重设，仅版本名称更新。
- 原生抽屉：快捷轨角色/扩展按钮各重复点击开关；角色抽屉外部点击关闭；手机侧栏 > 角色 > 返回，均保留原生状态。新增代理的 mousedown/touchstart 作用域只限这些按钮。
- 侧栏：原生 details/summary 折叠、空格键开合、置顶移动、保存刷新、搜索临时展开与清空恢复。受控 40 条虚构聊天元数据验证默认 5 条、展开 40 条、搜索超过原 30 条限制、最后消息时间排序；未打开这些伪造聊天。路由测试结束移除。
- 320/390/767/768/1000/1001/1440px：输入区无横向溢出。手机输入区宽度为视口减 40px，不继承桌面 50% 阅读宽度；桌面仍跟随原生设置。桌面和手机深浅色截图已检查。
- 消息前端：在真实虚构消息内临时加入独立 srcdoc iframe 样本。强制继承 dark 时白色画布；恢复 normal 后透明显示宿主底色。显式白底样本保持白色。测试只改临时 DOM，结束移除；并未获取用户截图中前端的源码，不能据此声称覆盖其所有内部样式。
- 模型检查：设置迁移保留旧 mode/accent/sidebarWidth/pinned/showIdentity 与未知字段；折叠默认对象不共享；当前聊天优先、按时间排序、无效时间与空列表。命令：node scripts/test-model.mjs。
- TT 2.3.0 固定提交 f6126b4fc9243eb3990f2c0bad86e2afcb502f22：核对新增内部导入 getGroupPastChats 与 timestampToMoment 的导出和返回结构。真实 TT WebView、软键盘、虚拟化未测试。本轮不增加实机兼容承诺。

证据目录：工作台 output/playwright/cg-usability/。controls-result.txt、sidebar-result.txt、native-css-result.txt、iframe-result.txt、final-responsive-result.txt 分别记录检查。iframe-before/after/white-preserved.png 为同一受控样本对照；desktop/mobile/sidebar 与 light 截图为最终布局。静态产物一致性另见 artifact-checks.json。

恢复点：工作台证据目录中的源码 source-before/，工程 project-before.json、source-bindings-before.json、tickets-before.json；工作台快照 e80d9ef7e36202b934f27315bdcadd7d。验证期间未改写日常主题。
