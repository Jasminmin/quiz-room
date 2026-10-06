/* Login gate: decrypts data/vault.json in the browser, then boots js/app.js. */
(function () {
  'use strict';

  const KEY_STORE = 'quizroom.key';
  const $app = document.getElementById('app');
  let vault = null;

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

  function readStoredKey() {
    try { return localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE); } catch (e) { return null; }
  }
  function storeKey(raw, remember) {
    try {
      (remember ? localStorage : sessionStorage).setItem(KEY_STORE, raw);
    } catch (e) { /* storage unavailable: user just logs in again next time */ }
  }
  function clearKey() {
    try { localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ }
  }
  window.quizLogout = () => { clearKey(); location.hash = ''; location.reload(); };

  async function loadVault() {
    if (vault) return vault;
    const res = await fetch('data/vault.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('vault ' + res.status);
    vault = await res.json();
    return vault;
  }

  async function deriveKey(password, v) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(v.salt), iterations: v.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }

  async function decrypt(key, v) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(v.iv) }, key, b64(v.ct));
    const stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }

  function boot(data) {
    window.QUESTIONS = data.questions;
    window.PBQS = data.pbqs;
    window.IMAGES = data.images;
    document.body.classList.remove('locked');
    const s = document.createElement('script');
    s.src = 'js/app.js';
    document.body.appendChild(s);
  }

  function showLogin(message) {
    document.body.classList.add('locked');
    $app.innerHTML = `
      <div class="login-wrap">
        <form class="card login" id="loginForm" autocomplete="on">
          <div class="login-icon">🔒</div>
          <h1>Quiz Room</h1>
          <p class="muted small">請輸入密碼解鎖。題庫已加密，只有輸入正確密碼才能在你的瀏覽器中解開。</p>
          <input type="text" name="username" value="quiz-room" autocomplete="username" hidden>
          <div class="field">
            <label for="pw">密碼</label>
            <input type="password" id="pw" name="password" autocomplete="current-password" required autofocus>
          </div>
          <label class="small" style="display:flex;gap:6px;align-items:center;margin-bottom:14px">
            <input type="checkbox" id="remember" checked> 在這台裝置記住我</label>
          <div class="login-msg small" id="msg" role="alert">${message || ''}</div>
          <button class="btn primary" style="width:100%" id="go">解鎖</button>
        </form>
      </div>`;
    document.getElementById('loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('go');
      const msg = document.getElementById('msg');
      btn.disabled = true; btn.textContent = '解鎖中…'; msg.textContent = '';
      try {
        const v = await loadVault();
        const key = await deriveKey(document.getElementById('pw').value, v);
        const data = await decrypt(key, v);
        storeKey(toB64(await crypto.subtle.exportKey('raw', key)), document.getElementById('remember').checked);
        boot(data);
      } catch (err) {
        btn.disabled = false; btn.textContent = '解鎖';
        msg.textContent = err && err.name === 'OperationError' ? '密碼錯誤，請再試一次。' : '無法載入資料，請檢查網路後重試。';
        document.getElementById('pw').select();
      }
    });
  }

  async function start() {
    if (!window.crypto || !crypto.subtle || !window.DecompressionStream) {
      showLogin('你的瀏覽器不支援所需的加密功能，請改用最新版 Chrome、Edge、Safari 或 Firefox。');
      return;
    }
    const raw = readStoredKey();
    if (raw) {
      $app.innerHTML = '<div class="empty">載入中…</div>';
      try {
        const v = await loadVault();
        const key = await crypto.subtle.importKey('raw', b64(raw), 'AES-GCM', false, ['decrypt']);
        boot(await decrypt(key, v));
        return;
      } catch (e) {
        clearKey(); // password changed or key corrupted
      }
    }
    showLogin();
  }

  start();
})();
