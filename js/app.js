/* Quiz Room — timed practice exam, static single-page app. Data is injected by js/auth.js. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  const EXAM = {
    total: 90,              // official: maximum of 90 questions
    minutes: 90,            // official: 90 minutes
    pass: 750,              // official: 750 on a 100–900 scale
    min: 100, max: 900,
  };
  const DOMAINS = {
    1: { en: 'General Security Concepts', zh: '一般安全概念', w: 12 },
    2: { en: 'Threats, Vulnerabilities, and Mitigations', zh: '威脅、弱點與緩解措施', w: 22 },
    3: { en: 'Security Architecture', zh: '安全架構', w: 18 },
    4: { en: 'Security Operations', zh: '安全維運', w: 28 },
    5: { en: 'Security Program Management and Oversight', zh: '安全計畫管理與監督', w: 20 },
  };
  const LESSONS = {
    '1A': 'Security Concepts 安全概念', '1B': 'Security Controls 安全控制',
    '2A': 'Threat Actors 威脅行為者', '2B': 'Attack Surfaces 攻擊面', '2C': 'Social Engineering 社交工程',
    '3A': 'Cryptographic Algorithms 密碼演算法', '3B': 'Public Key Infrastructure 公開金鑰基礎建設', '3C': 'Cryptographic Solutions 密碼學解決方案',
    '4A': 'Authentication 驗證', '4B': 'Authorization 授權', '4C': 'Identity Management 身分管理',
    '5A': 'Enterprise Network Architecture 企業網路架構', '5B': 'Network Security Appliances 網路安全設備', '5C': 'Secure Communications 安全通訊',
    '6A': 'Cloud Infrastructure 雲端基礎架構', '6B': 'Embedded Systems and Zero Trust Architecture 嵌入式系統與零信任',
    '7A': 'Asset Management 資產管理', '7B': 'Redundancy Strategies 備援策略', '7C': 'Physical Security 實體安全',
    '8A': 'Device and OS Vulnerabilities 裝置與作業系統弱點', '8B': 'Application and Cloud Vulnerabilities 應用程式與雲端弱點',
    '8C': 'Vulnerability Identification Methods 弱點識別方法', '8D': 'Vulnerability Analysis and Remediation 弱點分析與修補',
    '9A': 'Network Security Baselines 網路安全基準', '9B': 'Network Security Capability Enhancement 網路安全能力強化',
    '10A': 'Implement Endpoint Security 端點安全', '10B': 'Mobile Device Hardening 行動裝置強化',
    '11A': 'Application Protocol Security Baselines 應用協定安全基準', '11B': 'Cloud and Web Application Security Concepts 雲端與網頁應用安全',
    '12A': 'Incident Response 事件應變', '12B': 'Digital Forensics 數位鑑識', '12C': 'Data Sources 資料來源', '12D': 'Alerting and Monitoring Tools 告警與監控工具',
    '13A': 'Malware Attack Indicators 惡意軟體攻擊指標', '13B': 'Physical and Network Attack Indicators 實體與網路攻擊指標', '13C': 'Application Attack Indicators 應用程式攻擊指標',
    '14A': 'Policies, Standards, and Procedures 政策、標準與程序', '14B': 'Change Management 變更管理', '14C': 'Automation and Orchestration 自動化與編排',
    '15A': 'Risk Management Processes and Concepts 風險管理', '15B': 'Vendor Management Concepts 供應商管理', '15C': 'Audits and Assessments 稽核與評估',
    '16A': 'Data Classification and Compliance 資料分類與合規', '16B': 'Personnel Policies 人員政策',
  };
  const LS = { session: 'quizroom.session', history: 'quizroom.history', wrong: 'quizroom.wrong', seen: 'quizroom.seen', theme: 'quizroom.theme' };

  const Q = window.QUESTIONS || [];
  const IMAGES = window.IMAGES || {};
  const imgSrc = f => IMAGES[f] || '';
  const PBQS = window.PBQS || [];
  const byN = new Map(Q.map(q => [q.n, q]));

  // ---------------------------------------------------------------- storage helpers
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ }
  }
  function drop(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- utils
  const $app = document.getElementById('app');
  const $modal = document.getElementById('modal');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rich = s => esc(s).replace(/\[\[IMG:([^\]]+)\]\]/g, (_, f) => `<img src="${imgSrc(f)}" alt="題目附圖" loading="lazy">`);
  const plain = s => String(s).replace(/\[\[IMG:[^\]]+\]\]/g, '［圖］');
  const letters = 'ABCDEFGH';
  const norm = s => (s || '').split('').sort().join('');
  const isCorrect = (q, ans) => !!ans && norm(ans) === norm(q.a);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtTime = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(ss).padStart(2, '0'); };
  const fmtDate = t => new Date(t).toLocaleString('zh-TW', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const scaled = (c, t) => t ? Math.round(EXAM.min + (EXAM.max - EXAM.min) * c / t) : EXAM.min;
  const domainTag = d => DOMAINS[d] ? `<span class="tag">Domain ${d}.0 ${esc(DOMAINS[d].zh)}</span>` : '';

  function explHTML(q, head) {
    const lines = esc(q.e || '（此題詳解尚未提供）').split('\n').map(l => {
      if (l.startsWith('✔')) return `<span class="ok-line">${l}</span>`;
      if (l.startsWith('💡')) return `<span class="tip-line">${l}</span>`;
      return l;
    }).join('\n');
    const ref = [];
    if (q.l && LESSONS[q.l]) ref.push(`📘 教材對應：Lesson ${q.l} ${esc(LESSONS[q.l])}`);
    if (q.v && q.v.length) ref.push(`👥 社群投票：${esc(q.v.join('、'))}`);
    if (q.k && norm(q.k) !== norm(q.a)) ref.push(`⚠️ 原題庫標示答案為 ${esc(q.k)}，本站依詳解分析改採 ${esc(q.a)}`);
    return `<div class="expl"><h4>📖 繁體中文詳解 — ${head || '正確答案：' + esc(q.a.split('').join('、'))}</h4>
      <div class="body">${lines}</div>${ref.length ? `<div class="ref">${ref.join('<br>')}</div>` : ''}</div>`;
  }

  function recordAttempt(q, ans) {
    const ok = isCorrect(q, ans);
    const seen = load(LS.seen, {});
    const s = seen[q.n] || { c: 0, w: 0 };
    ok ? s.c++ : s.w++;
    seen[q.n] = s; save(LS.seen, seen);
    const wrong = load(LS.wrong, {});
    if (!ok) wrong[q.n] = { w: ((wrong[q.n] || {}).w || 0) + 1, t: Date.now() };
    save(LS.wrong, wrong);
    return ok;
  }

  // ---------------------------------------------------------------- modal
  function modal(html, onMount) {
    $modal.innerHTML = `<div class="card">${html}</div>`;
    $modal.classList.remove('hidden');
    if (onMount) onMount($modal);
  }
  function closeModal() { $modal.classList.add('hidden'); $modal.innerHTML = ''; }
  $modal.addEventListener('click', e => { if (e.target === $modal) closeModal(); });
  function confirmBox(title, body, okText, onOk) {
    modal(`<h3>${title}</h3><div>${body}</div><div class="row" style="margin-top:16px;justify-content:flex-end">
      <button class="btn" data-x>取消</button><button class="btn primary" data-ok>${okText}</button></div>`, m => {
      m.querySelector('[data-x]').onclick = closeModal;
      m.querySelector('[data-ok]').onclick = () => { closeModal(); onOk(); };
    });
  }

  // ---------------------------------------------------------------- session
  let session = load(LS.session, null);
  let timerId = null;

  function pickExamQuestions(preferUnseen) {
    const seen = load(LS.seen, {});
    const counts = {}; let sum = 0;
    for (const d in DOMAINS) { counts[d] = Math.round(EXAM.total * DOMAINS[d].w / 100); sum += counts[d]; }
    counts[4] += EXAM.total - sum;
    const picked = new Set();
    const order = list => preferUnseen ? shuffle(list).sort((a, b) => (seen[a.n] ? 1 : 0) - (seen[b.n] ? 1 : 0)) : shuffle(list);
    for (const d in counts) {
      order(Q.filter(q => String(q.d) === d)).slice(0, counts[d]).forEach(q => picked.add(q.n));
    }
    for (const q of order(Q)) { if (picked.size >= EXAM.total) break; picked.add(q.n); }
    return shuffle([...picked]);
  }

  function startSession(opts) {
    session = Object.assign({
      id: Date.now(), ids: [], answers: {}, flags: [], struck: {}, checked: {}, idx: 0,
      started: Date.now(), deadline: null, instant: false, mode: 'exam', title: '模擬考',
    }, opts);
    if (session.minutes) session.deadline = Date.now() + session.minutes * 60000;
    save(LS.session, session);
    location.hash = '#/exam';
  }
  const persist = () => save(LS.session, session);

  function finishSession() {
    if (!session) return;
    clearInterval(timerId);
    const ids = session.ids;
    let correct = 0;
    const byDomain = {};
    ids.forEach(n => {
      const q = byN.get(n); if (!q) return;
      const ans = session.answers[n];
      const ok = isCorrect(q, ans);
      if (ok) correct++;
      const d = byDomain[q.d] || (byDomain[q.d] = { c: 0, t: 0 });
      d.t++; if (ok) d.c++;
      if (!session.instant && ans) recordAttempt(q, ans);
      if (!session.instant && !ans) { const w = load(LS.wrong, {}); w[n] = { w: ((w[n] || {}).w || 0) + 1, t: Date.now() }; save(LS.wrong, w); }
    });
    const result = {
      id: session.id, mode: session.mode, title: session.title, date: Date.now(),
      used: Math.round((Date.now() - session.started) / 1000), limit: session.minutes ? session.minutes * 60 : null,
      ids, answers: session.answers, flags: session.flags, correct, total: ids.length,
      score: scaled(correct, ids.length), byDomain,
    };
    const hist = load(LS.history, []);
    hist.unshift(result);
    save(LS.history, hist.slice(0, 50));
    session = null; drop(LS.session);
    document.body.classList.remove('in-exam');
    location.hash = '#/result/' + result.id;
  }

  // ---------------------------------------------------------------- views
  function viewHome() {
    const hist = load(LS.history, []);
    const exams = hist.filter(h => h.mode === 'exam');
    const seen = load(LS.seen, {});
    const wrongN = Object.keys(load(LS.wrong, {})).length;
    const best = exams.reduce((m, h) => Math.max(m, h.score), 0);
    const missing = Q.filter(q => !q.e).length;
    $app.innerHTML = `
      ${session ? `<div class="notice" style="margin-bottom:14px">你有一份進行中的「${esc(session.title)}」（已作答 ${Object.keys(session.answers).length}/${session.ids.length} 題）。
        <a href="#/exam"><b>繼續作答 →</b></a></div>` : ''}
      <div class="hero">
        <div class="card">
          <h1><span style="color:var(--accent)">Quiz</span> Room</h1>
          <p class="muted">依官方考試規則設計的模擬考：90 題、90 分鐘、100–900 分制、750 分及格。交卷後提供每題的<b>繁體中文詳解</b>，並對應 CertMaster 教材章節。</p>
          <ul class="rules">
            <li><span class="k">題數</span><span class="v">最多 90 題（單選、複選、情境題 PBQ）</span></li>
            <li><span class="k">考試時間</span><span class="v">90 分鐘</span></li>
            <li><span class="k">及格分數</span><span class="v">750 分（量尺 100–900）</span></li>
            <li><span class="k">題庫</span><span class="v">${Q.length} 題選擇題 + ${PBQS.length} 題 PBQ</span></li>
          </ul>
          <div class="row" style="margin-top:18px">
            <button class="btn primary" id="startExam">▶ 開始正式模擬考</button>
            <a class="btn" href="#/practice">練習模式</a>
            <a class="btn" href="#/pbq">PBQ 情境題</a>
          </div>
          <label class="small muted" style="display:flex;gap:6px;align-items:center;margin-top:10px">
            <input type="checkbox" id="preferUnseen" checked> 優先抽出還沒做過的題目</label>
        </div>
        <div class="card">
          <h3 style="margin-top:0">我的進度</h3>
          <div class="stats">
            <div class="stat"><div class="n">${Object.keys(seen).length}<span class="small muted">/${Q.length}</span></div><div class="l">已作答題數</div></div>
            <div class="stat"><div class="n">${exams.length}</div><div class="l">模擬考次數</div></div>
            <div class="stat"><div class="n" style="color:${best >= EXAM.pass ? 'var(--ok)' : 'inherit'}">${best || '—'}</div><div class="l">最佳分數</div></div>
            <div class="stat"><div class="n">${wrongN}</div><div class="l"><a href="#/wrong">錯題本</a></div></div>
          </div>
          ${exams.length ? `<h3>最近成績</h3>${exams.slice(0, 4).map(h => `
            <div class="row small" style="padding:4px 0"><a href="#/result/${h.id}">${fmtDate(h.date)}</a><span class="spacer"></span>
            <b style="color:${h.score >= EXAM.pass ? 'var(--ok)' : 'var(--bad)'}">${h.score}</b></div>`).join('')}` : '<p class="muted small">還沒有模擬考紀錄，開始第一次吧！</p>'}
        </div>
      </div>
      <h2>考試範圍（Exam Domains）</h2>
      <div class="card">
        <table class="domain-table">
          <tr><th>Domain</th><th>名稱</th><th class="num">配分</th><th class="num">模擬考題數</th><th class="num">題庫題數</th></tr>
          ${Object.entries(DOMAINS).map(([d, x]) => `<tr><td>${d}.0</td><td>${esc(x.zh)}<div class="small muted">${esc(x.en)}</div></td>
            <td class="num">${x.w}%</td><td class="num">${Math.round(EXAM.total * x.w / 100)}</td><td class="num">${Q.filter(q => q.d == d).length}</td></tr>`).join('')}
        </table>
      </div>
      <h2>作答說明</h2>
      <div class="card small">
        <ul style="margin:0;padding-left:20px">
          <li>正式模擬考<b>作答期間不顯示對錯</b>，與真實考試相同；可標記（⚑）題目，交卷前會出現檢閱畫面。</li>
          <li>時間到會自動交卷。可用鍵盤：<kbd>A</kbd>–<kbd>F</kbd> 選答、<kbd>←</kbd><kbd>→</kbd> 換題、<kbd>M</kbd> 標記；選項右側 ✕ 可用刪去法劃掉選項。</li>
          <li>複選題（Choose two/three）需全部選對才給分。</li>
          <li>分數換算：官方採非線性量尺，本站以答對率線性換算為 100–900 分作為參考（約 81% 答對率 ≈ 750 分）。</li>
          <li>作答進度、成績與錯題本儲存在你的瀏覽器（localStorage），換裝置不會同步。</li>
          ${missing ? `<li class="muted">目前有 ${missing} 題詳解尚在整理中。</li>` : ''}
        </ul>
      </div>
      <footer class="site">個人練習用途，請勿散布題庫內容。</footer>`;
    document.getElementById('startExam').onclick = () => {
      const go = () => startSession({
        mode: 'exam', title: '正式模擬考', minutes: EXAM.minutes, instant: false,
        ids: pickExamQuestions(document.getElementById('preferUnseen').checked),
      });
      if (session) confirmBox('放棄目前進度？', '你有一份進行中的測驗，開始新的模擬考會放棄它。', '開始新考試', go);
      else confirmBox('開始正式模擬考', `共 ${EXAM.total} 題，限時 ${EXAM.minutes} 分鐘。作答期間不會顯示對錯，交卷後才看到分數與詳解。準備好了嗎？`, '開始計時', go);
    };
  }

  function viewPractice() {
    const wrongN = Object.keys(load(LS.wrong, {})).length;
    $app.innerHTML = `
      <h1>練習模式</h1>
      <p class="muted">自訂題數與範圍。可選擇「即時詳解」：每答一題就立刻顯示對錯與繁中詳解。</p>
      <div class="card" style="max-width:640px">
        <div class="field"><label>出題來源</label>
          <select id="src">
            <option value="random">隨機抽題</option>
            <option value="unseen">只出還沒做過的題目</option>
            <option value="range">依題號順序（範圍）</option>
            <option value="wrong">錯題本（${wrongN} 題）</option>
          </select></div>
        <div class="field" id="rangeBox" style="display:none"><label>題號範圍（1–${Q.length ? Math.max(...Q.map(q => q.n)) : 0}）</label>
          <div class="row"><input type="number" id="from" value="1" min="1" style="width:110px"> 到 <input type="number" id="to" value="50" min="1" style="width:110px"></div></div>
        <div class="field" id="countBox"><label>題數</label>
          <select id="count"><option>10</option><option selected>20</option><option>30</option><option>50</option><option>90</option><option value="9999">全部</option></select></div>
        <div class="field"><label>Domain</label>
          <div class="checks">${Object.entries(DOMAINS).map(([d, x]) => `<label><input type="checkbox" name="dom" value="${d}" checked> ${d}.0 ${esc(x.zh)}</label>`).join('')}</div></div>
        <div class="field"><label>模式</label>
          <div class="checks">
            <label><input type="radio" name="inst" value="1" checked> 即時詳解（每題作答後立即顯示）</label>
            <label><input type="radio" name="inst" value="0"> 交卷後才顯示</label></div></div>
        <div class="field"><label>計時</label>
          <select id="mins"><option value="0">不計時</option><option value="1">每題 1 分鐘（同正式考試速度）</option></select></div>
        <div id="pinfo" class="small muted"></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="go">開始練習</button></div>
      </div>`;
    const $ = id => document.getElementById(id);
    const pool = () => {
      const doms = [...document.querySelectorAll('input[name=dom]:checked')].map(i => +i.value);
      let list = Q.filter(q => doms.includes(q.d));
      const src = $('src').value;
      if (src === 'unseen') { const seen = load(LS.seen, {}); list = list.filter(q => !seen[q.n]); }
      if (src === 'wrong') { const w = load(LS.wrong, {}); list = list.filter(q => w[q.n]); }
      if (src === 'range') { const a = +$('from').value, b = +$('to').value; list = list.filter(q => q.n >= a && q.n <= b); }
      return list;
    };
    const refresh = () => {
      $('rangeBox').style.display = $('src').value === 'range' ? '' : 'none';
      $('countBox').style.display = $('src').value === 'range' ? 'none' : '';
      $('pinfo').textContent = `符合條件的題目：${pool().length} 題`;
    };
    $app.querySelectorAll('select,input').forEach(el => el.addEventListener('change', refresh));
    $app.querySelectorAll('input[type=number]').forEach(el => el.addEventListener('input', refresh));
    refresh();
    $('go').onclick = () => {
      const list = pool();
      if (!list.length) { modal('<h3>沒有符合的題目</h3><p>請調整條件。</p><div class="row" style="justify-content:flex-end"><button class="btn" onclick="this.closest(\'.modal\').classList.add(\'hidden\')">好</button></div>'); return; }
      const src = $('src').value;
      const ids = src === 'range' ? list.map(q => q.n) : shuffle(list).slice(0, +$('count').value).map(q => q.n);
      const instant = document.querySelector('input[name=inst]:checked').value === '1';
      const go = () => startSession({
        mode: 'practice', instant, ids, fromWrong: src === 'wrong',
        minutes: +$('mins').value ? ids.length : null,
        title: src === 'wrong' ? '錯題本練習' : src === 'range' ? `題號 ${ids[0]}–${ids[ids.length - 1]} 練習` : `練習 ${ids.length} 題`,
      });
      if (session) confirmBox('放棄目前進度？', '你有一份進行中的測驗，開始新的練習會放棄它。', '開始', go); else go();
    };
  }

  // ---------------------------------------------------------------- exam runner
  function viewExam() {
    if (!session) { location.hash = '#/'; return; }
    document.body.classList.add('in-exam');
    renderExam();
    clearInterval(timerId);
    if (session.deadline) timerId = setInterval(tick, 1000);
  }

  function tick() {
    if (!session || !session.deadline) return;
    const left = (session.deadline - Date.now()) / 1000;
    const el = document.getElementById('timer');
    if (el) { el.textContent = '⏱ ' + fmtTime(left); el.classList.toggle('low', left < 300); }
    if (left <= 0) {
      clearInterval(timerId);
      modal('<h3>⏰ 時間到</h3><p>考試時間已結束，系統將自動交卷。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-ok>查看成績</button></div>',
        m => { m.querySelector('[data-ok]').onclick = () => { closeModal(); finishSession(); }; });
    }
  }

  function renderExam() {
    const s = session, n = s.ids[s.idx], q = byN.get(n);
    const ans = s.answers[n] || '';
    const need = q.a.length;
    const multi = need > 1;
    const checked = s.instant && s.checked[n];
    const answered = Object.keys(s.answers).filter(k => s.answers[k]).length;
    const struck = s.struck[n] || [];
    const flagged = s.flags.includes(n);
    const left = s.deadline ? (s.deadline - Date.now()) / 1000 : null;

    const optHTML = q.o.map((t, i) => {
      const L = letters[i];
      let cls = 'opt' + (multi ? ' multi' : '');
      if (ans.includes(L)) cls += ' sel';
      if (checked) { cls += ' locked'; if (q.a.includes(L)) cls += ' correct'; else if (ans.includes(L)) cls += ' wrong'; }
      if (struck.includes(L)) cls += ' struck';
      return `<div class="${cls}" data-l="${L}" role="button" tabindex="0">
        <span class="letter">${L}</span><span class="otext">${rich(t)}</span>
        ${checked ? '' : `<button class="strike" data-strike="${L}" title="刪去法：劃掉此選項">✕</button>`}</div>`;
    }).join('');

    $app.innerHTML = `
      <div class="exam-head">
        <span class="qcount">第 ${s.idx + 1} / ${s.ids.length} 題</span>
        <span class="small muted">${esc(s.title)}</span>
        <span class="spacer"></span>
        ${left !== null ? `<span class="timer ${left < 300 ? 'low' : ''}" id="timer">⏱ ${fmtTime(left)}</span>` : ''}
        <button class="btn sm" id="navBtn">題目總覽</button>
        <button class="btn sm primary" id="endBtn">${s.instant ? '結束練習' : '交卷'}</button>
        <div class="progress"><i style="width:${answered / s.ids.length * 100}%"></i></div>
      </div>
      <div class="card qbox">
        <div class="qmeta">
          <span class="tag">題庫 #${q.n}</span>
          ${s.mode === 'exam' ? '' : domainTag(q.d)}
          ${multi ? `<span class="tag amber">複選 ${need} 項</span>` : ''}
        </div>
        <div class="qtext">${rich(q.q)}</div>
        ${multi ? `<div class="choose-n">請選擇 ${need} 個答案（已選 ${ans.length}）</div>` : ''}
        <div class="opts">${optHTML}</div>
        ${s.instant && multi && !checked ? `<div class="row" style="margin-top:12px"><button class="btn blue" id="checkBtn" ${ans.length === need ? '' : 'disabled'}>確認答案</button></div>` : ''}
        ${checked ? `<div class="verdict ${isCorrect(q, ans) ? 'ok' : 'bad'}">${isCorrect(q, ans) ? '✅ 答對了！' : `❌ 答錯了，正確答案是 ${q.a.split('').join('、')}`}</div>${explHTML(q)}` : ''}
        <div class="exam-foot">
          <button class="btn" id="prevBtn" ${s.idx === 0 ? 'disabled' : ''}>← 上一題</button>
          <button class="btn ${flagged ? 'on' : ''}" id="flagBtn">⚑ ${flagged ? '已標記' : '標記此題'}</button>
          <span class="spacer"></span>
          ${s.idx === s.ids.length - 1
            ? `<button class="btn primary" id="reviewBtn">${s.instant ? '完成' : '檢閱並交卷'} →</button>`
            : `<button class="btn blue" id="nextBtn">下一題 →</button>`}
        </div>
      </div>
      <p class="small muted" style="margin-top:10px">快捷鍵：<kbd>A</kbd>–<kbd>${letters[q.o.length - 1]}</kbd> 選答　<kbd>←</kbd><kbd>→</kbd> 上下題　<kbd>M</kbd> 標記　選項右側 ✕ 可使用刪去法</p>`;

    const $ = id => document.getElementById(id);
    $app.querySelectorAll('.opt').forEach(el => {
      el.addEventListener('click', e => {
        const st = e.target.closest('[data-strike]');
        if (st) { e.stopPropagation(); toggleStrike(st.dataset.strike); return; }
        choose(el.dataset.l);
      });
    });
    $('prevBtn').onclick = () => go(s.idx - 1);
    if ($('nextBtn')) $('nextBtn').onclick = () => go(s.idx + 1);
    if ($('reviewBtn')) $('reviewBtn').onclick = () => s.instant ? endConfirm() : showNavigator(true);
    if ($('checkBtn')) $('checkBtn').onclick = () => check(n);
    $('flagBtn').onclick = toggleFlag;
    $('navBtn').onclick = () => showNavigator(false);
    $('endBtn').onclick = () => endConfirm();
    window.scrollTo({ top: 0 });
  }

  function choose(L) {
    const s = session, n = s.ids[s.idx], q = byN.get(n);
    if (s.instant && s.checked[n]) return;
    const need = q.a.length;
    let ans = s.answers[n] || '';
    if (need > 1) {
      if (ans.includes(L)) ans = ans.replace(L, '');
      else if (ans.length < need) ans = norm(ans + L);
      else ans = norm(ans.slice(1) + L);
    } else ans = L;
    s.answers[n] = ans;
    if (s.struck[n]) s.struck[n] = s.struck[n].filter(x => x !== L);
    persist();
    if (s.instant && need === 1) { check(n); return; }
    renderExam();
  }
  function check(n) {
    const s = session, q = byN.get(n);
    s.checked[n] = true;
    const ok = recordAttempt(q, s.answers[n]);
    if (ok && s.fromWrong) { const w = load(LS.wrong, {}); delete w[n]; save(LS.wrong, w); }
    persist(); renderExam();
  }
  function toggleStrike(L) {
    const s = session, n = s.ids[s.idx];
    const arr = s.struck[n] || [];
    s.struck[n] = arr.includes(L) ? arr.filter(x => x !== L) : arr.concat(L);
    persist(); renderExam();
  }
  function toggleFlag() {
    const s = session, n = s.ids[s.idx];
    s.flags = s.flags.includes(n) ? s.flags.filter(x => x !== n) : s.flags.concat(n);
    persist(); renderExam();
  }
  function go(i) {
    if (i < 0 || i >= session.ids.length) return;
    session.idx = i; persist(); renderExam();
  }
  function endConfirm() {
    const s = session;
    const un = s.ids.filter(n => !s.answers[n]).length;
    confirmBox(s.instant ? '結束練習？' : '確定交卷？',
      `${un ? `<p>還有 <b style="color:var(--bad)">${un}</b> 題未作答，未作答視為答錯。</p>` : '<p>所有題目都已作答。</p>'}
       ${s.flags.length ? `<p>有 ${s.flags.length} 題標記待檢查。</p>` : ''}<p>交卷後將顯示分數與每題繁中詳解。</p>`,
      s.instant ? '結束並看結果' : '交卷', finishSession);
  }
  function showNavigator(isReview) {
    const s = session;
    const un = s.ids.filter(n => !s.answers[n]).length;
    modal(`<h3>${isReview ? '檢閱畫面（Review）' : '題目總覽'}</h3>
      <p class="small muted">已作答 ${s.ids.length - un}／${s.ids.length}　未作答 ${un}　標記 ${s.flags.length}</p>
      <div class="legend"><span><i style="background:var(--sel);border-color:var(--accent-2)"></i>已作答</span><span><i></i>未作答</span><span>⚑ 已標記</span></div>
      <div class="row" style="margin-bottom:10px">
        <button class="btn sm" data-filter="all">全部</button><button class="btn sm" data-filter="un">只看未作答</button><button class="btn sm" data-filter="flag">只看標記</button></div>
      <div class="nav-grid" id="ng"></div>
      <div class="row" style="margin-top:16px;justify-content:flex-end">
        <button class="btn" data-x>回到題目</button>
        <button class="btn primary" data-end>${s.instant ? '結束練習' : '交卷'}</button></div>`, m => {
      const draw = f => {
        m.querySelector('#ng').innerHTML = s.ids.map((n, i) => {
          if (f === 'un' && s.answers[n]) return '';
          if (f === 'flag' && !s.flags.includes(n)) return '';
          let c = '';
          if (s.instant && s.checked[n]) c = isCorrect(byN.get(n), s.answers[n]) ? 'ok' : 'no';
          else if (s.answers[n]) c = 'ans';
          if (s.flags.includes(n)) c += ' flag';
          if (i === s.idx) c += ' cur';
          return `<button class="${c}" data-i="${i}">${i + 1}</button>`;
        }).join('') || '<p class="muted small">沒有符合的題目</p>';
        m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeModal(); go(+b.dataset.i); });
      };
      draw('all');
      m.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => draw(b.dataset.filter));
      m.querySelector('[data-x]').onclick = closeModal;
      m.querySelector('[data-end]').onclick = () => { closeModal(); endConfirm(); };
    });
  }

  document.addEventListener('keydown', e => {
    if (!session || !location.hash.startsWith('#/exam') || !$modal.classList.contains('hidden')) return;
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toUpperCase();
    const q = byN.get(session.ids[session.idx]);
    const i = letters.indexOf(k);
    if (k.length === 1 && i >= 0 && i < q.o.length) { e.preventDefault(); choose(k); }
    else if (e.key === 'ArrowRight') go(session.idx + 1);
    else if (e.key === 'ArrowLeft') go(session.idx - 1);
    else if (k === 'M') toggleFlag();
  });

  // ---------------------------------------------------------------- results
  function gauge(score) {
    const pct = (score - EXAM.min) / (EXAM.max - EXAM.min);
    const R = 70, C = Math.PI * R; // half circle
    const passPct = (EXAM.pass - EXAM.min) / (EXAM.max - EXAM.min);
    const ang = Math.PI * (1 - passPct);
    const tick = r => `${(90 + r * Math.cos(ang)).toFixed(1)} ${(100 - r * Math.sin(ang)).toFixed(1)}`;
    const ok = score >= EXAM.pass;
    return `<svg class="gauge" viewBox="0 0 180 130" role="img" aria-label="分數 ${score}">
      <path d="M20 100 A70 70 0 0 1 160 100" fill="none" stroke="var(--panel-2)" stroke-width="16" stroke-linecap="round"/>
      <path d="M20 100 A70 70 0 0 1 160 100" fill="none" stroke="${ok ? 'var(--ok)' : 'var(--bad)'}" stroke-width="16" stroke-linecap="round"
        stroke-dasharray="${C * pct} ${C}"/>
      <path d="M${tick(R - 11)} L${tick(R + 11)}" stroke="var(--text)" stroke-width="2.5"/>
      <text x="90" y="92" text-anchor="middle" font-size="34" font-weight="800">${score}</text>
      <text x="90" y="118" text-anchor="middle" font-size="11" fill="var(--muted)">及格 750 ／ 滿分 900</text>
    </svg>`;
  }

  function reviewItem(q, ans, flagged, idx, open) {
    const ok = isCorrect(q, ans);
    const opts = q.o.map((t, i) => {
      const L = letters[i];
      let cls = 'opt locked' + (q.a.length > 1 ? ' multi' : '');
      if (q.a.includes(L)) cls += ' correct'; else if ((ans || '').includes(L)) cls += ' wrong';
      return `<div class="${cls}"><span class="letter">${L}</span><span class="otext">${rich(t)}</span></div>`;
    }).join('');
    return `<details class="card review-item" ${open ? 'open' : ''} data-ok="${ok ? 1 : 0}" data-flag="${flagged ? 1 : 0}" data-un="${ans ? 0 : 1}">
      <summary><span class="mark" style="color:${ok ? 'var(--ok)' : 'var(--bad)'}">${ok ? '✓' : '✗'}</span>
        <span class="preview">${idx != null ? `<b>${idx + 1}.</b> ` : ''}${esc(plain(q.q))}</span>
        <span class="tag ${ok ? 'green' : 'red'}">你的答案：${ans ? ans.split('').join('、') : '未作答'}</span></summary>
      <div style="margin-top:12px">
        <div class="qmeta"><span class="tag">題庫 #${q.n}</span>${domainTag(q.d)}${flagged ? '<span class="tag amber">⚑ 已標記</span>' : ''}</div>
        <div class="qtext">${rich(q.q)}</div>
        <div class="opts">${opts}</div>
        ${explHTML(q)}
      </div></details>`;
  }

  function viewResult(id) {
    const r = load(LS.history, []).find(h => String(h.id) === String(id));
    if (!r) { $app.innerHTML = '<div class="empty">找不到這筆紀錄。<br><a href="#/history">回到紀錄</a></div>'; return; }
    const pass = r.score >= EXAM.pass;
    const wrongCnt = r.ids.filter(n => byN.get(n) && !isCorrect(byN.get(n), r.answers[n])).length;
    const unCnt = r.ids.filter(n => !r.answers[n]).length;
    $app.innerHTML = `
      <div class="row"><h1 style="margin-right:auto">${esc(r.title)} 成績</h1><span class="muted small">${fmtDate(r.date)}</span></div>
      <div class="card score-hero" style="margin-top:10px">
        ${gauge(r.score)}
        <div>
          <div class="passfail ${pass ? 'pass' : 'fail'}">${pass ? '🎉 PASS 通過' : '未通過 FAIL'}</div>
          <div class="muted">${pass ? '恭喜！保持這個水準再多練幾回。' : `距離及格還差約 ${Math.max(0, Math.ceil((EXAM.pass - EXAM.min) / (EXAM.max - EXAM.min) * r.total) - r.correct)} 題，看完詳解後再挑戰一次！`}</div>
          <div class="stats">
            <div class="stat"><div class="n">${r.correct}/${r.total}</div><div class="l">答對題數</div></div>
            <div class="stat"><div class="n">${Math.round(r.correct / r.total * 100)}%</div><div class="l">答對率</div></div>
            <div class="stat"><div class="n">${fmtTime(r.used)}</div><div class="l">作答時間${r.limit ? '／' + fmtTime(r.limit) : ''}</div></div>
            <div class="stat"><div class="n">${unCnt}</div><div class="l">未作答</div></div>
          </div>
        </div>
      </div>
      <h2>各 Domain 表現</h2>
      <div class="card"><table class="domain-table">
        ${Object.entries(DOMAINS).map(([d, x]) => {
          const v = r.byDomain[d]; if (!v) return '';
          const p = Math.round(v.c / v.t * 100);
          return `<tr><td style="width:46%">${d}.0 ${esc(x.zh)}</td><td><div class="bar ${p >= 81 ? 'ok' : p < 60 ? 'bad' : ''}"><i style="width:${p}%"></i></div></td>
            <td class="num">${v.c}/${v.t}（${p}%）</td></tr>`;
        }).join('')}
      </table><p class="small muted" style="margin:8px 0 0">綠色 ≥ 81%（約及格水準），紅色 &lt; 60% 建議優先複習。</p></div>
      <h2>逐題詳解</h2>
      <div class="row" style="margin-bottom:6px">
        <div class="filters" id="filters">
          <button class="btn sm active" data-f="all">全部 ${r.total}</button>
          <button class="btn sm" data-f="wrong">答錯 ${wrongCnt}</button>
          <button class="btn sm" data-f="right">答對 ${r.total - wrongCnt}</button>
          <button class="btn sm" data-f="flag">標記 ${r.flags.length}</button>
          <button class="btn sm" data-f="un">未作答 ${unCnt}</button>
        </div><span class="spacer"></span>
        <button class="btn sm" id="expandAll">全部展開</button>
        ${wrongCnt ? '<button class="btn sm blue" id="retryWrong">重練本次錯題</button>' : ''}
      </div>
      <div id="reviewList">${r.ids.map((n, i) => byN.get(n) ? reviewItem(byN.get(n), r.answers[n], r.flags.includes(n), i, false) : '').join('')}</div>
      <div class="row" style="margin-top:24px"><a class="btn primary" href="#/">回首頁</a><a class="btn" href="#/history">所有紀錄</a></div>`;
    const list = document.getElementById('reviewList');
    document.querySelectorAll('#filters [data-f]').forEach(b => b.onclick = () => {
      document.querySelectorAll('#filters .btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
      const f = b.dataset.f;
      list.querySelectorAll('.review-item').forEach(el => {
        const show = f === 'all' || (f === 'wrong' && el.dataset.ok === '0') || (f === 'right' && el.dataset.ok === '1')
          || (f === 'flag' && el.dataset.flag === '1') || (f === 'un' && el.dataset.un === '1');
        el.style.display = show ? '' : 'none';
      });
    });
    document.getElementById('expandAll').onclick = e => {
      const open = e.target.textContent === '全部展開';
      list.querySelectorAll('details').forEach(d => { if (d.style.display !== 'none') d.open = open; });
      e.target.textContent = open ? '全部收合' : '全部展開';
    };
    const rw = document.getElementById('retryWrong');
    if (rw) rw.onclick = () => {
      const ids = r.ids.filter(n => byN.get(n) && !isCorrect(byN.get(n), r.answers[n]));
      const goRetry = () => startSession({ mode: 'practice', instant: true, ids: shuffle(ids), title: '重練錯題', fromWrong: true });
      if (session) confirmBox('放棄目前進度？', '你有一份進行中的測驗，開始重練會放棄它。', '開始', goRetry); else goRetry();
    };
  }

  function viewHistory() {
    const hist = load(LS.history, []);
    $app.innerHTML = `<div class="row"><h1 style="margin-right:auto">作答紀錄</h1>
      ${hist.length ? '<button class="btn sm" id="clear">清除所有紀錄</button>' : ''}</div>
      ${hist.length ? `<div class="card"><table class="domain-table">
        <tr><th>日期</th><th>類型</th><th class="num">答對</th><th class="num">分數</th><th class="num">用時</th></tr>
        ${hist.map(h => `<tr><td><a href="#/result/${h.id}">${fmtDate(h.date)}</a></td><td>${esc(h.title)}</td>
          <td class="num">${h.correct}/${h.total}</td>
          <td class="num"><b style="color:${h.score >= EXAM.pass ? 'var(--ok)' : 'var(--bad)'}">${h.score}</b></td>
          <td class="num">${fmtTime(h.used)}</td></tr>`).join('')}
      </table></div>` : '<div class="empty">還沒有紀錄。<br><a href="#/">去考一次吧！</a></div>'}`;
    const c = document.getElementById('clear');
    if (c) c.onclick = () => confirmBox('清除所有紀錄？', '這會刪除所有成績、作答統計與錯題本，無法復原。', '全部清除', () => {
      drop(LS.history); drop(LS.seen); drop(LS.wrong); viewHistory();
    });
  }

  function viewWrong() {
    const w = load(LS.wrong, {});
    const list = Object.keys(w).map(Number).filter(n => byN.has(n)).sort((a, b) => w[b].w - w[a].w || a - b);
    $app.innerHTML = `<div class="row"><h1 style="margin-right:auto">錯題本（${list.length} 題）</h1>
        ${list.length ? '<button class="btn primary" id="practiceWrong">練習錯題</button>' : ''}</div>
      <p class="muted small">模擬考或練習中答錯的題目會自動加入；在「錯題本練習」中答對即自動移出。依答錯次數排序。</p>
      ${list.length ? list.map(n => {
        const q = byN.get(n);
        return `<details class="card review-item"><summary><span class="mark" style="color:var(--bad)">${w[n].w}×</span>
          <span class="preview"><b>#${n}</b> ${esc(plain(q.q))}</span></summary>
          <div style="margin-top:12px"><div class="qmeta">${domainTag(q.d)}</div><div class="qtext">${rich(q.q)}</div>
          <div class="opts">${q.o.map((t, i) => `<div class="opt locked ${q.a.includes(letters[i]) ? 'correct' : ''}"><span class="letter">${letters[i]}</span><span class="otext">${rich(t)}</span></div>`).join('')}</div>
          ${explHTML(q)}
          <div class="row" style="margin-top:10px"><button class="btn sm" data-rm="${n}">從錯題本移除</button></div></div></details>`;
      }).join('') : '<div class="empty">目前沒有錯題 👍</div>'}`;
    $app.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const x = load(LS.wrong, {}); delete x[b.dataset.rm]; save(LS.wrong, x); viewWrong(); });
    const p = document.getElementById('practiceWrong');
    if (p) p.onclick = () => {
      const goW = () => startSession({ mode: 'practice', instant: true, ids: shuffle(list), title: '錯題本練習', fromWrong: true });
      if (session) confirmBox('放棄目前進度？', '你有一份進行中的測驗，開始練習會放棄它。', '開始', goW); else goW();
    };
  }

  function viewBank() {
    $app.innerHTML = `<h1>題庫瀏覽</h1>
      <div class="card"><div class="row">
        <input type="search" id="kw" placeholder="搜尋英文題目、選項或中文詳解…" style="flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--panel)">
        <select id="dom" style="padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--panel)"><option value="">所有 Domain</option>
          ${Object.entries(DOMAINS).map(([d, x]) => `<option value="${d}">${d}.0 ${esc(x.zh)}</option>`).join('')}</select>
      </div><div class="small muted" id="cnt" style="margin-top:8px"></div></div>
      <div id="bank"></div><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="more">顯示更多</button></div>`;
    let shown = 30;
    const draw = () => {
      const kw = document.getElementById('kw').value.trim().toLowerCase();
      const d = document.getElementById('dom').value;
      const num = /^#?\d+$/.test(kw) ? +kw.replace('#', '') : null;
      const list = Q.filter(q => (!d || String(q.d) === d) && (!kw || (num ? q.n === num : (q.q + ' ' + q.o.join(' ') + ' ' + q.e).toLowerCase().includes(kw))));
      document.getElementById('cnt').textContent = `共 ${list.length} 題（可輸入題號，如 #120）`;
      document.getElementById('bank').innerHTML = list.slice(0, shown).map(q => `
        <details class="card review-item"><summary><span class="mark muted">#${q.n}</span><span class="preview">${esc(plain(q.q))}</span></summary>
        <div style="margin-top:12px"><div class="qmeta">${domainTag(q.d)}${q.a.length > 1 ? `<span class="tag amber">複選 ${q.a.length} 項</span>` : ''}</div>
        <div class="qtext">${rich(q.q)}</div>
        <div class="opts">${q.o.map((t, i) => `<div class="opt locked ${q.a.includes(letters[i]) ? 'correct' : ''}"><span class="letter">${letters[i]}</span><span class="otext">${rich(t)}</span></div>`).join('')}</div>
        ${explHTML(q)}</div></details>`).join('');
      document.getElementById('more').style.display = list.length > shown ? '' : 'none';
    };
    let t;
    document.getElementById('kw').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { shown = 30; draw(); }, 200); });
    document.getElementById('dom').addEventListener('change', () => { shown = 30; draw(); });
    document.getElementById('more').onclick = () => { shown += 30; draw(); };
    draw();
  }

  function viewPBQ(n) {
    if (n) {
      const p = PBQS.find(x => String(x.n) === String(n));
      if (!p) { location.hash = '#/pbq'; return; }
      $app.innerHTML = `<a href="#/pbq">← 所有 PBQ</a>
        <h1>PBQ 情境題 #${p.n}</h1>
        <div class="card"><div class="qmeta">${domainTag(p.d)}<span class="tag amber">Performance-Based Question</span></div>
          <div class="qtext">${esc(p.text)}</div>
          ${p.img.map(f => `<div class="pbq-img"><img src="${imgSrc(f)}" alt="情境題畫面" loading="lazy"></div>`).join('')}
          <p class="muted small">真實考試中 PBQ 為互動操作（拖放、下拉選單、設定畫面）。請先自行思考每個欄位的答案，再展開參考解答。</p>
          <details class="card" style="margin-top:12px"><summary><b>👀 顯示參考解答與繁中詳解</b></summary>
            ${p.ans.map(f => `<div class="pbq-img"><img src="${imgSrc(f)}" alt="參考解答" loading="lazy"></div>`).join('')}
            ${explHTML({ a: '', e: p.e, l: p.l, v: [] }, '參考解答說明')}
          </details></div>`;
      return;
    }
    $app.innerHTML = `<h1>PBQ 情境題（Performance-Based Questions）</h1>
      <p class="muted">正式考試通常會在開頭出現數題 PBQ（模擬操作題），建議先標記、跳過，最後再回來作答，以免耗費太多時間。</p>
      <div class="grid grid-2">${PBQS.map(p => `<a class="card" style="text-decoration:none;color:inherit" href="#/pbq/${p.n}">
        <div class="qmeta"><span class="tag">#${p.n}</span>${domainTag(p.d)}</div>
        <div class="small">${esc(p.text.split('\n').filter(l => !/^(HOTSPOT|SIMULATION|INSTRUCTIONS)/.test(l)).slice(0, 2).join(' '))}</div></a>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- router
  function route() {
    closeModal();
    const h = location.hash || '#/';
    const [, page, arg] = h.split('/');
    if (page !== 'exam') { document.body.classList.remove('in-exam'); clearInterval(timerId); }
    document.querySelectorAll('#topnav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + (page || '')));
    switch (page) {
      case 'exam': return viewExam();
      case 'practice': return viewPractice();
      case 'result': return viewResult(arg);
      case 'history': return viewHistory();
      case 'wrong': return viewWrong();
      case 'bank': return viewBank();
      case 'pbq': return viewPBQ(arg);
      default: return viewHome();
    }
  }
  window.addEventListener('hashchange', route);

  // theme
  const themeBtn = document.getElementById('themeBtn');
  const applyTheme = t => { if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); };
  applyTheme(load(LS.theme, null));
  themeBtn.onclick = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    const t = dark ? 'light' : 'dark'; applyTheme(t); save(LS.theme, t);
  };

  route();
})();
