/* Aba Energia solar: venda de créditos de energia (clientes, lançamentos mensais, PDF de cobrança e relatório anual).
   Mesmo cálculo da planilha controle_venda_energia.xlsx e do antigo site Créditos Solares:
   (kWh × tarifa) − desconto% + Contribuição de Iluminação Pública = valor a cobrar.
   Dados nas coleções solclientes, sollancs e solconfig (tabela cf_docs). */
(function () {
const $ = id => document.getElementById(id);
const C_CLI = "solclientes", C_LAN = "sollancs", C_CFG = "solconfig";
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MESES_EXT = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const brl = v => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf = (v, d = 2) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const r2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const mesLbl = m => { if (!m) return ""; const [y, mm] = m.split("-"); return MESES[+mm - 1] + "/" + y; };
const mesExt = m => { const [y, mm] = m.split("-"); return MESES_EXT[+mm - 1] + " de " + y; };
const dataLbl = d => { if (!d) return ""; const [y, m, dd] = d.split("-"); return dd + "/" + m + "/" + y; };
const hoje = () => { const t = new Date(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => v === "" || v == null ? null : Number(v);
const ymAdd = (m, d) => { let [y, mm] = m.split("-").map(Number); mm += d; while (mm > 12) { mm -= 12; y++; } while (mm < 1) { mm += 12; y--; } return y + "-" + String(mm).padStart(2, "0"); };
const arq = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 -]/g, "").trim() + ".pdf";

const BANDEIRAS = { verde: ["Verde", 0], amarela: ["Amarela", 0.01885], vermelha1: ["Vermelha patamar 1", 0.04463], vermelha2: ["Vermelha patamar 2", 0.07877] };
const bandNome = b => (BANDEIRAS[b] || BANDEIRAS.verde)[0];
function calc(l) {
  const bruto = r2((+l.kwh || 0) * (+l.tarifa || 0));
  const desconto = r2(bruto * (+l.descontoPct || 0) / 100);
  const liquido = r2(bruto - desconto);
  const cobrar = r2(liquido + (+l.cip || 0));
  const recebido = +l.recebido || 0;
  const aberto = r2(cobrar - recebido);
  const bandValor = l.bandeira && l.bandeira !== "verde" ? (+l.bandeiraValor || 0) : 0;
  const bandEcon = r2((+l.kwh || 0) * bandValor);
  const economia = r2(desconto + bandEcon);
  let status = "Pendente";
  if (aberto <= 0.005 && cobrar > 0) status = "Pago";
  else if (l.vencimento && hoje() > l.vencimento) status = "Atrasado";
  return { bruto, desconto, liquido, cobrar, recebido, aberto, status, bandEcon, economia };
}
const ST = { Pago: "ok", Pendente: "wait", Atrasado: "late" };
const pill = s => `<span class="st ${ST[s]}">${s}</span>`;

let clientes = [], lancs = [], cfg = {}, db = null, downloads = null, carregado = 0;
let editL = null, editC = null, armed = null, mesSel = null, seg = "resumo";
const cliNome = id => (clientes.find(c => c.id === id) || {}).nome || "(cliente removido)";
const msg = (id, t, ok) => { const m = $(String(id).replace(/^#/, "")); if (!m) return; m.textContent = t; m.className = "msg " + (ok ? "ok" : "err"); clearTimeout(msg[id]); msg[id] = setTimeout(() => { m.textContent = ""; }, 4000); };

/* ---------- partes da aba ---------- */
function enSeg(k) {
  if (!["resumo", "lanc", "cli"].includes(k)) k = "resumo";
  seg = k; $("enResumo").hidden = k !== "resumo"; $("enLanc").hidden = k !== "lanc"; $("enCli").hidden = k !== "cli";
  document.querySelectorAll("[data-enseg]").forEach(b => b.setAttribute("aria-pressed", b.dataset.enseg === k));
  try { localStorage.setItem("carteira-enseg", k); } catch (e) {}
}
document.addEventListener("click", e => { const b = e.target.closest("[data-enseg]"); if (b) { enSeg(b.dataset.enseg); window.scrollTo({ top: 0 }); } });
try { enSeg(localStorage.getItem("carteira-enseg") || "resumo"); } catch (e) { enSeg("resumo"); }

/* ---------- resumo ---------- */
const mesesComLanc = () => [...new Set(lancs.map(l => l.mes).filter(Boolean))].sort();
function porMes() {
  const by = {};
  lancs.forEach(l => { const c = calc(l), o = by[l.mes] || (by[l.mes] = { kwh: 0, b: 0, d: 0, co: 0, re: 0, ab: 0, e: 0, n: 0 });
    o.n++; o.kwh += +l.kwh || 0; o.b += c.bruto; o.d += c.desconto; o.co += c.cobrar; o.re += c.recebido; o.ab += Math.max(c.aberto, 0); o.e += c.economia; });
  return by;
}
const kp = (l, v, s, c = "") => `<div class="ckpi"><div class="l">${l}</div><div class="v ${c}">${v}</div><div class="s">${s}</div></div>`;
function renderResumo() {
  const ms = mesesComLanc(), by = porMes();
  const anos = [...new Set([...ms.map(m => m.slice(0, 4)), hoje().slice(0, 4)])].sort().reverse();
  const aSel = $("enAno"), prevA = aSel.value;
  aSel.innerHTML = anos.map(a => `<option>${a}</option>`).join("");
  aSel.value = anos.includes(prevA) ? prevA : (ms.length ? ms[ms.length - 1].slice(0, 4) : anos[0]);
  const ano = aSel.value, ks = Object.keys(by).filter(k => k.slice(0, 4) === ano).sort();
  const t = ks.reduce((a, k) => { const o = by[k]; a.kwh += o.kwh; a.e += o.e; a.co += o.co; a.re += o.re; a.ab += o.ab; return a; }, { kwh: 0, e: 0, co: 0, re: 0, ab: 0 });
  const best = ks.slice().sort((a, b) => by[b].co - by[a].co)[0];
  $("enAnoKpis").innerHTML =
    kp("Cobrado no ano", brl(t.co), ks.length ? "média " + brl(t.co / ks.length) + "/mês" : "nada lançado", "gold") +
    kp("Recebido no ano", brl(t.re), best ? "melhor mês " + mesLbl(best) : "", "up") +
    kp("Em aberto", brl(t.ab), t.ab > 0.004 ? "falta receber" : "tudo recebido", t.ab > 0.004 ? "down" : "") +
    kp("kWh vendidos", nf(t.kwh, 0) + " kWh", ks.length + (ks.length === 1 ? " mês" : " meses")) +
    kp("Economia dos clientes", brl(t.e), "desconto + bandeiras");
  // gráfico mês a mês
  const meses = MESES.map((_, i) => ano + "-" + String(i + 1).padStart(2, "0"));
  $("enChart").innerHTML = barras(meses, [meses.map(m => by[m] ? r2(by[m].co) : 0), meses.map(m => by[m] ? r2(by[m].re) : 0)], ["ec", "er"], ano);
  // mês de referência
  if (!mesSel || (!ms.includes(mesSel) && ms.length && mesSel > ms[ms.length - 1])) mesSel = ms.length ? ms[ms.length - 1] : hoje().slice(0, 7);
  $("enMes").textContent = MESES_EXT[+mesSel.slice(5) - 1] + " " + mesSel.slice(0, 4);
  const doMes = lancs.filter(l => l.mes === mesSel).map(l => ({ l, c: calc(l) })).sort((a, b) => cliNome(a.l.clienteId).localeCompare(cliNome(b.l.clienteId)));
  const s = doMes.reduce((a, { l, c }) => (a.co += c.cobrar, a.re += c.recebido, a.ab += Math.max(c.aberto, 0), a.kwh += +l.kwh || 0, a), { co: 0, re: 0, ab: 0, kwh: 0 });
  $("enMesKpis").innerHTML = kp("A cobrar", brl(s.co), nf(s.kwh, 0) + " kWh · " + doMes.length + (doMes.length === 1 ? " conta" : " contas"), "gold") + kp("Recebido", brl(s.re), "") + kp("Em aberto", brl(s.ab), "", s.ab > 0.004 ? "down" : "");
  $("enTblMes").innerHTML = `<thead><tr><th>Cliente</th><th class="n">kWh</th><th class="n">A cobrar</th><th class="n">Recebido</th><th>Situação</th></tr></thead><tbody>` +
    (doMes.length ? doMes.map(({ l, c }) => `<tr><td>${esc(cliNome(l.clienteId))}</td><td class="n" data-label="kWh">${nf(l.kwh, 0)}</td><td class="n" data-label="A cobrar">${brl(c.cobrar)}</td><td class="n" data-label="Recebido">${brl(c.recebido)}</td><td data-label="Situação">${pill(c.status)}</td></tr>`).join("")
      : `<tr><td colspan="5" class="empty">Nenhuma conta neste mês.</td></tr>`) + "</tbody>";
  // relatório anual
  $("enRaSub").textContent = "PDF com o que o cliente pagou e economizou em " + ano;
  const linhas = clientes.map(cl => { const ls = lancs.filter(l => l.clienteId === cl.id && (l.mes || "").slice(0, 4) === ano);
    return { cl, n: ls.length, k: ls.reduce((a, l) => a + (+l.kwh || 0), 0), co: ls.reduce((a, l) => a + calc(l).cobrar, 0), e: ls.reduce((a, l) => a + calc(l).economia, 0) }; }).filter(x => x.n);
  $("enTblAnual").innerHTML = `<thead><tr><th>Cliente</th><th class="n">Meses</th><th class="n">kWh</th><th class="n">Pago no ano</th><th class="n">Economia</th><th></th></tr></thead><tbody>` +
    (linhas.length ? linhas.map(x => `<tr><td>${esc(x.cl.nome)}</td><td class="n" data-label="Meses">${x.n}</td><td class="n" data-label="kWh">${nf(x.k, 0)}</td><td class="n" data-label="Pago no ano">${brl(x.co)}</td><td class="n up" data-label="Economia">${brl(x.e)}</td><td><div class="acts"><button class="btn small" type="button" data-enanual="${esc(x.cl.id)}">PDF do ano</button></div></td></tr>`).join("")
      : `<tr><td colspan="6" class="empty">Nenhum cliente com lançamentos em ${esc(ano)}.</td></tr>`) + "</tbody>";
  // saldo por cliente
  $("enTblSaldo").innerHTML = `<thead><tr><th>Cliente</th><th class="n">kWh</th><th class="n">Cobrado</th><th class="n">Recebido</th><th class="n">Em aberto</th><th class="n">Atrasadas</th></tr></thead><tbody>` +
    (clientes.length ? clientes.map(cl => { let k = 0, co = 0, re = 0, ab = 0, at = 0;
      lancs.filter(l => l.clienteId === cl.id).forEach(l => { const c = calc(l); k += +l.kwh || 0; co += c.cobrar; re += c.recebido; ab += Math.max(c.aberto, 0); if (c.status === "Atrasado") at++; });
      return `<tr><td>${esc(cl.nome)}</td><td class="n" data-label="kWh">${nf(k, 0)}</td><td class="n" data-label="Cobrado">${brl(co)}</td><td class="n" data-label="Recebido">${brl(re)}</td><td class="n${ab > 0.004 ? " down" : ""}" data-label="Em aberto">${brl(ab)}</td><td class="n" data-label="Atrasadas">${at ? `<span class="st late">${at}</span>` : "0"}</td></tr>`; }).join("")
      : `<tr><td colspan="6" class="empty">Nenhum cliente cadastrado ainda.</td></tr>`) + "</tbody>";
}
function barras(meses, series, cls, ano) {
  const vals = series.flat(), max = Math.max(0, ...vals);
  if (!max) return `<p class="empty">Sem lançamentos em ${esc(ano)}. As barras aparecem conforme você lança as contas.</p>`;
  const W = 1000, H = 240, L = 56, B = 24, T = 12, raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= raw), top = step * 4;
  const y = v => T + (H - T - B) * (1 - v / top), bw = (W - L) / meses.length, n = series.length;
  let g = ""; for (let i = 0; i <= 4; i++) { const v = step * i; g += `<line class="grid" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v >= 1000 ? nf(v / 1000, v % 1000 ? 1 : 0) + " mil" : nf(v, 0)}</text>`; }
  meses.forEach((m, i) => { const gw = bw * 0.7, w = gw / n;
    series.forEach((s, j) => { const v = s[i]; if (v <= 0) return; const X = L + i * bw + bw * 0.15 + j * w, Y = y(v), h = y(0) - Y;
      g += `<rect class="${cls[j]}" x="${X.toFixed(1)}" y="${Y.toFixed(1)}" width="${Math.max(1, w - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${MESES[+m.slice(5) - 1]}: ${j ? "recebido" : "a cobrar"} ${brl(v)}</title></rect>`; });
    g += `<text x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle" class="lbl">${MESES[+m.slice(5) - 1]}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Valores a cobrar e recebidos por mês em ${esc(ano)}">${g}</svg>`;
}
$("enAno").addEventListener("change", renderResumo);
$("enPrev").addEventListener("click", () => { mesSel = ymAdd(mesSel, -1); renderResumo(); });
$("enNext").addEventListener("click", () => { mesSel = ymAdd(mesSel, 1); renderResumo(); });

/* ---------- lançamentos ---------- */
function fillSel(sel, opts) { const cur = sel.value; sel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(""); if ([...sel.options].some(o => o.value === cur)) sel.value = cur; }
function renderLancs() {
  fillSel($("enFMes"), [["", "Todos os meses"], ...mesesComLanc().reverse().map(m => [m, mesLbl(m)])]);
  fillSel($("enFCli"), [["", "Todos os clientes"], ...clientes.map(c => [c.id, c.nome])]);
  const fm = $("enFMes").value, fc = $("enFCli").value, fs = $("enFSt").value;
  const rows = lancs.map(l => ({ l, c: calc(l) })).filter(({ l, c }) => (!fm || l.mes === fm) && (!fc || l.clienteId === fc) && (!fs || c.status === fs))
    .sort((a, b) => (b.l.mes || "").localeCompare(a.l.mes || "") || cliNome(a.l.clienteId).localeCompare(cliNome(b.l.clienteId)));
  const t = rows.reduce((a, { l, c }) => (a.k += +l.kwh || 0, a.co += c.cobrar, a.re += c.recebido, a), { k: 0, co: 0, re: 0 });
  $("enTblL").innerHTML = `<thead><tr><th>Mês</th><th>Cliente</th><th class="n">kWh</th><th class="n">Tarifa</th><th class="n">Desc.</th><th class="n">Ilum. púb.</th><th class="n">A cobrar</th><th class="n">Recebido</th><th>Venc.</th><th>Situação</th><th></th></tr></thead><tbody>` +
    (rows.length ? rows.map(({ l, c }) => `<tr>
      <td><b>${mesLbl(l.mes)}</b>${l.bandeira && l.bandeira !== "verde" ? `<span class="ensub">bandeira ${bandNome(l.bandeira).toLowerCase()}</span>` : ""}</td>
      <td data-label="Cliente">${esc(cliNome(l.clienteId))}${l.obs ? `<span class="ensub">${esc(l.obs)}</span>` : ""}</td>
      <td class="n" data-label="kWh">${nf(l.kwh, 0)}</td><td class="n" data-label="Tarifa">${nf(l.tarifa, 6)}</td><td class="n" data-label="Desconto">${nf(l.descontoPct, 0)}%</td>
      <td class="n" data-label="Ilum. pública">${brl(l.cip)}</td><td class="n" data-label="A cobrar"><b>${brl(c.cobrar)}</b></td><td class="n" data-label="Recebido">${brl(c.recebido)}</td>
      <td class="num" data-label="Vencimento">${dataLbl(l.vencimento)}</td><td data-label="Situação">${pill(c.status)}</td>
      <td><div class="acts">
        <button class="btn small" type="button" data-enpdf="${l.id}">PDF</button>
        <button class="btn ghost small" type="button" data-encopy="${l.id}">Copiar texto</button>
        ${c.status !== "Pago" ? `<button class="btn ghost small" type="button" data-enpay="${l.id}">Marcar pago</button>` : ""}
        <button class="btn ghost small" type="button" data-enedit="${l.id}">Editar</button>
        <button class="btn ${armed === l.id ? "danger" : "ghost"} small" type="button" data-endel="${l.id}">${armed === l.id ? "Confirmar" : "Excluir"}</button>
      </div></td></tr>`).join("")
      : `<tr><td colspan="11" class="empty">${lancs.length ? "Nenhum lançamento com esses filtros." : "Nenhum lançamento ainda. Toque em “+ Novo lançamento” para lançar a conta do mês."}</td></tr>`) + "</tbody>" +
    (rows.length > 1 ? `<tfoot><tr><td>Total (${rows.length})</td><td></td><td class="n" data-label="kWh">${nf(t.k, 0)}</td><td></td><td></td><td></td><td class="n" data-label="A cobrar">${brl(t.co)}</td><td class="n" data-label="Recebido">${brl(t.re)}</td><td></td><td></td><td></td></tr></tfoot>` : "");
}
["enFMes", "enFCli", "enFSt"].forEach(id => $(id).addEventListener("change", renderLancs));

function formToL() {
  const b = $("elBand").value;
  return { mes: $("elMes").value, clienteId: $("elCli").value, kwh: num($("elKwh").value), tarifa: num($("elTarifa").value), descontoPct: num($("elDesc").value),
    bandeira: b, bandeiraValor: b === "verde" ? 0 : (num($("elBandVal").value) ?? 0),
    cip: num($("elCip").value) ?? 0, contaDistribuidora: num($("elConta").value), vencimento: $("elVenc").value || null, pagamento: $("elPagto").value || null,
    recebido: num($("elReceb").value), obs: $("elObs").value.trim() };
}
function updCalc() {
  const l = formToL();
  if (l.kwh == null || l.tarifa == null) { $("elCalc").textContent = "Preencha kWh e valor do kWh para ver o cálculo."; return; }
  const c = calc(l);
  $("elCalc").innerHTML = `${nf(l.kwh, 2)} kWh × ${nf(l.tarifa, 6)} = ${brl(c.bruto)}<br>− ${nf(l.descontoPct || 0, 2)}% de desconto (${brl(c.desconto)}) = ${brl(c.liquido)}<br>+ Ilum. pública ${brl(l.cip)}<b class="tot">Valor a cobrar: ${brl(c.cobrar)}</b><span class="eco">Economia do cliente: ${brl(c.desconto)} de desconto${c.bandEcon ? ` + ${brl(c.bandEcon)} da bandeira ${bandNome(l.bandeira).toLowerCase()}` : ""} = <b>${brl(c.economia)}</b></span>`;
}
["elKwh", "elTarifa", "elDesc", "elCip", "elReceb", "elBandVal"].forEach(id => $(id).addEventListener("input", updCalc));
function syncBand() { const b = $("elBand").value; $("elBandVal").disabled = b === "verde"; if (b === "verde") $("elBandVal").value = "0"; else if (!+$("elBandVal").value) $("elBandVal").value = BANDEIRAS[b][1]; }
$("elBand").addEventListener("change", () => { const b = $("elBand").value; $("elBandVal").value = b === "verde" ? "0" : BANDEIRAS[b][1]; syncBand(); updCalc(); });
function prevL(cli, mes) { return lancs.filter(l => l.clienteId === cli && l.id !== editL && (!mes || (l.mes || "") < mes)).sort((a, b) => (b.mes || "").localeCompare(a.mes || ""))[0] || null; }
function hints() {
  const p = prevL($("elCli").value, $("elMes").value);
  const h = (id, campo, txt, val) => { const el = $(id); if (!p || val == null || val === "") { el.textContent = ""; return; } el.innerHTML = `${mesLbl(p.mes)}: ${esc(txt)} <button type="button" data-enuse="${campo}" data-v="${esc(val)}">usar</button>`; };
  h("ehKwh", "elKwh", nf(p && p.kwh, 0) + " kWh", p && p.kwh); h("ehTarifa", "elTarifa", "R$ " + nf(p && p.tarifa, 6), p && p.tarifa); h("ehCip", "elCip", brl(p && p.cip), p && p.cip);
  $("ehBand").textContent = p ? mesLbl(p.mes) + ": " + bandNome(p.bandeira) : "";
}
function defaultsFor(cli) {
  const c = clientes.find(x => x.id === cli) || {}, p = prevL(cli, null), ult = [...lancs].sort((a, b) => (b.mes || "").localeCompare(a.mes || ""))[0];
  $("elMes").value = p ? ymAdd(p.mes, 1) : hoje().slice(0, 7);
  $("elTarifa").value = (p ? p.tarifa : ult ? ult.tarifa : "") ?? "";
  $("elDesc").value = c.descontoPct ?? 20;
  $("elBand").value = p && p.bandeira || "verde"; $("elBandVal").value = p && p.bandeira && p.bandeira !== "verde" ? p.bandeiraValor : "0"; syncBand();
  $("elCip").value = p && p.cip != null ? p.cip : ""; $("elKwh").value = "";
}
$("elCli").addEventListener("change", () => { if (!editL) defaultsFor($("elCli").value); hints(); updCalc(); });
$("elMes").addEventListener("change", hints);
$("enFormL").addEventListener("click", e => { const b = e.target.closest("button[data-enuse]"); if (!b) return; $(b.dataset.enuse).value = b.dataset.v; updCalc(); });
function openL(l) {
  if (!clientes.length) { msg("#enMsgC", "Cadastre um cliente antes do primeiro lançamento."); enSeg("cli"); openC(null); return; }
  editL = l ? l.id : null;
  $("enFormLTit").textContent = l ? "Editar lançamento" : "Novo lançamento";
  fillSel($("elCli"), clientes.map(c => [c.id, c.nome]));
  if (l) {
    $("elMes").value = l.mes || ""; $("elCli").value = l.clienteId || ""; $("elKwh").value = l.kwh ?? ""; $("elTarifa").value = l.tarifa ?? "";
    $("elDesc").value = l.descontoPct ?? ""; $("elCip").value = l.cip ?? "";
    $("elBand").value = l.bandeira || "verde"; $("elBandVal").value = l.bandeira && l.bandeira !== "verde" ? l.bandeiraValor : "0"; syncBand();
  } else {
    const fc = $("enFCli").value, cli = clientes.some(c => c.id === fc) ? fc : clientes[0].id;
    $("elCli").value = cli; defaultsFor(cli);
  }
  const d = l || {};
  $("elConta").value = d.contaDistribuidora ?? ""; $("elVenc").value = d.vencimento || ""; $("elPagto").value = d.pagamento || ""; $("elReceb").value = d.recebido ?? ""; $("elObs").value = d.obs || "";
  $("enFormL").hidden = false; hints(); updCalc(); $("enFormL").scrollIntoView({ block: "nearest" }); $("elKwh").focus();
}
$("enNovoL").addEventListener("click", () => openL(null));
$("elCancel").addEventListener("click", () => { $("enFormL").hidden = true; editL = null; });
$("enFormL").addEventListener("submit", async e => {
  e.preventDefault(); if (!db) return;
  const l = formToL();
  try {
    $("elSalvar").disabled = true;
    if (editL) await db.collection(C_LAN).doc(editL).set({ ...l, atualizadoEm: new Date().toISOString() });
    else await db.collection(C_LAN).add({ ...l, atualizadoEm: new Date().toISOString() });
    $("enFormL").hidden = true; editL = null; msg("#enMsgL", "Lançamento salvo.", true);
  } catch (err) { msg("#enMsgL", "Não foi possível salvar. Tente de novo."); }
  finally { $("elSalvar").disabled = false; }
});

/* ---------- clientes ---------- */
function renderClientes() {
  $("enTblC").innerHTML = `<thead><tr><th>Nome</th><th>UC</th><th>CPF/CNPJ</th><th>Telefone</th><th class="n">Desconto</th><th class="n">Rateio</th><th></th></tr></thead><tbody>` +
    (clientes.length ? clientes.map(c => `<tr>
      <td>${esc(c.nome)}${c.obs ? `<span class="ensub">${esc(c.obs)}</span>` : ""}</td><td class="num" data-label="UC">${esc(c.uc)}</td><td class="num" data-label="CPF/CNPJ">${esc(c.doc)}</td><td class="num" data-label="Telefone">${esc(c.tel)}</td>
      <td class="n" data-label="Desconto">${nf(c.descontoPct, 0)}%</td><td class="n" data-label="Rateio">${c.rateioPct != null ? nf(c.rateioPct, 0) + "%" : ""}</td>
      <td><div class="acts"><button class="btn ghost small" type="button" data-encedit="${c.id}">Editar</button>
        <button class="btn ${armed === c.id ? "danger" : "ghost"} small" type="button" data-encdel="${c.id}">${armed === c.id ? "Confirmar" : "Excluir"}</button></div></td></tr>`).join("")
      : `<tr><td colspan="7" class="empty">Nenhum cliente ainda. Toque em “+ Novo cliente” para cadastrar a primeira UC.</td></tr>`) + "</tbody>";
}
function openC(c) {
  editC = c ? c.id : null; $("enFormCTit").textContent = c ? "Editar cliente" : "Novo cliente";
  $("ecNome").value = c?.nome || ""; $("ecUc").value = c?.uc || ""; $("ecDoc").value = c?.doc || ""; $("ecTel").value = c?.tel || "";
  $("ecDesc").value = c?.descontoPct ?? 20; $("ecRateio").value = c?.rateioPct ?? ""; $("ecObs").value = c?.obs || "";
  $("enFormC").hidden = false; $("ecNome").focus();
}
$("enNovoC").addEventListener("click", () => openC(null));
$("ecCancel").addEventListener("click", () => { $("enFormC").hidden = true; editC = null; });
$("enFormC").addEventListener("submit", async e => {
  e.preventDefault(); if (!db) return;
  const c = { nome: $("ecNome").value.trim(), uc: $("ecUc").value.trim(), doc: $("ecDoc").value.trim(), tel: $("ecTel").value.trim(),
    descontoPct: num($("ecDesc").value), rateioPct: num($("ecRateio").value), obs: $("ecObs").value.trim() };
  if (clientes.some(x => x.id !== editC && (x.nome || "").toLowerCase() === c.nome.toLowerCase())) { msg("#enMsgC", "Já existe um cliente com esse nome."); return; }
  try {
    if (editC) await db.collection(C_CLI).doc(editC).set(c); else await db.collection(C_CLI).add(c);
    $("enFormC").hidden = true; editC = null; msg("#enMsgC", "Cliente salvo.", true);
  } catch (err) { msg("#enMsgC", "Não foi possível salvar o cliente. Tente de novo."); }
});
$("enFormCfg").addEventListener("submit", async e => {
  e.preventDefault(); if (!db) return;
  const v = { nome: $("ecfNome").value.trim(), pix: $("ecfPix").value.trim(), tel: $("ecfTel").value.trim() };
  try { await db.doc(C_CFG + "/geral").set(v); msg("#enMsgCfg", "Seus dados foram salvos.", true); } catch (_) { msg("#enMsgCfg", "Não foi possível salvar."); }
});

/* ---------- ações nas tabelas ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b || !b.closest('[data-panel="energia"]')) return;
  const d = b.dataset;
  if (d.enedit) openL(lancs.find(l => l.id === d.enedit));
  else if (d.encedit) openC(clientes.find(c => c.id === d.encedit));
  else if (d.enpay) { const l = lancs.find(x => x.id === d.enpay), c = calc(l);
    try { await db.collection(C_LAN).doc(l.id).update({ recebido: c.cobrar, pagamento: l.pagamento || hoje() }); msg("#enMsgL", "Marcado como pago.", true); } catch (_) { msg("#enMsgL", "Não foi possível atualizar."); } }
  else if (d.endel || d.encdel) { const id = d.endel || d.encdel, alvo = d.endel ? "#enMsgL" : "#enMsgC";
    if (armed !== id) { armed = id; renderTudo(); setTimeout(() => { if (armed === id) { armed = null; renderTudo(); } }, 4000); return; }
    armed = null;
    if (d.encdel && lancs.some(l => l.clienteId === id)) { msg(alvo, "Esse cliente tem lançamentos. Exclua os lançamentos antes."); renderTudo(); return; }
    try { await db.collection(d.endel ? C_LAN : C_CLI).doc(id).delete(); msg(alvo, "Excluído.", true); } catch (_) { msg(alvo, "Não foi possível excluir."); } }
  else if (d.enpdf) { const l = lancs.find(x => x.id === d.enpdf), cl = clientes.find(x => x.id === l.clienteId) || {};
    salvarPDF(() => montarPDF(l), arq("Cobranca " + mesLbl(l.mes).replace("/", "-") + " " + (cl.nome || "cliente")), b, "#enMsgL"); }
  else if (d.enanual) { const ano = $("enAno").value, cl = clientes.find(x => x.id === d.enanual) || {};
    salvarPDF(() => montarAnual(d.enanual, ano), arq("Relatorio anual " + ano + " " + (cl.nome || "cliente")), b, null); }
  else if (d.encopy) { const l = lancs.find(x => x.id === d.encopy), c = calc(l), cl = clientes.find(x => x.id === l.clienteId) || {};
    const txt = `Cobrança de energia solar – ${mesLbl(l.mes)}\n${cl.nome || ""}${cl.uc ? " (UC " + cl.uc + ")" : ""}\n\n${nf(l.kwh, 0)} kWh × R$ ${nf(l.tarifa, 6)} = ${brl(c.bruto)}\nDesconto de ${nf(l.descontoPct, 0)}%: − ${brl(c.desconto)}\nIluminação pública: + ${brl(l.cip)}\n\nTotal a pagar: ${brl(c.cobrar)}${l.vencimento ? "\nVencimento: " + dataLbl(l.vencimento) : ""}${cfg.pix ? "\nPIX: " + cfg.pix : ""}\n\nSua economia no mês: ${brl(c.economia)}${c.bandEcon ? ` (desconto ${brl(c.desconto)} + bandeira ${bandNome(l.bandeira).toLowerCase()} ${brl(c.bandEcon)})` : ""}`;
    try { await navigator.clipboard.writeText(txt); msg("#enMsgL", "Texto da cobrança copiado. Cole no WhatsApp.", true); } catch (_) { prompt("Copie o texto:", txt); } }
});

/* ---------- PDFs ---------- */
const AZUL = [13, 92, 120], SOL = [227, 155, 20], TINTA = [20, 35, 44], CINZA = [91, 109, 120], LINHA = [216, 225, 231], VERDE = [29, 122, 70];
function cabecalho(doc, titulo, sub) {
  const W = 210, M = 18;
  doc.setFillColor(...AZUL); doc.rect(0, 0, W, 38, "F"); doc.setFillColor(...SOL); doc.circle(M + 5, 19, 5, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(titulo, M + 15, 17);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(sub, M + 15, 25);
  const t = new Date(); doc.setFontSize(9); doc.text("Emitido em " + String(t.getDate()).padStart(2, "0") + "/" + String(t.getMonth() + 1).padStart(2, "0") + "/" + t.getFullYear(), W - M, 33, { align: "right" });
}
function blocoCliente(doc, cl) {
  const M = 18; let y = 52;
  doc.setTextColor(...CINZA); doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("CLIENTE", M, y);
  y += 6; doc.setTextColor(...TINTA); doc.setFontSize(13); doc.text(cl.nome || "", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...CINZA);
  const info = [cl.uc ? "UC " + cl.uc : "", cl.doc ? "CPF/CNPJ " + cl.doc : ""].filter(Boolean).join("   |   ");
  if (info) { y += 6; doc.text(info, M, y); }
  return y;
}
function montarPDF(l) {
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: "mm", format: "a4" });
  const c = calc(l), cl = clientes.find(x => x.id === l.clienteId) || {}, W = 210, M = 18;
  cabecalho(doc, "Cobrança de energia solar", "Créditos de energia compensados em " + mesExt(l.mes));
  let y = blocoCliente(doc, cl);
  y += 14; doc.setTextColor(...CINZA); doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("COMO O VALOR FOI CALCULADO", M, y);
  y += 4;
  const rows = [
    ["Energia compensada na sua conta", nf(l.kwh, 0) + " kWh"],
    ["Valor do kWh no mês", "R$ " + nf(l.tarifa, 6)],
    ["Valor da energia (" + nf(l.kwh, 0) + " kWh × R$ " + nf(l.tarifa, 6) + ")", brl(c.bruto)],
    ["Desconto de " + nf(l.descontoPct, 0) + "%", "- " + brl(c.desconto)],
    ["Energia com desconto", brl(c.liquido)],
    ["Contribuição de Iluminação Pública (da sua conta)", "+ " + brl(l.cip)],
  ];
  doc.setFontSize(10.5);
  rows.forEach((r, i) => { y += 10; doc.setFont("helvetica", i === 4 ? "bold" : "normal"); doc.setTextColor(...(i === 3 ? VERDE : TINTA));
    doc.text(r[0], M + 2, y); doc.text(r[1], W - M - 2, y, { align: "right" }); doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, y + 4, W - M, y + 4); });
  y += 12; doc.setFillColor(253, 241, 216); doc.setDrawColor(...SOL); doc.setLineWidth(0.6); doc.roundedRect(M, y, W - 2 * M, 26, 3, 3, "FD");
  doc.setTextColor(...TINTA); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("VALOR A PAGAR", M + 6, y + 11);
  doc.setFontSize(22); doc.text(brl(c.cobrar), W - M - 6, y + 16, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...CINZA);
  doc.text(l.vencimento ? "Vencimento: " + dataLbl(l.vencimento) : "Referente a " + mesExt(l.mes), M + 6, y + 19);
  y += 36;
  doc.setTextColor(...CINZA); doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("SUA ECONOMIA NESTE MÊS", M, y);
  y += 4;
  const eco = [["Desconto de " + nf(l.descontoPct, 0) + "% sobre a energia", brl(c.desconto)]];
  if (c.bandEcon) eco.push(["Bandeira " + bandNome(l.bandeira).toLowerCase() + " que você não pagou (" + nf(l.kwh, 0) + " kWh × R$ " + nf(l.bandeiraValor, 5) + ")", brl(c.bandEcon)]);
  else eco.push(["Bandeira do mês: " + bandNome(l.bandeira).toLowerCase() + " (sem cobrança extra)", brl(0)]);
  doc.setFontSize(10.5);
  eco.forEach(r => { y += 10; doc.setFont("helvetica", "normal"); doc.setTextColor(...TINTA); doc.text(r[0], M + 2, y); doc.text(r[1], W - M - 2, y, { align: "right" });
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, y + 4, W - M, y + 4); });
  y += 11; doc.setTextColor(...VERDE); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Total economizado", M + 2, y); doc.text(brl(c.economia), W - M - 2, y, { align: "right" });
  const fy = 258; doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, fy, W - M, fy);
  doc.setTextColor(...CINZA); doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("PAGAMENTO", M, fy + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...TINTA);
  const pg = [cfg.nome ? "Favorecido: " + cfg.nome : "", cfg.pix ? "Chave PIX: " + cfg.pix : "", cfg.tel ? "Contato: " + cfg.tel : ""].filter(Boolean);
  (pg.length ? pg : ["Combine a forma de pagamento com o fornecedor dos créditos."]).forEach((t, i) => doc.text(t, M, fy + 14 + i * 6));
  return doc;
}
function montarAnual(cliId, ano) {
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cl = clientes.find(x => x.id === cliId) || {}, W = 210, M = 18;
  const ls = lancs.filter(l => l.clienteId === cliId && (l.mes || "").slice(0, 4) === ano).sort((a, b) => a.mes.localeCompare(b.mes));
  cabecalho(doc, "Relatório anual de energia solar", "Resumo de " + ano);
  let y = blocoCliente(doc, cl);
  const cs = ls.map(calc), tk = ls.reduce((a, l) => a + (+l.kwh || 0), 0), tco = cs.reduce((a, c) => a + c.cobrar, 0), te = cs.reduce((a, c) => a + c.economia, 0);
  y += 10; const bw = (W - 2 * M - 8) / 3;
  [["ENERGIA COMPENSADA", nf(tk, 0) + " kWh", TINTA], ["VOCÊ PAGOU NO ANO", brl(tco), TINTA], ["VOCÊ ECONOMIZOU", brl(te), VERDE]].forEach((b, i) => {
    const x = M + i * (bw + 4); doc.setDrawColor(...(i === 2 ? VERDE : LINHA)); doc.setFillColor(...(i === 2 ? [225, 243, 232] : [247, 249, 250])); doc.setLineWidth(0.4); doc.roundedRect(x, y, bw, 22, 3, 3, "FD");
    doc.setTextColor(...CINZA); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(b[0], x + 4, y + 7);
    doc.setTextColor(...b[2]); doc.setFontSize(14); doc.text(b[1], x + 4, y + 16); });
  y += 34; doc.setTextColor(...CINZA); doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("MÊS A MÊS", M, y);
  const cols = [[M + 2, "Mês", "left"], [M + 40, "Bandeira", "left"], [M + 100, "kWh", "right"], [M + 136, "Valor pago", "right"], [W - M - 2, "Economia", "right"]];
  y += 8; doc.setFontSize(8.5); cols.forEach(c => doc.text(c[1].toUpperCase(), c[0], y, { align: c[2] }));
  doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, y + 3, W - M, y + 3);
  doc.setFontSize(10);
  ls.forEach((l, i) => { const c = cs[i]; y += 8.5; doc.setFont("helvetica", "normal"); doc.setTextColor(...TINTA);
    const vals = [MESES_EXT[+l.mes.slice(5) - 1].replace(/^./, m => m.toUpperCase()), bandNome(l.bandeira), nf(l.kwh, 0), brl(c.cobrar), brl(c.economia)];
    cols.forEach((col, j) => { if (j === 4) doc.setTextColor(...VERDE); doc.text(vals[j], col[0], y, { align: col[2] }); });
    doc.setDrawColor(...LINHA); doc.line(M, y + 3, W - M, y + 3); });
  y += 9; doc.setFont("helvetica", "bold"); doc.setTextColor(...TINTA);
  [["Total " + ano, 0], [nf(tk, 0), 2], [brl(tco), 3], [brl(te), 4]].forEach(([v, j]) => { if (j === 4) doc.setTextColor(...VERDE); doc.text(v, cols[j][0], y, { align: cols[j][2] }); });
  y += 16; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...TINTA);
  doc.text(doc.splitTextToSize("Sem os créditos de energia solar, você teria pago cerca de " + brl(tco + te) + " por essa energia em " + ano + ". Com os créditos, pagou " + brl(tco) + " e economizou " + brl(te) + ", somando o desconto e as bandeiras tarifárias que não precisou pagar.", W - 2 * M), M, y);
  const fy = 258; doc.setDrawColor(...LINHA); doc.line(M, fy, W - M, fy);
  doc.setTextColor(...CINZA); doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("CONTATO", M, fy + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...TINTA);
  const pg = [cfg.nome ? "Fornecedor dos créditos: " + cfg.nome : "", cfg.tel ? "Contato: " + cfg.tel : ""].filter(Boolean);
  (pg.length ? pg : ["Obrigado pela parceria neste ano."]).forEach((t, i) => doc.text(t, M, fy + 14 + i * 6));
  return doc;
}
async function salvarPDF(build, nome, btn, alvo) {
  const aviso = t => alvo ? msg(alvo, t) : alert(t);
  if (!window.jspdf) { aviso("O gerador de PDF não carregou. Recarregue a página."); return; }
  if (!downloads) { aviso("Este aparelho não permite salvar arquivos por aqui."); return; }
  btn.disabled = true;
  try { await downloads.save({ filename: nome, data: build().output("blob") }); }
  catch (e) { aviso("Não foi possível gerar o PDF."); }
  finally { btn.disabled = false; }
}

/* ---------- ligação com o resto do site ---------- */
function tile() {
  if (!carregado || (!clientes.length && !lancs.length)) return null;
  let ab = 0; lancs.forEach(l => { ab += Math.max(calc(l).aberto, 0); });
  const ms = mesesComLanc(), ult = ms[ms.length - 1];
  const co = ult ? lancs.filter(l => l.mes === ult).reduce((a, l) => a + calc(l).cobrar, 0) : 0;
  return { v: brl(ab), s: ult ? "a receber · " + mesLbl(ult) + " " + brl(co) : "nada lançado", c: ab > 0.004 ? "gold" : "up" };
}
window.CFEnergia = { tile, calc };
function renderTudo() { renderResumo(); renderLancs(); renderClientes(); }
let agendado = 0;
function mudou() { if (agendado) return; agendado = requestAnimationFrame(() => { agendado = 0; renderTudo(); if (window.cfRender) window.cfRender(); }); }
renderTudo();
(async () => {
  const cl = window.claude; if (!cl) return;
  try { const u = await cl.use("user"); if (u && !(await u.canEdit())) return; } catch (e) {}
  db = await cl.use("db"); downloads = await cl.use("downloads");
  if (!db) return;
  db.collection(C_CLI).onSnapshot(s => { clientes = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")); carregado |= 1; mudou(); }, () => {});
  db.collection(C_LAN).onSnapshot(s => { lancs = s.docs.map(d => ({ id: d.id, ...d.data() })); carregado |= 2; mudou(); }, () => {});
  db.doc(C_CFG + "/geral").onSnapshot(d => { cfg = d.exists ? d.data() : {}; $("ecfNome").value = cfg.nome || ""; $("ecfPix").value = cfg.pix || ""; $("ecfTel").value = cfg.tel || ""; }, () => {});
})();
})();
