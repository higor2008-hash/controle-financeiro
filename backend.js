/* Ligação do Controle Financeiro com o Supabase: login e banco de dados.
   Oferece a mesma interface que o app.js usa (window.claude.use("db")), então as telas não mudam. */
(function () {
  // Não deixa o site ser aberto dentro de outra página (proteção contra clique disfarçado).
  if (window.top !== window.self) { document.documentElement.innerHTML = ""; try { window.top.location = window.self.location.href; } catch (e) {} return; }
  const cfg = window.CF_CONFIG || {};
  const $ = s => document.querySelector(s);
  const scr = $("#loginScr"), box = $("#loginBox");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mostrar = html => { box.innerHTML = html; scr.hidden = false; document.body.classList.add("locked"); };
  const titulo = `<div class="lockico" aria-hidden="true"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div><h2>Controle Financeiro</h2>`;
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) { mostrar(titulo + `<p class="sub">O site ainda não foi ligado ao banco de dados (config.js).</p>`); return; }
  const recuperando = /type=recovery/.test(location.hash);
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const T = "cf_docs";

  /* ---------- Banco: tabela cf_docs (col, id, data jsonb) ---------- */
  const cache = {};               // col -> Map(id -> data)
  const subsCol = {};             // col -> Set({next, error})
  const subsDoc = {};             // "col/id" -> Set({next, error})
  const carregando = {};
  const meta = { fromCache: false, hasPendingWrites: false };
  const erro = e => ({ code: e && (e.code === "42501" || e.code === "PGRST301") ? "permission_denied" : e && /JWT|auth/i.test(e.message || "") ? "unauthenticated" : "unavailable", message: (e && e.message) || String(e) });
  const docSnap = (col, id) => { const d = cache[col] && cache[col].get(id); return { id, exists: d !== undefined, data: () => d, metadata: meta }; };
  function emitir(col, id) {
    const m = cache[col] || new Map();
    const docs = [...m.entries()].map(([i, d]) => ({ id: i, exists: true, data: () => d, metadata: meta }));
    const snap = { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
    (subsCol[col] || []).forEach(s => s.next(snap));
    const alvo = id ? [col + "/" + id] : Object.keys(subsDoc).filter(k => k.startsWith(col + "/"));
    alvo.forEach(k => (subsDoc[k] || []).forEach(s => s.next(docSnap(col, k.slice(col.length + 1)))));
  }
  async function carregar(col) {
    if (carregando[col]) return carregando[col];
    carregando[col] = (async () => {
      const m = new Map(); let de = 0;
      for (;;) {
        const { data, error } = await sb.from(T).select("id,data").eq("col", col).order("id").range(de, de + 999);
        if (error) throw error;
        data.forEach(r => m.set(r.id, r.data));
        if (data.length < 1000) break; de += 1000;
      }
      cache[col] = m;
    })();
    try { await carregando[col]; } finally { carregando[col] = null; }
  }
  function ouvir(col, alvo, id) {
    const s = { next: alvo.next, error: alvo.error || (() => {}) };
    const lista = id ? (subsDoc[col + "/" + id] = subsDoc[col + "/" + id] || new Set()) : (subsCol[col] = subsCol[col] || new Set());
    lista.add(s);
    (cache[col] ? Promise.resolve() : carregar(col)).then(() => id ? s.next(docSnap(col, id)) : emitir(col)).catch(e => s.error(erro(e)));
    return () => lista.delete(s);
  }
  const aceitaAlvo = (a, b) => typeof a === "function" ? { next: a, error: b } : a;
  const partes = p => { const i = p.indexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; };
  async function gravar(col, id, data) {
    const { error } = await sb.from(T).upsert({ col, id, data, atualizado_em: new Date().toISOString() });
    if (error) throw erro(error);
    (cache[col] = cache[col] || new Map()).set(id, data); emitir(col, id);
  }
  async function apagar(col, id) {
    const { error } = await sb.from(T).delete().eq("col", col).eq("id", id);
    if (error) throw erro(error);
    if (cache[col]) cache[col].delete(id); emitir(col, id);
  }
  const novoId = () => { const a = new Uint8Array(15); crypto.getRandomValues(a); return [...a].map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("").slice(0, 20); };
  const db = {
    collection: col => ({
      onSnapshot: (a, b) => ouvir(col, aceitaAlvo(a, b)),
      add: async data => { const id = novoId(); await gravar(col, id, data); return { id }; },
      doc: id => db.doc(col + "/" + id)
    }),
    doc: path => {
      const [col, id] = partes(path);
      return {
        id, path,
        get: async () => { if (!cache[col]) await carregar(col); return docSnap(col, id); },
        set: data => gravar(col, id, data),
        update: async patch => { if (!cache[col]) await carregar(col); await gravar(col, id, { ...(cache[col].get(id) || {}), ...patch }); },
        delete: () => apagar(col, id),
        onSnapshot: (a, b) => ouvir(col, aceitaAlvo(a, b), id)
      };
    }
  };
  // Mudanças feitas em outro aparelho chegam em tempo real.
  function tempoReal() {
    sb.channel("cf-mudancas").on("postgres_changes", { event: "*", schema: "public", table: T }, p => {
      const r = p.new && p.new.col ? p.new : p.old; if (!r || !r.col || !cache[r.col]) return;
      if (p.eventType === "DELETE") { if (r.id) cache[r.col].delete(r.id); else return carregar(r.col).then(() => emitir(r.col)); }
      else cache[r.col].set(r.id, r.data);
      emitir(r.col, r.id);
    }).subscribe();
  }

  /* ---------- Login ---------- */
  const lerTrava = () => { try { return JSON.parse(localStorage.getItem("cf-login-trava")) || { n: 0, ate: 0 }; } catch (e) { return { n: 0, ate: 0 }; } };
  const gravarTrava = t => { try { localStorage.setItem("cf-login-trava", JSON.stringify(t)); } catch (e) {} };
  let emailDigitado = "";
  function telaLogin(msg = "", tipo = "err") {
    let ultimo = emailDigitado; try { ultimo = ultimo || localStorage.getItem("cf-ultimo-email") || ""; } catch (e) {}
    mostrar(titulo + `<p class="sub">Entre com seu e-mail e senha</p>
      <input id="lgEmail" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="254" placeholder="E-mail" aria-label="E-mail" value="${esc(ultimo)}">
      <input id="lgSenha" type="password" autocomplete="current-password" maxlength="72" placeholder="Senha" aria-label="Senha">
      <button class="btn" id="lgEntrar" type="submit">Entrar</button>
      <button class="btn ghost small" id="lgEsqueci" type="button">Esqueci a senha</button>
      <p class="msg ${tipo === "ok" ? "ok" : "err"}" role="alert">${esc(msg)}</p>`);
    const em = $("#lgEmail"), se = $("#lgSenha"); (em.value ? se : em).focus();
    em.oninput = () => { emailDigitado = em.value.trim(); };
    box.onsubmit = async ev => {
      ev.preventDefault();
      const t = lerTrava(), falta = Math.ceil((t.ate - Date.now()) / 1000);
      if (falta > 0) return telaLogin(`Muitas tentativas erradas. Espere ${falta} segundos.`);
      if (!em.value.trim() || !se.value) return telaLogin("Preencha o e-mail e a senha.");
      const b = $("#lgEntrar"); b.disabled = true; b.textContent = "Entrando…";
      const { error } = await sb.auth.signInWithPassword({ email: em.value.trim(), password: se.value });
      if (!error) { gravarTrava({ n: 0, ate: 0 }); try { localStorage.setItem("cf-ultimo-email", em.value.trim()); } catch (e) {} return; }
      if (error.status === 429) return telaLogin("Muitas tentativas. Espere alguns minutos e tente de novo.");
      const n = t.n + 1, espera = n >= 5 ? Math.min(60 * 2 ** (n - 5), 1800) : 0;
      gravarTrava({ n, ate: espera ? Date.now() + espera * 1000 : 0 });
      telaLogin(espera ? `E-mail ou senha incorretos. Espere ${espera} segundos antes de tentar de novo.` : "E-mail ou senha incorretos.");
    };
    $("#lgEsqueci").onclick = async () => {
      const e = em.value.trim(); if (!e) return telaLogin("Digite seu e-mail e toque de novo em Esqueci a senha.");
      await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname });
      telaLogin("Se o e-mail estiver cadastrado, chegará um link para criar uma nova senha.", "ok");
    };
  }
  function telaNovaSenha(msg = "") {
    mostrar(titulo + `<p class="sub">Crie uma nova senha (pelo menos 8 caracteres)</p>
      <input id="nsA" type="password" autocomplete="new-password" maxlength="72" placeholder="Nova senha" aria-label="Nova senha">
      <input id="nsB" type="password" autocomplete="new-password" maxlength="72" placeholder="Repita a nova senha" aria-label="Repita a nova senha">
      <button class="btn" type="submit">Salvar senha</button><p class="msg err" role="alert">${esc(msg)}</p>`);
    box.onsubmit = async ev => {
      ev.preventDefault(); const a = $("#nsA").value, b = $("#nsB").value;
      if (a.length < 8) return telaNovaSenha("A senha precisa ter pelo menos 8 caracteres.");
      if (a !== b) return telaNovaSenha("As duas senhas não são iguais.");
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) return telaNovaSenha("Não foi possível salvar a senha. Tente de novo.");
      history.replaceState(null, "", location.pathname); location.reload();
    };
  }
  async function sair() { await sb.auth.signOut(); location.reload(); }

  /* ---------- Início: só o dono cadastrado em cf_dono entra ---------- */
  let iniciado = false;
  async function iniciar(session) {
    if (iniciado) return; iniciado = true;
    const { data: dono, error } = await sb.rpc("cf_e_dono");
    if (error) { iniciado = false; return mostrar(titulo + `<p class="sub">Não foi possível conferir o seu acesso. Recarregue a página.</p>`); }
    if (!dono) { mostrar(titulo + `<p class="sub">O usuário ${esc(session.user.email)} não tem acesso a este site.</p><button class="btn" type="button" id="lgSair">Sair</button>`); $("#lgSair").onclick = sair; return; }
    window.claude = { use: async nome => nome === "db" ? db : null };
    scr.hidden = true; document.body.classList.remove("locked");
    tempoReal();
    const s = document.createElement("script"); s.src = "app.js?v=" + (cfg.versao || "1"); document.body.appendChild(s);
    const hdr = $(".hdr-r");
    if (hdr) { const b = document.createElement("button"); b.className = "btn ghost small"; b.type = "button"; b.textContent = "Sair"; b.title = "Sair da conta " + session.user.email; b.onclick = sair; hdr.insertBefore(b, hdr.querySelector(".sync")); }
  }
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "PASSWORD_RECOVERY") return telaNovaSenha();
    if (ev === "SIGNED_OUT" && iniciado) return location.reload();
    if (session && !recuperando) iniciar(session);
  });
  sb.auth.getSession().then(({ data }) => { if (recuperando) return; if (data.session) iniciar(data.session); else telaLogin(); });
})();
