import { Router } from "express";

export const webchatWidgetRouter = Router();

/**
 * GET /api/webchat/widget.js?key=WIDGET_KEY
 * Serves a self-contained, embeddable chat widget script.
 * Customers embed this on their external websites via:
 *   <script src="https://YOUR_DOMAIN/api/webchat/widget.js?key=WIDGET_KEY"></script>
 */
webchatWidgetRouter.get("/api/webchat/widget.js", (req, res) => {
  const widgetKey = req.query.key as string;
  if (!widgetKey) {
    res.status(400).type("text/javascript").send("console.error('[ApexChat] Missing widget key');");
    return;
  }

  // The script determines the API base from its own <script> src
  const widgetScript = `
(function() {
  'use strict';
  if (window.__apexChatLoaded) return;
  window.__apexChatLoaded = true;

  var WIDGET_KEY = ${JSON.stringify(widgetKey)};
  var API_BASE = (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('/api/webchat/widget.js') !== -1) {
        return src.split('/api/webchat/widget.js')[0];
      }
    }
    return '';
  })();

  // ─── State ───
  var state = {
    sessionKey: localStorage.getItem('apex_chat_session_' + WIDGET_KEY) || '',
    config: null,
    messages: [],
    isOpen: false,
    isLoading: false,
    hasVisitorInfo: false,
    lastMessageId: 0,
    pollTimer: null,
  };

  // ─── Styles ───
  var style = document.createElement('style');
  style.textContent = \`
    #apex-chat-container * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #apex-chat-bubble {
      position: fixed; bottom: 20px; width: 60px; height: 60px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 99999; transition: transform 0.2s;
    }
    #apex-chat-bubble:hover { transform: scale(1.1); }
    #apex-chat-bubble svg { width: 28px; height: 28px; fill: white; }
    #apex-chat-window {
      position: fixed; bottom: 90px; width: 380px; max-width: calc(100vw - 32px);
      height: 520px; max-height: calc(100vh - 120px); border-radius: 16px;
      background: #fff; box-shadow: 0 8px 40px rgba(0,0,0,0.15); z-index: 99999;
      display: none; flex-direction: column; overflow: hidden;
    }
    #apex-chat-window.open { display: flex; }
    .apex-chat-header {
      padding: 16px; color: white; font-weight: 600; font-size: 15px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .apex-chat-header button { background: none; border: none; color: white; cursor: pointer; font-size: 20px; line-height: 1; }
    .apex-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px;
    }
    .apex-msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .apex-msg.visitor { align-self: flex-end; background: #f0f0f0; color: #333; border-bottom-right-radius: 4px; }
    .apex-msg.ai, .apex-msg.agent { align-self: flex-start; color: white; border-bottom-left-radius: 4px; }
    .apex-chat-input-area {
      padding: 12px 16px; border-top: 1px solid #eee; display: flex; gap: 8px; align-items: center;
    }
    .apex-chat-input-area input, .apex-chat-input-area textarea {
      flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; font-size: 14px;
      outline: none; resize: none; min-height: 40px; max-height: 80px;
    }
    .apex-chat-input-area button {
      border: none; border-radius: 8px; padding: 10px 16px; color: white; cursor: pointer;
      font-size: 14px; font-weight: 500; white-space: nowrap;
    }
    .apex-chat-input-area button:disabled { opacity: 0.6; cursor: not-allowed; }
    .apex-visitor-form { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .apex-visitor-form label { font-size: 13px; color: #555; font-weight: 500; }
    .apex-visitor-form input {
      width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none;
    }
    .apex-visitor-form button {
      border: none; border-radius: 8px; padding: 12px; color: white; cursor: pointer;
      font-size: 14px; font-weight: 600; margin-top: 4px;
    }
    .apex-typing { display: flex; gap: 4px; padding: 8px 14px; align-self: flex-start; }
    .apex-typing span { width: 8px; height: 8px; border-radius: 50%; background: #ccc; animation: apex-bounce 1.4s infinite both; }
    .apex-typing span:nth-child(2) { animation-delay: 0.2s; }
    .apex-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes apex-bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
    .apex-powered { text-align: center; padding: 6px; font-size: 11px; color: #999; }
  \`;
  document.head.appendChild(style);

  // ─── DOM ───
  var container = document.createElement('div');
  container.id = 'apex-chat-container';
  document.body.appendChild(container);

  function render() {
    var brandColor = (state.config && state.config.brandColor) || '#6366f1';
    var position = (state.config && state.config.position) || 'bottom-right';
    var posStyle = position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;';

    container.innerHTML = \`
      <div id="apex-chat-bubble" style="background: \${brandColor}; \${posStyle}">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </div>
      <div id="apex-chat-window" class="\${state.isOpen ? 'open' : ''}" style="\${posStyle}">
        <div class="apex-chat-header" style="background: \${brandColor};">
          <span>Chat with us</span>
          <button id="apex-close-btn">&times;</button>
        </div>
        <div id="apex-chat-body"></div>
      </div>
    \`;

    var body = document.getElementById('apex-chat-body');
    if (!body) return;

    // Show visitor info form if needed
    if (state.config && state.config.collectVisitorInfo && !state.hasVisitorInfo) {
      body.innerHTML = \`
        <div class="apex-visitor-form">
          <p style="font-size:14px; color:#333; margin-bottom:4px;">\${state.config.greeting || 'Hi! How can we help?'}</p>
          <label>Name</label>
          <input id="apex-vname" placeholder="Your name" />
          <label>Email</label>
          <input id="apex-vemail" type="email" placeholder="your@email.com" />
          <button id="apex-vsubmit" style="background:\${brandColor};">Start Chat</button>
        </div>
      \`;
      document.getElementById('apex-vsubmit').onclick = submitVisitorInfo;
    } else {
      // Messages + input
      var msgsHtml = state.messages.map(function(m) {
        var cls = m.sender === 'visitor' ? 'visitor' : (m.sender === 'agent' ? 'agent' : 'ai');
        var bgStyle = cls !== 'visitor' ? 'background:' + brandColor + ';' : '';
        return '<div class="apex-msg ' + cls + '" style="' + bgStyle + '">' + escapeHtml(m.content) + '</div>';
      }).join('');

      if (state.isLoading) {
        msgsHtml += '<div class="apex-typing"><span></span><span></span><span></span></div>';
      }

      body.innerHTML = \`
        <div class="apex-chat-messages" id="apex-msgs">\${msgsHtml}</div>
        <div class="apex-chat-input-area">
          <textarea id="apex-input" rows="1" placeholder="Type a message..." \${state.isLoading ? 'disabled' : ''}></textarea>
          <button id="apex-send" style="background:\${brandColor};" \${state.isLoading ? 'disabled' : ''}>Send</button>
        </div>
        <div class="apex-powered">Powered by Sterling Marketing</div>
      \`;

      // Scroll to bottom
      var msgsEl = document.getElementById('apex-msgs');
      if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

      // Bind events
      var sendBtn = document.getElementById('apex-send');
      var inputEl = document.getElementById('apex-input');
      if (sendBtn) sendBtn.onclick = sendMessage;
      if (inputEl) {
        inputEl.onkeydown = function(e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        };
      }
    }

    // Bubble & close
    var bubble = document.getElementById('apex-chat-bubble');
    if (bubble) bubble.onclick = function() { state.isOpen = !state.isOpen; render(); };
    var closeBtn = document.getElementById('apex-close-btn');
    if (closeBtn) closeBtn.onclick = function() { state.isOpen = false; render(); };
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── API calls ───
  function apiPost(path, body) {
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function(r) { return r.json(); });
  }

  function apiGet(path) {
    return fetch(API_BASE + path).then(function(r) { return r.json(); });
  }

  function initSession(visitorName, visitorEmail) {
    return apiPost('/api/webchat/init', {
      widgetKey: WIDGET_KEY,
      sessionKey: state.sessionKey || undefined,
      visitorName: visitorName || undefined,
      visitorEmail: visitorEmail || undefined,
      pageUrl: window.location.href,
    }).then(function(data) {
      if (data.error) { console.error('[ApexChat]', data.error); return; }
      state.sessionKey = data.sessionKey;
      state.config = data;
      state.hasVisitorInfo = data.hasVisitorInfo || !data.collectVisitorInfo;
      state.messages = data.messages || [];
      state.lastMessageId = state.messages.length > 0 ? state.messages[state.messages.length - 1].id : 0;
      localStorage.setItem('apex_chat_session_' + WIDGET_KEY, data.sessionKey);

      // Add greeting as first message if no messages yet
      if (state.messages.length === 0 && data.greeting) {
        state.messages.push({ id: 0, sender: 'ai', content: data.greeting, createdAt: new Date().toISOString() });
      }

      render();
      startPolling();
    });
  }

  function submitVisitorInfo() {
    var name = (document.getElementById('apex-vname') || {}).value || '';
    var email = (document.getElementById('apex-vemail') || {}).value || '';
    if (!email) { alert('Please enter your email address.'); return; }
    state.hasVisitorInfo = true;
    initSession(name, email);
  }

  function sendMessage() {
    var inputEl = document.getElementById('apex-input');
    if (!inputEl) return;
    var content = inputEl.value.trim();
    if (!content || state.isLoading) return;

    // Optimistic add
    state.messages.push({ id: Date.now(), sender: 'visitor', content: content, createdAt: new Date().toISOString() });
    state.isLoading = true;
    render();

    apiPost('/api/webchat/message', {
      widgetKey: WIDGET_KEY,
      sessionKey: state.sessionKey,
      content: content,
    }).then(function(data) {
      state.isLoading = false;
      if (data.reply) {
        state.messages.push({ id: data.reply.id || Date.now(), sender: data.reply.sender, content: data.reply.content, createdAt: new Date().toISOString() });
        state.lastMessageId = Math.max(state.lastMessageId, data.reply.id || 0);
      }
      render();
    }).catch(function() {
      state.isLoading = false;
      render();
    });
  }

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(function() {
      if (!state.sessionKey) return;
      apiGet('/api/webchat/poll?widgetKey=' + WIDGET_KEY + '&sessionKey=' + state.sessionKey + '&after=' + state.lastMessageId)
        .then(function(data) {
          if (data.messages && data.messages.length > 0) {
            data.messages.forEach(function(m) {
              // Avoid duplicates
              if (!state.messages.some(function(em) { return em.id === m.id; })) {
                state.messages.push(m);
                state.lastMessageId = Math.max(state.lastMessageId, m.id);
              }
            });
            render();
          }
        })
        .catch(function() {});
    }, 3000);
  }

  // ─── Initialize ───
  initSession();
})();
`;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  // Allow cross-origin embedding
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(widgetScript);
});
