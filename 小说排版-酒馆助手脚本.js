/* ============================================================
   小说感排版 · 酒馆助手（Tavern Helper / JS-Slash-Runner）脚本
   ------------------------------------------------------------
   用酒馆助手脚本接口在“显示层”把正文排成小说感：
   只改当前显示，不修改聊天记录、不污染发给模型的上下文，
   也不用任何正则。

   特点：
   - 自动给每段加首行缩进 + 段间空行；
   - 单换行 / 多换行挤在一起的文本都能正确分段；
   - 自动跳过 <details> 折叠块、代码块、引用、表格、列表、
     HTML 注释等，隐藏草稿不会被翻出来；
   - 思维链/推理在正文之外，天然不受影响。

   关键：酒馆助手脚本运行在 iframe 沙箱里，所以必须通过
   retrieveDisplayedMessage() 取楼层、用 window.parent 访问
   主界面 DOM，而不能直接用本 iframe 的 document。

   用法：
   酒馆助手 → 脚本库 → 新建脚本 → 粘贴本文件全部内容 →
   保存并启用。
   ============================================================ */

(function () {
  'use strict';

  // ===== 可调配置 =====
  const CONFIG = {
    indent:     '2em',    // 首行缩进，设为 '0' 可取消缩进
    paraGap:    '0.9em',  // 段间距，数值越大空行感越强
    lineHeight: '1.85',   // 行距
    formatUser: false,    // 是否也排版“你发出的消息”（true / false）
  };

  // 主界面（父窗口）的 document —— 酒馆助手脚本在 iframe 内运行
  const pdoc = window.parent.document;
  const STYLE_ID = 'novel-format-style';

  // 这些块级内容原样保留，不参与正文分段/缩进
  const SKIP_TAGS = new Set([
    'DETAILS', 'PRE', 'CODE', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY',
    'TR', 'TD', 'TH', 'UL', 'OL', 'LI', 'HR', 'IMG', 'FIGURE',
    'VIDEO', 'AUDIO', 'IFRAME', 'DIV',
  ]);

  // 把样式注入到主界面 <head>
  function injectStyle() {
    if (pdoc.getElementById(STYLE_ID)) {
      pdoc.getElementById(STYLE_ID).remove();
    }
    const s = pdoc.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      `.mes_text .novel-para{` +
      `text-indent:${CONFIG.indent};` +
      `margin:0 0 ${CONFIG.paraGap};` +
      `line-height:${CONFIG.lineHeight};}` +
      `.mes_text .novel-para:last-child{margin-bottom:0;}`;
    pdoc.head.appendChild(s);
  }

  // 把单个 .mes_text 容器内的正文重组为段落（root 为主界面 DOM 节点）
  function formatRoot(root) {
    if (!root || root.dataset.novelFormatted === '1') return;

    const frag = pdoc.createDocumentFragment();
    let buf = [];

    const flush = () => {
      const hasContent = buf.some(
        (n) => n.nodeType === 1 || (n.textContent && n.textContent.trim())
      );
      if (!hasContent) { buf = []; return; }
      const p = pdoc.createElement('p');
      p.className = 'novel-para';
      buf.forEach((n) => p.appendChild(n));
      frag.appendChild(p);
      buf = [];
    };

    Array.from(root.childNodes).forEach((node) => {
      // 注释节点：原样保留，不显示
      if (node.nodeType === 8) { flush(); frag.appendChild(node); return; }

      // 元素节点
      if (node.nodeType === 1) {
        const tag = node.tagName;
        if (tag === 'BR') { flush(); return; }                 // 换行 => 分段
        if (tag === 'P') {                                      // 已分好的段落
          flush();
          node.classList.add('novel-para');
          frag.appendChild(node);
          return;
        }
        if (SKIP_TAGS.has(tag)) { flush(); frag.appendChild(node); return; }
        buf.push(node);                                         // 内联元素 b/i/em/span/a...
        return;
      }

      // 文本节点：按换行拆分成多段
      if (node.nodeType === 3) {
        const parts = node.textContent.split('\n');
        parts.forEach((part, i) => {
          if (i > 0) flush();
          if (part) buf.push(pdoc.createTextNode(part));
        });
        return;
      }

      buf.push(node);
    });

    flush();
    root.innerHTML = '';
    root.appendChild(frag);
    root.dataset.novelFormatted = '1';
  }

  // 排版单条楼层（通过酒馆助手接口取 .mes_text）
  function formatMessage(message_id) {
    if (message_id === undefined || message_id === null) return;
    const $mes = retrieveDisplayedMessage(message_id);   // 酒馆助手 API，返回 .mes_text 的 jQuery
    if (!$mes || $mes.length === 0) return;
    // 不排版用户消息（除非开启）
    if (!CONFIG.formatUser && $mes.closest('.mes').attr('is_user') === 'true') return;
    $mes.each((_, el) => formatRoot(el));
  }

  // 排版当前所有已显示楼层（用于切换聊天 / 首次加载）
  function formatAll() {
    const sel = CONFIG.formatUser
      ? '#chat .mes .mes_text'
      : '#chat .mes[is_user="false"] .mes_text';
    pdoc.querySelectorAll(sel).forEach(formatRoot);
  }

  let timer = null;
  function scheduleAll() {
    clearTimeout(timer);
    timer = setTimeout(formatAll, 50);
  }

  injectStyle();

  // 监听渲染事件：渲染后自动排版对应楼层
  const RENDER_EVENTS = ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED'];
  RENDER_EVENTS.forEach((name) => {
    try {
      if (typeof tavern_events !== 'undefined' && tavern_events[name]) {
        eventOn(tavern_events[name], formatMessage);
      }
    } catch (e) { /* 忽略不存在的事件 */ }
  });

  // 切换聊天 / 加载时全量排版
  ['CHAT_CHANGED', 'MORE_MESSAGES_LOADED'].forEach((name) => {
    try {
      if (typeof tavern_events !== 'undefined' && tavern_events[name]) {
        eventOn(tavern_events[name], scheduleAll);
      }
    } catch (e) { /* 忽略 */ }
  });

  scheduleAll(); // 首次启用时立即排版当前楼层
})();
