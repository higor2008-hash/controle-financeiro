/* Modelo de PDF dos relatórios (marca HR: azul-noite + dourado + creme).
   Uso: const r = RelPDF.novo({ titulo, sub, periodo }); r.kpis([...]); r.secao("..."); r.tabela(cols, linhas); r.salvar()/r.doc */
(function (root) {
  const AZUL = [22, 35, 59], AZUL2 = [34, 52, 84], OURO = [201, 162, 74], OURO_CLARO = [231, 211, 160], CREME = [244, 236, 216], CREME2 = [250, 246, 236],
    TINTA = [20, 35, 44], CINZA = [91, 109, 120], LINHA = [216, 225, 231], VERDE = [29, 122, 70], VERMELHO = [176, 46, 38];
  const W = 210, H = 297, M = 16, TOPO = 52, BASE = H - 20;
  const dois = n => String(n).padStart(2, "0");
  const hojeLbl = () => { const t = new Date(); return dois(t.getDate()) + "/" + dois(t.getMonth() + 1) + "/" + t.getFullYear(); };

  function novo(o) {
    const jsPDF = (root.jspdf && root.jspdf.jsPDF) || o.jsPDF;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: o.paisagem ? "landscape" : "portrait" });
    const W = o.paisagem ? 297 : 210, H = o.paisagem ? 210 : 297, BASE = H - 20;
    const r = { doc, y: 0, W, M, H, cores: { AZUL, OURO, CREME, TINTA, CINZA, LINHA, VERDE, VERMELHO }, o };

    function selo(x, y, t) {
      doc.setFillColor(...AZUL2); doc.roundedRect(x, y, t, t, 1.8, 1.8, "F");
      doc.setDrawColor(...OURO); doc.setLineWidth(0.8); doc.roundedRect(x, y, t, t, 1.8, 1.8, "S");
      doc.setLineWidth(0.25); doc.roundedRect(x + 1.2, y + 1.2, t - 2.4, t - 2.4, 1.2, 1.2, "S");
      doc.setTextColor(...OURO); doc.setFont("times", "bold"); doc.setFontSize(t * 1.15); doc.text("HR", x + t / 2, y + t / 2 + t * 0.15, { align: "center" });
    }
    function cabecalhoGrande() {
      doc.setFillColor(...AZUL); doc.rect(0, 0, W, 44, "F");
      // detalhe: faixas diagonais discretas à direita
      doc.setDrawColor(...AZUL2); doc.setLineWidth(5);
      for (let i = 0; i < 6; i++) doc.line(W - 70 + i * 13, 44, W - 40 + i * 13, 0);
      doc.setFillColor(...OURO); doc.rect(0, 44, W, 1.4, "F");
      doc.setFillColor(...OURO_CLARO); doc.rect(0, 45.4, W, 0.5, "F");
      selo(M, 11, 17);
      doc.setTextColor(...OURO_CLARO); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.text((o.marca || "CONTROLE FINANCEIRO").toUpperCase(), M + 22, 14.5, { charSpace: 0.8 });
      doc.setTextColor(255, 255, 255); doc.setFontSize(19); doc.text(o.titulo, M + 22, 22.5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(222, 228, 238);
      if (o.sub) doc.text(o.sub, M + 22, 29);
      // etiqueta do período
      const per = o.periodo || "", em = "Emitido em " + hojeLbl();
      doc.setFontSize(8.5);
      if (per) {
        doc.setFont("helvetica", "bold"); const tw = doc.getTextWidth(per) + 8;
        doc.setFillColor(...OURO); doc.roundedRect(W - M - tw, 30.5, tw, 7, 3.5, 3.5, "F");
        doc.setTextColor(...AZUL); doc.text(per, W - M - tw / 2, 35.1, { align: "center" });
      }
      doc.setFont("helvetica", "normal"); doc.setTextColor(200, 210, 225); doc.text(em, per ? W - M : W - M, per ? 26.5 : 35.1, { align: "right" });
      r.y = TOPO + 4;
    }
    function cabecalhoPequeno() {
      doc.setFillColor(...AZUL); doc.rect(0, 0, W, 16, "F"); doc.setFillColor(...OURO); doc.rect(0, 16, W, 0.9, "F");
      selo(M, 3.5, 9);
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text(o.titulo, M + 13, 9.6);
      if (o.periodo) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...OURO_CLARO); doc.text(o.periodo, W - M, 9.6, { align: "right" }); }
      r.y = 26;
    }
    r.novaPagina = () => { doc.addPage(); cabecalhoPequeno(); };
    r.espaco = h => { if (r.y + h > BASE) { r.novaPagina(); return true; } return false; };

    r.kpis = (itens) => {
      const n = itens.length, gap = 4, bw = (W - 2 * M - gap * (n - 1)) / n, h = 24;
      r.espaco(h + 4);
      itens.forEach((k, i) => {
        const x = M + i * (bw + gap), destaque = k.destaque;
        doc.setFillColor(...(destaque ? AZUL : CREME2)); doc.setDrawColor(...(destaque ? AZUL : OURO_CLARO)); doc.setLineWidth(0.4);
        doc.roundedRect(x, r.y, bw, h, 2.5, 2.5, "FD");
        doc.setFillColor(...OURO); doc.rect(x + 4, r.y + 4, 8, 0.9, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...(destaque ? OURO_CLARO : CINZA));
        doc.text(String(k.rotulo).toUpperCase(), x + 4, r.y + 9.5, { charSpace: 0.3 });
        doc.setFontSize(k.valor.length > 14 ? 11.5 : k.valor.length > 11 ? 13 : 15); doc.setTextColor(...(destaque ? [255, 255, 255] : (k.cor || TINTA)));
        doc.text(k.valor, x + 4, r.y + 17.5);
        if (k.nota) { doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...(destaque ? [200, 210, 225] : CINZA)); const nt = doc.splitTextToSize(k.nota, bw - 7); doc.text(nt[0] + (nt.length > 1 ? "…" : ""), x + 4, r.y + 21.5); }
      });
      r.y += h + 9;
    };

    r.secao = (titulo, dir) => {
      r.espaco(22);
      doc.setFillColor(...OURO); doc.rect(M, r.y - 4, 1.4, 5.5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...AZUL);
      doc.text(String(titulo).toUpperCase(), M + 4, r.y, { charSpace: 0.5 });
      if (dir) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.text(dir, W - M, r.y, { align: "right" }); }
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, r.y + 2.5, W - M, r.y + 2.5);
      r.y += 7;
    };

    /* cols: [{t:"Título", w:mm, a:"left|right|center", b:bold, cor:[r,g,b]|fn(valor,linha)}]; linhas: arrays de strings.
       opts.total: array de strings (linha de total). */
    r.tabela = (cols, linhas, opts = {}) => {
      const larg = W - 2 * M, soma = cols.reduce((a, c) => a + (c.w || 0), 0), semW = cols.filter(c => !c.w).length;
      const ws = cols.map(c => c.w || (larg - soma) / Math.max(1, semW));
      const xs = []; ws.reduce((x, w, i) => (xs[i] = x, x + w), M);
      const pad = 2.2, fs = opts.fonte || 8.8, lh = fs * 0.42;
      const topo = () => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(cols.length > 7 ? 6.4 : 7.3);
        const hs = cols.map((c, i) => doc.splitTextToSize(c.t.toUpperCase(), ws[i] - 2 * pad)), hh = Math.max(7.5, Math.max(...hs.map(h => h.length)) * 2.8 + 4.2);
        doc.setFillColor(...AZUL); doc.rect(M, r.y, larg, hh, "F"); doc.setTextColor(...OURO_CLARO);
        hs.forEach((h, i) => h.forEach((q, j) => tx(q, i, r.y + 4.9 + j * 2.8, cols[i].a)));
        r.y += hh;
      };
      const tx = (s, i, y, a) => { const x = a === "right" ? xs[i] + ws[i] - pad : a === "center" ? xs[i] + ws[i] / 2 : xs[i] + pad; doc.text(s, x, y, { align: a || "left" }); };
      r.espaco(7.5 + 10); topo();
      linhas.forEach((ln, k) => {
        doc.setFontSize(fs);
        const partes = ln.map((v, i) => { doc.setFont("helvetica", cols[i].b ? "bold" : "normal"); return doc.splitTextToSize(String(v ?? ""), ws[i] - 2 * pad); });
        const sub0 = opts.subs && opts.subs[k] && opts.subs[k].some(Boolean) ? opts.subs[k] : null;
        doc.setFont("helvetica", "normal"); doc.setFontSize(fs - 1.6);
        const sub = sub0 && sub0.map((v, i) => v ? doc.splitTextToSize(String(v), ws[i] - 2 * pad).slice(0, 3) : null);
        doc.setFontSize(fs);
        const nl = Math.max(...partes.map((p, i) => p.length + (sub && sub[i] ? sub[i].length * 0.85 : 0))), h = Math.max(7.4, nl * lh + 3.8);
        if (r.y + h > BASE) { r.novaPagina(); topo(); }
        if (k % 2 === 1) { doc.setFillColor(...CREME2); doc.rect(M, r.y, larg, h, "F"); }
        partes.forEach((p, i) => {
          const c = cols[i]; doc.setFont("helvetica", c.b ? "bold" : "normal"); doc.setFontSize(fs);
          const cor = typeof c.cor === "function" ? c.cor(ln[i], ln, k) : c.cor; doc.setTextColor(...(cor || TINTA));
          p.forEach((s, j) => tx(s, i, r.y + 4.6 + j * lh, c.a));
          if (sub && sub[i]) { doc.setFont("helvetica", "normal"); doc.setFontSize(fs - 1.6); doc.setTextColor(...CINZA); sub[i].forEach((q, j) => tx(q, i, r.y + 4.4 + p.length * lh * 0.95 + j * lh * 0.85, c.a)); }
        });
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.2); doc.line(M, r.y + h, W - M, r.y + h);
        r.y += h;
      });
      if (opts.total) {
        if (r.y + 9 > BASE) { r.novaPagina(); }
        doc.setFillColor(...CREME); doc.rect(M, r.y, larg, 8.5, "F"); doc.setFillColor(...OURO); doc.rect(M, r.y, larg, 0.6, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(fs + 0.4); doc.setTextColor(...AZUL);
        opts.total.forEach((v, i) => v && tx(String(v), i, r.y + 5.6, cols[i].a));
        r.y += 8.5;
      }
      if (!linhas.length) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...CINZA); doc.text("Nada lançado neste período.", M + pad, r.y + 6); r.y += 9; }
      r.y += 8;
    };

    r.nota = (texto, titulo) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.2);
      const linhas = doc.splitTextToSize(texto, W - 2 * M - 12), h = linhas.length * 4.2 + (titulo ? 11 : 7);
      r.espaco(h + 4);
      doc.setFillColor(...CREME); doc.setDrawColor(...OURO); doc.setLineWidth(0.4); doc.roundedRect(M, r.y, W - 2 * M, h, 2.5, 2.5, "FD");
      doc.setFillColor(...OURO); doc.rect(M, r.y + 2.5, 1.4, h - 5, "F");
      let yy = r.y + 6;
      if (titulo) { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...AZUL); doc.text(titulo.toUpperCase(), M + 6, yy, { charSpace: 0.4 }); yy += 5; }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.2); doc.setTextColor(...TINTA); doc.text(linhas, M + 6, yy);
      r.y += h + 8;
    };

    r.finalizar = () => {
      const n = doc.getNumberOfPages();
      for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        doc.setDrawColor(...OURO); doc.setLineWidth(0.4); doc.line(M, H - 13, W - M, H - 13);
        doc.setFont("times", "bold"); doc.setFontSize(9); doc.setTextColor(...OURO); doc.text("HR", M, H - 8);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
        doc.text("Controle Financeiro  ·  " + o.titulo + (o.periodo ? "  ·  " + o.periodo : ""), M + 6.5, H - 8);
        doc.text("Página " + p + " de " + n, W - M, H - 8, { align: "right" });
      }
      return doc;
    };

    cabecalhoGrande();
    return r;
  }

  const api = { novo, hojeLbl };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RelPDF = api;
})(typeof window !== "undefined" ? window : globalThis);

/* ---------- No site: botão "Emitir PDF" em cada aba, montado com o que está na tela ---------- */
(function () {
  if (typeof document === "undefined" || typeof module !== "undefined") return;
  const limpa = s => String(s || "").replace(/\s+/g, " ").replace(/[‹›]/g, "").trim();
  const visivel = el => !!el && el.getClientRects().length > 0 && !el.closest("[hidden]");
  const RX_NEG = /^[−-]\s*R\$|^−/;

  const BRL = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  function textoCelula(td) {
    const c = td.cloneNode(true), cks = c.querySelectorAll("input[type=checkbox]");
    c.querySelectorAll("button,select,.acts,svg,details,a.btn,.visually-hidden,.sr-only").forEach(b => b.remove());
    c.querySelectorAll("input:not([type=checkbox])").forEach(i => { const v = i.value, n = i.type === "number" && v !== "" ? +v : null;
      i.replaceWith(document.createTextNode(v === "" ? "—" : n != null && td.classList.contains("n") ? BRL(n) : v)); });
    const sozinho = cks.length && !limpa([...c.childNodes].map(n => n.nodeType === 1 && n.querySelector && (n.matches("input") || n.querySelector("input[type=checkbox]")) ? (n.matches("input") ? "" : n.textContent) : n.textContent).join(""));
    cks.forEach(i => i.replaceWith(document.createTextNode(sozinho ? (i.checked ? "Sim" : "Não") : "")));
    c.querySelectorAll("br").forEach(b => b.replaceWith(" "));
    c.querySelectorAll("span,b,label,div,strong,em,i").forEach(e => { e.before(" "); e.after(" "); });
    const subs = [...c.querySelectorAll(".ensub,.sub2,small")].filter(e => !e.parentElement.closest(".ensub,.sub2,small"));
    const sub = subs.map(e => limpa(e.textContent)).filter(Boolean);
    subs.forEach(e => e.remove());
    let t = limpa(c.textContent);
    let st = sub.map(x => x.replace(/^·\s*/, "")).join(" · ");
    if (!t && st) { t = st; st = ""; }
    return { t, s: st };
  }
  function lerTabela(tb) {
    const ths = [...tb.querySelectorAll("thead tr:last-child th")];
    let head = ths.map(th => limpa(th.textContent));
    const corpo = [...tb.querySelectorAll("tbody tr")].filter(tr => !(tr.children.length === 1 || /^(Nenhum|Nenhuma|Sem )/i.test(limpa(tr.textContent)) && tr.querySelector(".empty,[colspan]")));
    if (!corpo.length) return null;
    const cel = corpo.map(tr => [...tr.children].map(td => textoCelula(td)));
    const nc = Math.max(head.length, ...cel.map(l => l.length));
    const cab = Array.from({ length: nc }, (_, i) => head[i] || "");
    const manter = cab.map((h, i) => h || cel.some(l => l[i] && (l[i].t && l[i].t !== "—")));
    const alinhar = cab.map((h, i) => { const th = ths[i], td1 = corpo[0].children[i];
      return (th && th.classList.contains("n")) || (td1 && td1.classList.contains("n")) ? "right" : "left"; });
    if (cab.every(h => !h)) cab.forEach((_, i) => cab[i] = alinhar[i] === "right" ? "Valor" : i === 0 ? "Descrição" : "");
    const idx = cab.map((_, i) => i).filter(i => manter[i]);
    const tf = tb.querySelector("tfoot tr");
    const total = tf ? [...tf.children].flatMap(td => [limpa(td.textContent), ...Array(Math.max(0, (td.colSpan || 1) - 1)).fill("")]) : null;
    return { cab: idx.map(i => cab[i]), al: idx.map(i => alinhar[i]),
      linhas: cel.map(l => idx.map(i => (l[i] || {}).t || "")), subs: cel.map(l => idx.map(i => (l[i] || {}).s || null)),
      total: total ? idx.map(i => total[i] || "") : null };
  }
  function lerKpis(box) {
    return [...box.querySelectorAll(".ckpi,.kpi")].filter(visivel).map(k => ({
      rotulo: limpa(k.querySelector(".l") && k.querySelector(".l").textContent),
      valor: limpa(k.querySelector(".v") && k.querySelector(".v").textContent) || "—",
      nota: (() => { const s = k.querySelector(".s"); if (!s) return ""; const c = s.cloneNode(true); c.querySelectorAll("input").forEach(i => i.remove()); return limpa(c.textContent).slice(0, 48); })(),
      cor: (k.querySelector(".v.neg,.v.down,.v.red") ? "neg" : k.querySelector(".v.pos,.v.up,.v.green") ? "pos" : "")
    })).filter(k => k.rotulo);
  }
  function lerBarras(box) {
    return [...box.querySelectorAll(".bar")].filter(visivel).map(b => { const sp = [...b.children].filter(e => e.tagName === "SPAN"); return [limpa(sp[0] && sp[0].textContent), limpa(sp[sp.length - 1] && sp[sp.length - 1].textContent)]; }).filter(l => l[0]);
  }
  function periodoDe(panel) {
    const m = [...panel.querySelectorAll(".fatnav .mes, .mes")].find(visivel);
    if (m && limpa(m.textContent)) return limpa(m.textContent);
    const sel = [...panel.querySelectorAll("select")].find(s => visivel(s) && /^\d{4}$/.test(s.value));
    if (sel) return "Ano de " + sel.value;
    const inp = [...panel.querySelectorAll('input[type=month]')].find(i => visivel(i) && i.value && !i.closest("form"));
    if (inp) { const [a, mm] = inp.value.split("-"); return ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][+mm - 1] + " de " + a; }
    const ov = panel.querySelector("#ovMes"); if (ov && limpa(ov.textContent)) return limpa(ov.textContent);
    return "";
  }
  const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  function montar(aba) {
    const panel = document.querySelector(`[data-panel="${aba}"]`), btn = document.querySelector(`nav.tabs [data-tab="${aba}"] .tl`);
    const nome = limpa(btn ? btn.textContent : aba), periodo = cap1(periodoDe(panel));
    const larga = [...panel.querySelectorAll("table")].some(t => visivel(t) && t.querySelectorAll("thead tr:last-child th").length >= 9);
    const r = RelPDF.novo({ titulo: "Relatório · " + nome, sub: "O que aconteceu " + (periodo ? "em " + periodo.replace(/^Ano de /, "") : "até hoje") + ", com os totais e os lançamentos", periodo, paisagem: larga });
    const C = r.cores;
    let algo = false;
    [...panel.querySelectorAll(".card")].filter(c => visivel(c) && !c.closest(".secsheet") && !c.parentElement.closest(".card")).forEach(card => {
      const tit = limpa((card.querySelector("h2") || {}).textContent);
      const sub = limpa((card.querySelector("p.sub") || {}).textContent);
      const kp = card.querySelector(".ckpis,.kpis") ? lerKpis(card) : [];
      const tabs = [...card.querySelectorAll("table")].filter(visivel).map(lerTabela).filter(Boolean);
      const barras = lerBarras(card);
      if (!kp.length && !tabs.length && !barras.length) return;
      algo = true;
      if (kp.length) {
        for (let i = 0; i < kp.length; i += 4) {
          if (i === 0 && tit) r.secao(tit, periodo);
          r.kpis(kp.slice(i, i + 4).map((k, j) => ({ rotulo: k.rotulo, valor: k.valor, nota: k.nota, destaque: i === 0 && j === 0, cor: k.cor === "neg" ? C.VERMELHO : k.cor === "pos" ? C.VERDE : null })));
        }
      }
      tabs.forEach((t, n) => {
        if (!kp.length || n > 0) r.secao(n === 0 ? (tit || "Lançamentos") : tit + " (" + (n + 1) + ")", n === 0 ? (sub.length < 70 ? sub : "") : "");
        const larg = r.W - 2 * r.M, nc = t.cab.length, fs = nc > 8 ? 6.9 : nc > 6 ? 7.8 : 8.8, d = r.doc;
        const tw = (x, b, f) => { d.setFont("helvetica", b ? "bold" : "normal"); d.setFontSize(f); return d.getTextWidth(String(x || "")); };
        const palav = (x, b, f) => Math.max(0, ...String(x || "").split(/\s+/).map(w => tw(w, b, f)));
        const minW = [], desW = [];
        t.cab.forEach((h, i) => { const b = i === 0;
          minW[i] = Math.max(palav(h, true, 6.4), ...t.linhas.map(l => palav(l[i], b, fs))) + 4.6;
          desW[i] = Math.max(minW[i], ...t.linhas.map((l, k) => Math.min(48, Math.max(tw(l[i], b, fs), tw(t.subs[k][i], false, fs - 1.6))) + 4.6)); });
        let ws = desW.slice(); const sD = ws.reduce((a, b) => a + b, 0);
        if (sD > larg) { const sM = minW.reduce((a, b) => a + b, 0);
          ws = sM >= larg ? minW.map(w => w * larg / sM) : desW.map((w, i) => minW[i] + (w - minW[i]) * (larg - sM) / (sD - sM)); }
        else ws = ws.map(w => w * larg / sD);
        const cols = t.cab.map((h, i) => ({ t: h, w: ws[i], a: t.al[i], b: i === 0 || (t.al[i] === "right" && /valor|total/i.test(h)),
          cor: v => RX_NEG.test(v) ? C.VERMELHO : /^Sim$|^Pago$|^pago/i.test(v) ? C.VERDE : /^Não$|atrasad|vencid/i.test(v) ? C.VERMELHO : null }));
        r.tabela(cols, t.linhas, { total: t.total, subs: t.subs, fonte: fs });
      });
      if (barras.length && !tabs.length) {
        r.secao(tit || "Resumo", sub.length < 70 ? sub : "");
        r.tabela([{ t: "Item", b: true }, { t: "Valor", w: 60, a: "right" }], barras);
      }
    });
    if (!algo) r.nota("Esta aba ainda não tem lançamentos para mostrar no período escolhido.", "Sem dados");
    else r.nota("Relatório gerado a partir do que estava na tela da aba " + nome + (periodo ? " (" + periodo + ")" : "") + ". Os valores seguem os lançamentos feitos no site até o momento da emissão.", "Sobre este relatório");
    return { doc: r.finalizar(), nome: ("Relatorio " + nome + (periodo ? " " + periodo : "")).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\/\\:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() + ".pdf" };
  }

  async function emitir(aba, b) {
    if (!window.jspdf) { alert("O gerador de PDF não carregou. Recarregue a página."); return; }
    const txt = b.innerHTML; b.disabled = true; b.textContent = "Gerando…";
    try {
      const { doc, nome } = montar(aba), blob = doc.output("blob");
      const dl = window.claude ? await window.claude.use("downloads").catch(() => null) : null;
      if (dl) await dl.save({ filename: nome, data: blob });
      else { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    } catch (e) { console.error(e); alert("Não foi possível gerar o PDF."); }
    finally { b.disabled = false; b.innerHTML = txt; }
  }

  const st = document.createElement("style");
  st.textContent = `.pdfbar{display:flex;justify-content:flex-end;margin:0 0 10px}.pdfbar .btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--accent);color:var(--accent)}.pdfbar .btn svg{width:16px;height:16px}body.guest .pdfbar{display:none}`;
  document.head.appendChild(st);
  const ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/></svg>';
  document.querySelectorAll("section.panel[data-panel]").forEach(p => {
    const aba = p.dataset.panel; if (aba === "lancar" || aba === "aporte") return;
    const bar = document.createElement("div"); bar.className = "pdfbar";
    bar.innerHTML = `<button type="button" class="btn ghost small" title="Baixar um PDF com os totais e os lançamentos desta aba">${ICO}Emitir PDF</button>`;
    bar.firstChild.addEventListener("click", e => emitir(aba, e.currentTarget));
    p.insertBefore(bar, p.firstChild);
  });
  window.RelPDF.montarAba = montar;
})();
