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

  /* Download de arquivo (PDF da Glicemia) direto pelo navegador */
  const downloads = { save: async ({ filename, data }) => { const u = URL.createObjectURL(data), a = document.createElement("a"); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } };

  /* ---------- Acessos da Glicemia ---------- */
  const css = document.createElement("style");
  css.textContent = `.glpode{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}.glpode li{padding-left:24px;position:relative}.glpode li:before{position:absolute;left:0;font-weight:700}.glpode .ok:before{content:"✓";color:var(--ok,#3fb950)}.glpode .no{opacity:.75}.glpode .no:before{content:"✕";color:var(--bad,#f85149)}
#glPedidos{position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:60;display:grid;gap:8px;width:min(480px,calc(100% - 24px))}.glped{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--accent);border-radius:var(--r);padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.45)}.glped>div{flex:1;min-width:0}
.glespera{width:28px;height:28px;margin:6px auto 14px;border:3px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:glgira 1s linear infinite}@keyframes glgira{to{transform:rotate(360deg)}}
.galog{display:grid;gap:4px;font-size:13px;max-height:260px;overflow:auto}#gaTbl td{vertical-align:middle}#gaTbl select{min-width:120px}
@media (max-width:720px){#gaTbl thead{display:none}#gaTbl tr{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 0;border-bottom:1px solid var(--line)}#gaTbl td{border:0;padding:0;text-align:left;justify-content:flex-start}#gaTbl td:first-child{grid-column:1/-1}#gaForm>.btn{width:100%}}`;
  document.head.appendChild(css);
  const glPainel = () => document.querySelector('[data-panel="glicemia"]');
  const quando = t => t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca";
  const dataBr = id => /^\d{4}-\d{2}-\d{2}$/.test(id || "") ? id.split("-").reverse().join("/") : (id || "");
  // O convidado vê o que pode fazer na Glicemia.
  function avisoConvidado(c, nivel, email) {
    const p = glPainel(); if (!p) return;
    const nome = (c && c.nome) || email, pode = nivel >= 2;
    const d = document.createElement("div"); d.className = "card"; d.id = "glVoce";
    d.innerHTML = `<h2>Olá, ${esc(nome)}</h2><p class="sub">Este acesso é só para a parte da Glicemia. O que você pode fazer:</p>
      <ul class="glpode"><li class="ok">Ver todas as medições, a média e o gráfico</li><li class="ok">Gerar o PDF das medições</li>
      <li class="${pode ? "ok" : "no"}">${pode ? "Lançar novas medições e corrigir as que já existem (botão “+ Nova medida” ou toque na medida)" : "Lançar ou corrigir medições: não liberado para você"}</li></ul>
      <p class="sub" style="margin-top:6px">${pode ? "Tudo o que você lança fica registrado com o seu nome para o dono do site." : "Se precisar lançar medições, peça ao dono do site."}</p>
      <button class="btn ghost small" type="button" id="glTrocaSenha" style="margin-top:8px">Trocar minha senha</button>`;
    p.prepend(d);
    $("#glTrocaSenha").onclick = () => formSenha(() => abrirApp(null), () => abrirApp(null));
  }
  // O dono vê os pedidos de entrada em qualquer aba e aprova um por um.
  function vigiarPedidos() {
    const t = document.createElement("div"); t.id = "glPedidos"; t.setAttribute("role", "status"); t.hidden = true; document.body.appendChild(t);
    const tituloBase = document.title; let ultimo = "";
    async function ver() {
      const r = await sb.rpc("cf_glic_pedidos");
      const L = r.error ? [] : r.data || [], chave = L.map(x => x.id).join(",");
      if (chave !== ultimo) {
        ultimo = chave;
        t.hidden = !L.length;
        t.innerHTML = L.map(x => `<div class="glped" data-ped="${esc(x.id)}"><div><b>${esc(x.quem)}</b> quer entrar na Glicemia<div class="sub">pedido às ${esc(new Date(x.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}</div></div><button class="btn small" type="button" data-pedok>Aprovar</button><button class="btn ghost small" type="button" data-pedno>Recusar</button></div>`).join("");
        document.title = (L.length ? `(${L.length}) ` : "") + tituloBase;
      }
      setTimeout(ver, document.hidden ? 20000 : 6000);
    }
    t.addEventListener("click", async ev => {
      const el = ev.target.closest("[data-ped]"); if (!el || !ev.target.matches("button")) return;
      el.querySelectorAll("button").forEach(b => b.disabled = true);
      await sb.rpc("cf_glic_decidir", { pid: +el.dataset.ped, aprovar: ev.target.matches("[data-pedok]") });
      ultimo = "?"; el.remove(); if (!t.children.length) t.hidden = true;
      if (window.__glRecarregar) window.__glRecarregar();
    });
    ver();
  }
  // O dono cria e controla os acessos.
  function painelAcessos() {
    const p = glPainel(); if (!p) return;
    const d = document.createElement("div"); d.className = "card"; d.id = "glAcessos";
    d.innerHTML = `<div class="headrow"><div><h2>Acessos da Glicemia</h2><p class="sub">Pessoas que entram no site e veem só esta aba</p></div><button class="btn ghost small" type="button" id="gaAtualizar">Atualizar</button></div>
      <div class="tbl" style="margin-top:10px"><table id="gaTbl"></table></div>
      <form class="f" id="gaForm" style="margin-top:14px">
        <label class="fld">Nome<input id="gaNome" maxlength="60" autocomplete="off" placeholder="Maria"></label>
        <label class="fld">E-mail<input id="gaEmail" type="email" required maxlength="254" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="maria@email.com"></label>
        <label class="fld">Senha<input id="gaSenha" type="text" minlength="6" maxlength="72" autocomplete="new-password" placeholder="mínimo 6"></label>
        <label class="fld">Pode<select id="gaPode"><option value="0">Só ver</option><option value="1">Ver e lançar</option></select></label>
        <button class="btn" type="submit">Criar acesso</button>
      </form>
      <div class="msg" id="gaMsg"></div>
      <h3 style="margin:16px 0 6px;font-size:14px">Atividade recente</h3><div id="gaLog" class="galog"></div>`;
    p.prepend(d);
    const msg = (t, ok) => { const m = $("#gaMsg"); m.textContent = t; m.className = "msg " + (ok ? "ok" : "err"); };
    async function carregarLista() {
      const [l, a] = await Promise.all([sb.rpc("cf_glic_lista"), sb.rpc("cf_glic_atividade", { lim: 30 })]);
      if (l.error) { d.hidden = true; return; }
      d.hidden = false;
      const t = $("#gaTbl");
      t.innerHTML = !l.data.length ? `<tr><td class="sub">Nenhum acesso criado ainda. Preencha abaixo para criar.</td></tr>` :
        `<thead><tr><th>Pessoa</th><th>Pode</th><th>Situação</th><th class="r">Acessos</th><th>Último acesso</th><th></th></tr></thead><tbody>` +
        l.data.map(u => `<tr data-ga="${esc(u.user_id)}"><td><b>${esc(u.nome || u.email)}</b>${u.nome ? `<div class="sub">${esc(u.email)}</div>` : ""}</td>
          <td><select data-gapode aria-label="O que pode"><option value="0"${u.pode_lancar ? "" : " selected"}>Só ver</option><option value="1"${u.pode_lancar ? " selected" : ""}>Ver e lançar</option></select></td>
          <td><button class="btn small ${u.aprovado ? "ghost" : ""}" type="button" data-gaaprov="${u.aprovado ? 1 : 0}">${u.aprovado ? "Liberado · bloquear" : "Bloqueado · liberar"}</button></td>
          <td class="r" style="font-family:var(--f-mono)">${+u.acessos || 0}</td><td>${esc(quando(u.ultimo))}</td>
          <td><button class="btn ghost small" type="button" data-gadel>Remover</button></td></tr>`).join("") + `</tbody>`;
      $("#gaLog").innerHTML = a.error || !a.data.length ? `<p class="sub">Nenhuma atividade ainda.</p>` :
        a.data.map(x => `<div><span class="sub">${esc(quando(x.em))}</span> <b>${esc(x.quem || "?")}</b> ${esc(x.acao)}${x.detalhe ? ` a medida do dia ${esc(dataBr(x.detalhe))}` : ""}</div>`).join("");
    }
    d.addEventListener("click", async ev => {
      const tr = ev.target.closest("[data-ga]"), uid = tr && tr.dataset.ga;
      if (ev.target.id === "gaAtualizar") return carregarLista();
      if (!uid) return;
      if (ev.target.matches("[data-gaaprov]")) {
        const r = await sb.rpc("cf_glic_salvar", { uid, p_aprovado: ev.target.dataset.gaaprov !== "1", p_pode_lancar: tr.querySelector("[data-gapode]").value === "1" });
        if (r.error) msg("Não foi possível mudar. Tente de novo."); else carregarLista();
      } else if (ev.target.matches("[data-gadel]")) {
        if (!confirm("Tirar o acesso desta pessoa? As medições não são apagadas.")) return;
        const r = await sb.rpc("cf_glic_remover", { uid });
        if (r.error) msg("Não foi possível remover. Tente de novo."); else { msg("Acesso removido.", true); carregarLista(); }
      }
    });
    d.addEventListener("change", async ev => {
      if (!ev.target.matches("[data-gapode]")) return;
      const tr = ev.target.closest("[data-ga]");
      const r = await sb.rpc("cf_glic_salvar", { uid: tr.dataset.ga, p_aprovado: tr.querySelector("[data-gaaprov]").dataset.gaaprov === "1", p_pode_lancar: ev.target.value === "1" });
      if (r.error) msg("Não foi possível mudar. Tente de novo."); else { msg("Alterado.", true); carregarLista(); }
    });
    $("#gaForm").onsubmit = async ev => {
      ev.preventDefault();
      const email = $("#gaEmail").value.trim(), senha = $("#gaSenha").value;
      if (senha && senha.length < 6) return msg("A senha precisa ter pelo menos 6 caracteres.");
      const r = await sb.rpc("cf_glic_criar", { p_email: email, p_senha: senha, p_nome: $("#gaNome").value, p_pode_lancar: $("#gaPode").value === "1" });
      if (r.error) return msg(/inválido|já é o seu|senha/i.test(r.error.message || "") ? r.error.message : "Não foi possível criar o acesso. Tente de novo.");
      msg(`Acesso criado. A pessoa entra neste site com ${email}${senha ? " e a senha que você digitou" : ""}.`, true);
      $("#gaForm").reset(); carregarLista();
    };
    window.__glRecarregar = carregarLista;
    carregarLista();
  }

  /* ---------- Início: o dono (cf_dono) vê tudo; convidado (cf_glic_acesso) só a Glicemia ---------- */
  let iniciado = false;
  async function sairConvidado() { try { await sb.rpc("cf_glic_sair"); } catch (e) {} sair(); }
  const botaoSair = (id = "lgSair") => `<button class="btn ghost" type="button" id="${id}">Sair</button>`;
  async function iniciar(session) {
    if (iniciado) return; iniciado = true;
    const { data: dono, error } = await sb.rpc("cf_e_dono");
    if (error) { iniciado = false; return mostrar(titulo + `<p class="sub">Não foi possível conferir o seu acesso. Recarregue a página.</p>`); }
    if (dono) return abrirApp(session, true, 2, null);
    // Convidado: cada entrada vira um pedido que o dono aprova.
    const r = await sb.rpc("cf_glic_entrar");
    if (r.error || !r.data) { const n = await sb.rpc("cf_glic_nivel"); const nv = n.error ? 0 : +n.data || 0; return nv ? abrirApp(session, false, nv, null) : semAcesso(session); }
    tratarPedido(session, r.data);
  }
  function semAcesso(session) { mostrar(titulo + `<p class="sub">O usuário ${esc(session.user.email)} não tem acesso a este site.</p>${botaoSair()}`); $("#lgSair").onclick = sair; }
  function tratarPedido(session, c) {
    if (c.status === "sem") return semAcesso(session);
    if (c.status === "bloqueado") { mostrar(titulo + `<p class="sub">O seu acesso à Glicemia está bloqueado no momento. Fale com o dono do site para liberar.</p>${botaoSair()}`); $("#lgSair").onclick = sair; return; }
    mostrar(titulo + `<p class="sub"><b>Pedido de entrada enviado.</b><br>Aguarde o dono do site aprovar a sua entrada. Esta tela abre sozinha quando ele aprovar.</p><div class="glespera" aria-hidden="true"></div>${botaoSair()}`);
    $("#lgSair").onclick = sairConvidado;
    let parado = false;
    const conferir = async () => {
      if (parado) return;
      const s = await sb.rpc("cf_glic_situacao", { pid: c.pedido });
      const st = s.data && s.data.status;
      if (st === "aprovado") { parado = true; return perguntarSenha(session, { ...c, ...s.data }); }
      if (st === "recusado" || st === "encerrado") {
        parado = true;
        mostrar(titulo + `<p class="sub">${st === "recusado" ? "A sua entrada foi recusada pelo dono do site." : "Esta entrada foi encerrada (o site foi aberto em outro lugar ou o acesso mudou)."}</p><button class="btn" type="button" id="lgDeNovo">Pedir para entrar de novo</button>${botaoSair()}`);
        $("#lgSair").onclick = sairConvidado;
        $("#lgDeNovo").onclick = async () => { const n = await sb.rpc("cf_glic_entrar"); if (!n.error && n.data) tratarPedido(session, n.data); };
        return;
      }
      setTimeout(conferir, 4000);
    };
    setTimeout(conferir, 3000);
  }
  // No primeiro acesso a pessoa escolhe: troca a senha que recebeu ou continua com ela.
  function perguntarSenha(session, c) {
    const nivel = c.pode_lancar ? 2 : 1, meta = session.user.user_metadata || {};
    if (meta.senha_ok) return abrirApp(session, false, nivel, c);
    mostrar(titulo + `<p class="sub"><b>Entrada aprovada.</b><br>Você está usando a senha que recebeu. Quer criar uma senha só sua?</p>
      <button class="btn" type="button" id="psTrocar">Trocar a senha</button><button class="btn ghost" type="button" id="psManter">Continuar com a mesma senha</button><p class="msg err" role="alert"></p>`);
    $("#psManter").onclick = async () => { await sb.auth.updateUser({ data: { senha_ok: true } }); abrirApp(session, false, nivel, c); };
    $("#psTrocar").onclick = () => formSenha(() => abrirApp(session, false, nivel, c), () => perguntarSenha(session, c));
  }
  function formSenha(depois, voltar, msg = "") {
    mostrar(titulo + `<p class="sub">Crie a sua nova senha (pelo menos 6 caracteres)</p>
      <input id="nsA" type="password" autocomplete="new-password" maxlength="72" placeholder="Nova senha" aria-label="Nova senha">
      <input id="nsB" type="password" autocomplete="new-password" maxlength="72" placeholder="Repita a nova senha" aria-label="Repita a nova senha">
      <button class="btn" type="submit">Salvar senha</button><button class="btn ghost" type="button" id="nsVoltar">Voltar</button><p class="msg err" role="alert">${esc(msg)}</p>`);
    $("#nsA").focus(); $("#nsVoltar").onclick = voltar;
    box.onsubmit = async ev => {
      ev.preventDefault(); const a = $("#nsA").value, b = $("#nsB").value;
      if (a.length < 6) return formSenha(depois, voltar, "A senha precisa ter pelo menos 6 caracteres.");
      if (a !== b) return formSenha(depois, voltar, "As duas senhas não são iguais.");
      const { error } = await sb.auth.updateUser({ password: a, data: { senha_ok: true } });
      if (error) return formSenha(depois, voltar, /same|different/i.test(error.message || "") ? "A nova senha precisa ser diferente da atual." : "Não foi possível salvar a senha. Tente de novo.");
      box.onsubmit = null; depois(true);
    };
  }
  let appAberto = false;
  function abrirApp(session, dono, nivelGlic, convidado) {
    if (appAberto) { scr.hidden = true; document.body.classList.remove("locked"); return; }
    appAberto = true;
    // Convidado só de leitura: a recusa da base vira "invalid_argument", que a tela da Glicemia entende como "só ver".
    const dbUso = dono || nivelGlic >= 2 ? db : { ...db, doc: p => { const d = db.doc(p), trava = f => async (...a) => { try { return await f(...a); } catch (e) { if (e && e.code === "permission_denied") e.code = "invalid_argument"; throw e; } }; return { ...d, set: trava(d.set), delete: trava(d.delete) }; } };
    const user = { canEdit: async () => !!dono, isOwner: () => !!dono };
    window.claude = { use: async nome => nome === "db" ? dbUso : nome === "user" ? user : nome === "downloads" ? downloads : null };
    scr.hidden = true; document.body.classList.remove("locked");
    tempoReal();
    const s = document.createElement("script"); s.src = "app.js?v=" + (cfg.versao || "1"); document.body.appendChild(s);
    if (dono) { painelAcessos(); vigiarPedidos(); } else avisoConvidado(convidado, nivelGlic, session.user.email);
    const hdr = $(".hdr-r");
    if (hdr) { const b = document.createElement("button"); b.className = "btn ghost small"; b.type = "button"; b.textContent = "Sair"; b.title = "Sair da conta " + session.user.email; b.onclick = dono ? sair : sairConvidado; hdr.insertBefore(b, hdr.querySelector(".sync")); }
  }
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "PASSWORD_RECOVERY") return telaNovaSenha();
    if (ev === "SIGNED_OUT" && iniciado) return location.reload();
    if (session && !recuperando) iniciar(session);
  });
  sb.auth.getSession().then(({ data }) => { if (recuperando) return; if (data.session) iniciar(data.session); else telaLogin(); });
})();
