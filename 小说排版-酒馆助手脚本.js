/* ============================================================
   小说感排版 · 酒馆助手（SillyTavern-Helper）脚本
   ------------------------------------------------------------
   纯前端渲染处理：只在“显示层”把正文排成小说感，
   不修改聊天记录、不污染发给模型的上下文，也不用任何正则。

   特点：
   - 自动给每段加首行缩进 + 段间空行；
   - 单换行 / 多换行挤在一起的文本都能正确分段；
   - 自动跳过 <details> 折叠块、代码块、引用、表格、列表、
     HTML 注释等，隐藏草稿不会被翻出来；
   - 思维链/推理在正文之外，天然不受影响。

   用法：
   酒馆助手插件 → 脚本库（全局脚本）→ 新建脚本 →
   粘贴本文件全部内容 → 保存并启用。
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

  const STYLE_ID = 'novel-format-style';
  // 这些块级内容原样保留，不参与正文分段/缩进
  const SKIP_TAGS = new Set([
    'DETAILS', 'PRE', 'CODE', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY',
    'TR', 'TD', 'TH', 'UL', 'OL', 'LI', 'HR', 'IMG', 'FIGURE',
    'VIDEO', 'AUDIO', 'IFRAME', 'DIV',
  ]);

  function injectStyle() {
    let s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      document.head.appendChild(s);
    }
    s.textContent =
      `.mes_text .novel-para{` +
      `text-indent:${CONFIG.indent};` +
      `margin:0 0 ${CONFIG.paraGap};` +
      `line-height:${CONFIG.lineHeight};}` +
      `.mes_text .novel-para:last-child{margin-bottom:0;}`;
  }

  // 把单个 .mes_text 容器内的正文重组为段落
  function formatRoot(root) {
    if (!root || root.dataset.novelFormatted === '1') return;

    const frag = document.createDocumentFragment();
    let buf = [];

    const flush = () => {
      const hasContent = buf.some(
        (n) => n.nodeType === 1 || (n.textContent && n.textContent.trim())
      );
      if (!hasContent) { buf = []; return; }
      const p = document.createElement('p');
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
          if (part) buf.push(document.createTextNode(part));
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

  function formatAll() {
    const selector = CONFIG.formatUser
      ? '#chat .mes .mes_text'
      : '#chat .mes[is_user="false"] .mes_text';
    document.querySelectorAll(selector).forEach(formatRoot);
  }

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(formatAll, 50);
  }

  injectStyle();

  // 监听酒馆相关事件，渲染后自动排版
  const EVENTS = [
    'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED',
    'MESSAGE_RENDERED', 'MESSAGE_EDITED', 'MESSAGE_SWIPED',
    'MESSAGE_UPDATED', 'CHAT_CHANGED',
  ];
  EVENTS.forEach((name) => {
    try {
      if (typeof tavern_events !== 'undefined' && tavern_events[name]) {
        eventOn(tavern_events[name], schedule);
      }
    } catch (e) { /* 忽略不存在的事件 */ }
  });

  schedule(); // 首次加载立即排版当前楼层
})();
