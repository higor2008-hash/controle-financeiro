/* Telas e regras do Controle Financeiro (mesmo código do site no Claude). Dados via window.claude.use("db"), ligado ao Supabase em backend.js. */
(function(){
const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const N2 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const N0 = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
const NQ = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8});
const PCT = v => (v==null||!isFinite(v)) ? '—' : N2.format(v*100).replace(/,00$/,'')+'%';
const R = v => (v==null||!isFinite(v)) ? '—' : BRL.format(v);
const MESES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const $ = s => document.querySelector(s);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toISOString().slice(0,10);

/* ---------- Exemplo (só aparece com a base vazia) ---------- */
const DEMO = {
  ativos:{
    ITSA4:{cotacao:10.6,lpa:1.35,vpa:7.4,dpa:0.78,meta:20,setor:'Holding'},
    TAEE11:{classe:'acao',cotacao:34.9,lpa:3.6,vpa:20.5,dpa:3.4,meta:15,setor:'Energia'},
    BBAS3:{cotacao:24.1,lpa:5.2,vpa:30.2,dpa:2.1,meta:15,setor:'Bancos'},
    WEGE3:{cotacao:41.5,lpa:1.55,vpa:5.6,dpa:0.62,meta:5,setor:'Indústria'},
    BBSE3:{cotacao:35.2,lpa:4.1,vpa:5.2,dpa:3.3,meta:15,setor:'Seguros'},
    VALE3:{cotacao:57.8,lpa:6.4,vpa:42.0,dpa:4.1,meta:0,setor:'Mineração'},
    MXRF11:{classe:'fii',cotacao:9.62,vpa:9.9,dpa:1.14,meta:10,setor:'Papel'},
    HGLG11:{classe:'fii',cotacao:158.4,vpa:162.0,dpa:13.2,meta:10,setor:'Logística'},
    IVVB11:{classe:'etf',cotacao:352.0,meta:5,setor:'S&P 500'},
    BTC:{classe:'cripto',cotacao:381000,meta:3,setor:'Bitcoin'},
    'CDB-INTER-2028':{classe:'cdb',nome:'CDB Banco Inter 2028',cotacao:1.084,emissor:'Banco Inter',indexador:'CDI',taxa:'110% do CDI',venc:'2028-03-01',meta:15},
    'TESOURO-IPCA-2035':{classe:'tesouro',nome:'Tesouro IPCA+ 2035',cotacao:1.06,emissor:'Tesouro Nacional',indexador:'IPCA+',taxa:'IPCA + 7,1%',venc:'2035-05-15',meta:10}
  },
  ops:[
    ['ITSA4','2025-03-10',300,9.4],['ITSA4','2025-11-05',200,10.1],
    ['TAEE11','2025-04-02',60,33.2],['BBAS3','2025-06-18',120,26.8],
    ['WEGE3','2025-08-12',40,48.3],['BBSE3','2026-02-03',50,33.9],['MXRF11','2025-09-01',200,9.85],['HGLG11','2026-01-15',8,161.2],['IVVB11','2025-12-01',6,331.5],['BTC','2026-03-20',0.004,348000],['CDB-INTER-2028','2025-03-01',5000,1],['TESOURO-IPCA-2035','2025-07-10',3000,1]
  ],
  divs:[]
};
(function(){ // proventos de exemplo nos últimos 12 meses
  const d=new Date(); const pay={ITSA4:[0,3,6,9,10],TAEE11:[1,4,7,10],BBAS3:[2,5,8,11],BBSE3:[2,8],MXRF11:[0,1,2,3,4,5,6,7,8,9,10,11],HGLG11:[0,1,2,3,4,5,6,7,8,9,10,11]};
  const val={ITSA4:42,TAEE11:58,BBAS3:61,BBSE3:79,MXRF11:19,HGLG11:8.8};
  for(let k=0;k<12;k++){const dt=new Date(d.getFullYear(),d.getMonth()-k,15);const m=dt.getMonth();
    for(const t in pay) if(pay[t].includes(m)) DEMO.divs.push({ticker:t,data:dt.toISOString().slice(0,10),valor:val[t]*(1+(k%3)*0.08),tipo:t==='BBAS3'?'JCP':/11$/.test(t)&&t!=='TAEE11'?'Rendimento':'Dividendo'});}
})();
function demoState(){
  return {
    ativos:Object.entries(DEMO.ativos).map(([t,a])=>({id:t,ticker:t,...a})),
    ops:DEMO.ops.map((o,i)=>({id:'d'+i,tipo:'compra',ticker:o[0],data:o[1],qtd:o[2],preco:o[3],taxa:0})),
    divs:DEMO.divs.map((d,i)=>({id:'v'+i,...d})),
    cartoes:S.cartoes, gastos:S.gastos, contas:S.contas, receitas:S.receitas,
    config:{taxaBazin:6}
  };
}

/* ---------- Estado e armazenamento ---------- */
let S = {ativos:[],ops:[],divs:[],cartoes:[],gastos:[],contas:[],receitas:[],vendas:[],clientes:[],faturas:[],producao:[],leitemes:[],chgastos:[],animais:[],veiculos:[],licenc:[],config:{taxaBazin:6}};
let loaded = {ativos:false,ops:false,divs:false};
let db=null, mode='loading';

function isEmpty(){return !S.ops.length && !S.divs.length && !S.ativos.length;}
function view(){ const ready = mode==='local' || (mode==='db' && loaded.ativos && loaded.ops && loaded.divs); return (ready && isEmpty()) ? demoState() : S; }

/* Proteções de escrita: só coleções conhecidas, ids sem barra (não dá para apontar para outro caminho da base),
   dados limpos e limite de alterações por tempo. Quem pode ler e gravar é definido pelas regras da base (só o dono). */
const COLS=['ativos','compras','dividendos','cartoes','gastos','contas','receitas','vendas','clientes','producao','leitemes','chgastos','animais','faturas','veiculos','licenc','acesso','config'];
const ID_RE=/^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
function bad(code){const e=new Error(code);e.code=code;return e;}
function clean(v,d=0){
  if(d>4) throw bad('dado_invalido');
  if(v==null) return null;
  switch(typeof v){
    case 'string': return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,500);
    case 'number': if(!Number.isFinite(v)||Math.abs(v)>1e12) throw bad('dado_invalido'); return v;
    case 'boolean': return v;
    case 'object': {
      if(Array.isArray(v)){ if(v.length>500) throw bad('dado_invalido'); return v.map(x=>clean(x,d+1)); }
      const o={}, ks=Object.keys(v); if(ks.length>60) throw bad('dado_invalido');
      for(const k of ks){ if(!/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k)||k==='__proto__') throw bad('dado_invalido'); o[k]=clean(v[k],d+1); }
      return o; }
    default: throw bad('dado_invalido');
  }
}
const RL={cap:80,tok:80,per:2,t:Date.now()};  // até 80 alterações seguidas, depois 2 por segundo
function gate(col,id){
  if(!COLS.includes(col)) throw bad('dado_invalido');
  if(id!=null&&!ID_RE.test(String(id))) throw bad('dado_invalido');
  const n=Date.now(); RL.tok=Math.min(RL.cap,RL.tok+(n-RL.t)/1000*RL.per); RL.t=n;
  if(RL.tok<1) throw bad('limite'); RL.tok-=1;
}
const store = {
  async put(col,id,data){ gate(col,id); data=clean(data); if(db){ await db.doc(col+'/'+id).set(data); } else { local(col,id,data); } },
  async add(col,data){ gate(col,null); data=clean(data); if(db){ await db.collection(col).add(data); } else { local(col,'l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),data); } },
  async del(col,id){ gate(col,id); if(db){ await db.doc(col+'/'+id).delete(); } else { local(col,id,null); } }
};
const KEY='carteira-b3-local';
function colKey(c){return c==='compras'?'ops':c==='dividendos'?'divs':c;}
function local(col,id,data){
  if(col==='config'){S.config={...S.config,...data};}
  else{const k=colKey(col);S[k]=S[k].filter(x=>x.id!==id);if(data)S[k].push({id,...data});}
  try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}
  render();
}

async function boot(){
  render();
  let d=null;
  try{ d = window.claude ? await window.claude.use('db') : null; }catch(e){ d=null; }
  if(d){
    db=d; mode='db';
    const sub=(col,key)=>db.collection(col).onSnapshot(snap=>{
      S[key]=snap.docs.map(x=>({id:x.id,...x.data()})); loaded[key]=true;
      setSync(true,'Salvo na nuvem'); render();
    },err=>{setSync(false,'Sem conexão com a base ('+(err&&err.code||'erro')+')');});
    sub('ativos','ativos'); sub('compras','ops'); sub('dividendos','divs'); sub('cartoes','cartoes'); sub('gastos','gastos'); sub('contas','contas'); sub('receitas','receitas'); sub('vendas','vendas'); sub('clientes','clientes'); sub('producao','producao'); sub('leitemes','leitemes'); sub('chgastos','chgastos'); sub('animais','animais'); sub('faturas','faturas'); sub('veiculos','veiculos'); sub('licenc','licenc');
    db.doc('acesso/pin').onSnapshot(s=>{ pinSet(s.exists?s.data():null); },()=>{ pinSet(null); });
    db.doc('config/geral').onSnapshot(s=>{ if(s.exists) S.config={taxaBazin:6,...s.data()}; render(); },()=>{});
    setSync(false,'Carregando…');
    setTimeout(()=>{ if(mode==='db'){ render(); } },1500);
  } else {
    mode='local'; try{pinSet(JSON.parse(localStorage.getItem('carteira-pin')||'null'));}catch(e){pinSet(null);}
    try{const raw=localStorage.getItem(KEY); if(raw){const p=JSON.parse(raw); S={...S,...p}; S.cartoes=S.cartoes||[]; S.gastos=S.gastos||[]; S.contas=S.contas||[]; S.receitas=S.receitas||[]; S.vendas=S.vendas||[]; ['clientes','producao','leitemes','chgastos','animais','faturas','veiculos','licenc'].forEach(k=>S[k]=S[k]||[]);}}catch(e){}
    setSync(false,'Salvo só neste navegador');
    render();
  }
}
function setSync(ok,txt){$('#syncDot').className='dot'+(ok?' ok':'');$('#syncTxt').textContent=txt;}

/* ---------- Cálculos ---------- */
const MODS={
  acao:{l:'Ação',g:'rv',c:'acao'}, fii:{l:'FII',g:'rv',c:'fii'}, fiagro:{l:'FIAgro',g:'rv',c:'fii'}, etf:{l:'ETF',g:'rv',c:'acao'}, bdr:{l:'BDR',g:'rv',c:'acao'}, cripto:{l:'Cripto',g:'rv',c:'out'},
  cdb:{l:'CDB/RDB',g:'rf',c:'rf',rf:1}, lcilca:{l:'LCI/LCA',g:'rf',c:'rf',rf:1}, tesouro:{l:'Tesouro Direto',g:'rf',c:'rf',rf:1}, cricra:{l:'CRI/CRA',g:'rf',c:'rf',rf:1},
  debenture:{l:'Debênture',g:'rf',c:'rf',rf:1}, poupanca:{l:'Poupança',g:'rf',c:'rf'}, fundo:{l:'Fundo de investimento',g:'out',c:'out'}, prev:{l:'Previdência',g:'out',c:'out'}, outro:{l:'Outro',g:'out',c:'out'}
};
const GRP={rv:'Renda variável',rf:'Renda fixa',out:'Fundos e outros'};
const isCot=m=>MODS[m]&&MODS[m].g==='rv';
const CRIPTO=['BTC','ETH','SOL','USDT','USDC','BNB','XRP','ADA','DOGE','LTC','DOT','AVAX','LINK','MATIC','TRX'];
const ETFS=['BOVA11','IVVB11','SMAL11','HASH11','XINA11','DIVO11','NASD11','GOLD11','BOVV11','QBTC11','ETHE11','SPXI11','ACWI11','EURP11','BOVB11','FIND11','MATB11','ECOO11','PIBB11','B5P211','IMAB11','FIXA11','IRFM11','LFTS11'];
function inferCls(t){ if(CRIPTO.includes(t)) return 'cripto'; if(ETFS.includes(t)) return 'etf'; if(/3[2-5]$/.test(t)&&t.length>=6) return 'bdr'; if(/11$/.test(t)) return 'fii'; return 'acao'; }
function clsOf(V,t){const a=V.ativos.find(x=>x.ticker===t);return (a&&a.classe&&MODS[a.classe]&&a.classe)||inferCls(t);}
function nomeOf(V,t){const a=V.ativos.find(x=>x.ticker===t);return (a&&a.nome)||t;}
function clsPill(c){const m=MODS[c]||MODS.outro;return `<span class="pill ${m.c}">${m.l}</span>`;}
function modOptions(sel,withAuto){
  const g={rv:[],rf:[],out:[]}; for(const k in MODS) g[MODS[k].g].push(`<option value="${k}">${MODS[k].l}</option>`);
  sel.innerHTML=(withAuto?'<option value="">Automático pelo ticker</option>':'')+Object.keys(g).map(k=>`<optgroup label="${GRP[k]}">${g[k].join('')}</optgroup>`).join('');
}
function slug(s){return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);}
function posicoes(V){
  const ops=[...V.ops].sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  const p={}; const am0=Object.fromEntries(V.ativos.map(a=>[a.ticker,a]));
  for(const o of ops){
    const t=o.ticker; p[t]=p[t]||{ticker:t,qtd:0,custo:0,realizado:0,pend:false};
    const q=+o.qtd||0, tx=+o.taxa||0;
    let pr=o.preco==null?(am0[t]&&+am0[t].pmInicial||null):+o.preco;
    if(pr==null){ if(o.tipo!=='venda') p[t].pend=true; pr=0; }
    if(o.tipo==='venda'){
      const pm=p[t].qtd?p[t].custo/p[t].qtd:0; const qv=Math.min(q,p[t].qtd);
      p[t].realizado += qv*pr - tx - qv*pm; p[t].custo -= qv*pm; p[t].qtd -= qv;
    } else { p[t].qtd+=q; p[t].custo+=q*pr+tx; }
  }
  const am=Object.fromEntries(V.ativos.map(a=>[a.ticker,a]));
  const list=Object.values(p).filter(x=>x.qtd>1e-9).map(x=>{
    const a=am[x.ticker]||{}; const pm=x.pend?null:x.custo/x.qtd; const cot=+a.cotacao||null;
    if(x.pend) x.custo=0;
    const valor=cot?cot*x.qtd:x.custo;
    const prov=V.divs.filter(d=>d.ticker===x.ticker).reduce((s,d)=>s+(+d.valor||0),0);
    const res=cot&&!x.pend?valor-x.custo:null;
    return {...x,a,nome:a.nome||x.ticker,classe:(a.classe&&MODS[a.classe])?a.classe:inferCls(x.ticker),pm,cot,valor,semCot:!cot,res,resPct:cot?valor/x.custo-1:null,gAcao:cot?cot-pm:null,prov,
      tot:(res??0)+prov,totPct:x.custo?((res??0)+prov)/x.custo:null};
  });
  const total=list.reduce((s,x)=>s+x.valor,0);
  list.forEach(x=>x.peso=total?x.valor/total:0);
  list.sort((a,b)=>b.valor-a.valor);
  return {list,total,custo:list.reduce((s,x)=>s+x.custo,0),realizado:Object.values(p).reduce((s,x)=>s+x.realizado,0)};
}
function divs12(V){const lim=new Date();lim.setFullYear(lim.getFullYear()-1);const l=lim.toISOString().slice(0,10);return V.divs.filter(d=>(d.data||'')>l);}
function ranking(V,P){
  const taxa=(+V.config.taxaBazin||6)/100;
  const pos=Object.fromEntries(P.list.map(x=>[x.ticker,x]));
  const RANK=['acao','fii','fiagro','bdr','etf'];
  const tks=new Set([...V.ativos.map(a=>a.ticker),...P.list.map(x=>x.ticker)].filter(t=>RANK.includes(clsOf(V,t))));
  const am=Object.fromEntries(V.ativos.map(a=>[a.ticker,a]));
  return [...tks].map(t=>{
    const a=am[t]||{}; const cot=+a.cotacao||null, lpa=a.lpa===''||a.lpa==null?null:+a.lpa, vpa=a.vpa===''||a.vpa==null?null:+a.vpa, dpa=a.dpa===''||a.dpa==null?null:+a.dpa;
    const classe=clsOf(V,t); const fii=classe==='fii'||classe==='fiagro';
    const bazin=dpa!=null&&dpa>0?dpa/taxa:null;
    const graham=(classe==='acao'||classe==='bdr')&&lpa>0&&vpa>0?Math.sqrt(22.5*lpa*vpa):null;
    const dy=cot&&dpa!=null?dpa/cot:null, pl=!fii&&cot&&lpa?cot/lpa:null, pvp=cot&&vpa>0?cot/vpa:null;
    const mB=bazin&&cot?bazin/cot-1:null, mG=graham&&cot?graham/cot-1:null;
    const peso=pos[t]?pos[t].peso:0, meta=a.meta!=null&&a.meta!==''?+a.meta/100:null;
    let score=null;
    if(cot){
      score=0;
      if(mB!=null) score+=Math.max(0,Math.min(35,(mB+0.1)/0.4*35));
      if(mG!=null) score+=Math.max(0,Math.min(25,(mG+0.1)/0.5*25));
      if(fii&&pvp!=null) score+=Math.max(0,Math.min(25,(1.15-pvp)/0.25*25));
      if(dy!=null) score+=Math.max(0,Math.min(20,dy/0.10*20));
      if(meta) score+=Math.max(0,Math.min(20,(meta-peso)/meta*20));
      if(!fii&&lpa!=null&&lpa<0) score-=20;
      score=Math.max(0,Math.min(100,Math.round(score)));
    }
    return {ticker:t,classe,setor:a.setor||'',cot,lpa,vpa,dpa,dy,pl,pvp,bazin,graham,mB,mG,peso,meta,score,tem:!!pos[t]};
  }).sort((a,b)=>(b.score??-1)-(a.score??-1));
}
function pill(s){ if(s==null) return '<span class="pill na">Sem cotação</span>'; if(s>60) return `<span class="pill good">Atrativo · ${s}</span>`; if(s>=35) return `<span class="pill mid">Neutro · ${s}</span>`; return `<span class="pill bad">Caro · ${s}</span>`; }
function cls(v){return v==null?'':v>=0?'up':'down';}

/* ---------- Render ---------- */
let histMode='ops', posCls='todos', posBanco='todos';
function render(){
  const V=view(); const demo=V!==S;
  $('#demoBanner').hidden=!demo;
  const P=posicoes(V); const d12=divs12(V); const tot12=d12.reduce((s,d)=>s+(+d.valor||0),0);
  const res=P.total-P.custo;
  const resK=P.list.reduce((s,x)=>s+(x.res||0),0);
  const totRet=P.list.reduce((s,x)=>s+x.tot,0);
  const anoAtual=String(new Date().getFullYear());
  const divAno=V.divs.filter(d=>(d.data||'').startsWith(anoAtual)).reduce((s,d)=>s+(+d.valor||0),0);
  $('#kpis').innerHTML=`
    <div class="kpi"><div class="l">Patrimônio</div><div class="v">${R(P.total)}</div><div class="s">${P.list.length} investimento${P.list.length===1?'':'s'} em ${new Set(P.list.map(x=>x.classe)).size} modalidade${new Set(P.list.map(x=>x.classe)).size===1?'':'s'}</div></div>
    <div class="kpi"><div class="l">Investido</div><div class="v">${R(P.custo)}</div><div class="s ${cls(resK)}">${P.list.some(x=>x.pend)?P.list.filter(x=>x.pend).length+' sem preço médio':(resK>=0?'+':'')+R(resK)+' ('+PCT(P.custo?resK/P.custo:null)+')'}</div></div>
    <div class="kpi"><div class="l">Proventos 12 meses</div><div class="v gold">${R(tot12)}</div><div class="s">≈ ${R(tot12/12)} por mês</div></div>
    <div class="kpi"><div class="l">Retorno total</div><div class="v ${cls(totRet)}">${totRet>=0?'+':''}${R(totRet)}</div><div class="s">Valorização + proventos · ${PCT(P.custo?totRet/P.custo:null)}</div></div>`;

  // Gráfico mensal
  const now=new Date(); const meses=[];
  for(let k=11;k>=0;k--){const dt=new Date(now.getFullYear(),now.getMonth()-k,1);meses.push({k:dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'),m:MESES[dt.getMonth()],v:0});}
  const mm=Object.fromEntries(meses.map(x=>[x.k,x]));
  V.divs.forEach(d=>{const k=(d.data||'').slice(0,7); if(mm[k]) mm[k].v+=(+d.valor||0);});
  const max=Math.max(...meses.map(x=>x.v),0);
  if(!max){ $('#chartMes').innerHTML='<p class="empty">Nenhum provento nos últimos 12 meses. Lance um em Lançamentos.</p>'; }
  else{
    const step=niceStep(max/4), top=Math.ceil(max/step)*step, W=560,H=210,L=52,B=24,T=16, bw=(W-L)/12;
    let g=''; for(let v=0;v<=top+1e-9;v+=step){const y=T+(H-T-B)*(1-v/top); g+=`<line class="grid" x1="${L}" x2="${W}" y1="${y}" y2="${y}"/><text x="${L-6}" y="${y+3}" text-anchor="end">${N0.format(v)}</text>`;}
    meses.forEach((x,i)=>{const h=(H-T-B)*(x.v/top), X=L+i*bw+bw*0.18, Y=H-B-h;
      g+=`<rect class="b${i===11?' cur':''}" x="${X}" y="${Y}" width="${bw*0.64}" height="${h}" rx="2"><title>${x.m}: ${R(x.v)}</title></rect><text x="${L+i*bw+bw/2}" y="${H-8}" text-anchor="middle" class="lbl">${x.m}</text>`;});
    $('#chartMes').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Proventos por mês">${g}</svg>`;
  }

  // Por modalidade
  const porMod={}; P.list.forEach(x=>{porMod[x.classe]=(porMod[x.classe]||0)+x.valor;});
  const mods=Object.entries(porMod).sort((a,b)=>b[1]-a[1]);
  const gsum={rv:0,rf:0,out:0}; mods.forEach(([k,v])=>gsum[MODS[k].g]+=v);
  const kfmt=v=>v>=1e6?'R$ '+N2.format(v/1e6)+' mi':v>=1e4?'R$ '+N0.format(v/1e3)+' mil':R(v);
  $('#modBars').innerHTML=mods.length?donut(mods.map(([k,v])=>({l:MODS[k].l,v})),kfmt(P.total),'patrimônio')+mods.map(([k,v],i)=>`<div class="bar" style="grid-template-columns:minmax(0,110px) minmax(0,1fr) auto"><span>${MODS[k].l}</span><div class="track"><div class="fill" style="background:${PAL[i%PAL.length]};width:${(v/P.total*100).toFixed(1)}%"></div></div><span class="num" style="text-align:right;white-space:nowrap">${R(v)} <span class="sub2">${PCT(v/P.total)}</span></span></div>`).join('')
    +`<p class="hint">${Object.entries(gsum).filter(x=>x[1]).map(([g,v])=>GRP[g]+' '+PCT(v/P.total)).join(' · ')}</p>`
    :'<p class="empty">Sem investimentos ainda.</p>';
  // Peso
  const am=Object.fromEntries(V.ativos.map(a=>[a.ticker,a]));
  $('#pesoBars').innerHTML=P.list.length?P.list.map(x=>{const meta=am[x.ticker]&&am[x.ticker].meta?+am[x.ticker].meta:null;
    return `<div class="bar" style="grid-template-columns:minmax(72px,150px) minmax(0,1fr) 64px"><span class="tk" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x.nome)}">${esc(x.nome)}</span><div class="track"><div class="fill ${MODS[x.classe].c==='acao'?'':MODS[x.classe].c}" style="width:${(x.peso*100).toFixed(1)}%"></div>${meta?`<div class="meta" style="left:${Math.min(99.5,meta)}%" title="Meta ${meta}%"></div>`:''}</div><span class="num" style="text-align:right">${PCT(x.peso)}</span></div>`;}).join('')
    :'<p class="empty">Sem posições ainda.</p>';

  // Ranking
  const RK=ranking(V,P);
  const top=RK.filter(r=>r.score!=null).slice(0,3);
  $('#topRank').innerHTML=top.length?`<div class="sugg">${top.map(r=>`<div class="row"><span><span class="tk">${esc(r.ticker)}</span> ${pill(r.score)}</span><span class="num">${R(r.cot)} · DY ${PCT(r.dy)} · teto Bazin ${R(r.bazin)}</span></div>`).join('')}</div><p class="hint">Isto não é recomendação de investimento.</p>`
    :'<p class="empty">Cadastre a cotação e os indicadores dos ativos na aba Onde aportar para ver o ranking.</p>';

  $('#tblRank').innerHTML=`<thead><tr><th>Ativo</th><th>Situação</th><th class="n">Cotação</th><th class="n">DY</th><th class="n">P/L</th><th class="n">P/VP</th><th class="n">Teto Bazin</th><th class="n">Graham</th><th class="n">Peso / meta</th></tr></thead><tbody>${
    RK.length?RK.map(r=>`<tr><td><button class="linkbtn tk" data-edit="${esc(r.ticker)}">${esc(r.ticker)}</button>${r.classe!=='acao'?' '+clsPill(r.classe):''}${r.tem?'':' <span class="pill na">observando</span>'}</td><td>${pill(r.score)}</td>
      <td class="n">${R(r.cot)}</td><td class="n">${PCT(r.dy)}</td><td class="n ${r.pl!=null&&r.pl<0?'down':''}">${r.pl==null?'—':N2.format(r.pl)}</td><td class="n">${r.pvp==null?'—':N2.format(r.pvp)}</td>
      <td class="n">${R(r.bazin)}${r.mB!=null?` <span class="${cls(r.mB)}">(${r.mB>=0?'+':''}${PCT(r.mB)})</span>`:''}</td>
      <td class="n">${R(r.graham)}${r.mG!=null?` <span class="${cls(r.mG)}">(${r.mG>=0?'+':''}${PCT(r.mG)})</span>`:''}</td>
      <td class="n">${PCT(r.peso)} / ${r.meta==null?'—':PCT(r.meta)}</td></tr>`).join(''):'<tr><td colspan="9" class="empty">Nenhum ativo. Cadastre ao lado.</td></tr>'}</tbody>`;
  const tx=$('#taxaBazin'); if(document.activeElement!==tx) tx.value=V.config.taxaBazin||6;

  // Posições
  const divTk={}; d12.forEach(d=>divTk[d.ticker]=(divTk[d.ticker]||0)+(+d.valor||0));
  const nPm=P.list.filter(x=>x.pend).length, nCot=P.list.filter(x=>x.semCot&&isCot(x.classe)).length;
  $('#pendBanner').hidden=!(nPm||nCot);
  $('#pendBanner').innerHTML=`<span><strong>Faltam dados.</strong> ${[nPm?nPm+' ativo'+(nPm>1?'s':'')+' sem preço médio':'',nCot?nCot+' sem cotação':''].filter(Boolean).join(' e ')}. Sem isso o patrimônio e a valorização ficam incompletos. Clique em "informar" na tabela abaixo. O preço médio aparece no app do seu banco, na tela da carteira de investimentos.</span>`;
  const presentes=[...new Set(P.list.map(x=>x.classe))];
  if(posCls!=='todos'&&!presentes.includes(posCls)) posCls='todos';
  $('#clsSeg').innerHTML=['todos',...presentes].map(k=>`<button aria-pressed="${k===posCls}" data-c="${esc(k)}">${k==='todos'?'Todos':esc((MODS[k]||MODS.outro).l)}</button>`).join('');
  const bancoOf=x=>(x.a&&x.a.corretora)||'Sem banco';
  const bancos=[...new Set(P.list.map(bancoOf))].sort((a,b)=>a==='Sem banco'?1:b==='Sem banco'?-1:a.localeCompare(b));
  if(posBanco!=='todos'&&!bancos.includes(posBanco)) posBanco='todos';
  $('#bancoSeg').hidden=bancos.length<2;
  $('#bancoSeg').innerHTML=['todos',...bancos].map(k=>{const v=k==='todos'?P.list:P.list.filter(x=>bancoOf(x)===k); return `<button aria-pressed="${k===posBanco}" data-banco="${esc(k)}">${k==='todos'?'Todos os bancos':esc(k)} <span class="sub2">${R(v.reduce((s,x)=>s+(+x.valor||0),0))}</span></button>`;}).join('');
  const PB=posBanco==='todos'?P.list:P.list.filter(x=>bancoOf(x)===posBanco);
  const PF=posCls==='todos'?PB:PB.filter(x=>x.classe===posCls);
  const PL=PF.filter(x=>isCot(x.classe)), PV=PF.filter(x=>!isCot(x.classe));
  $('#cardRV').hidden=!PL.length&&PV.length>0; $('#cardRF').hidden=!PV.length;
  const sgn=v=>v==null?'—':(v>=0?'+':'')+R(v);
  $('#tblRF').innerHTML=`<thead><tr><th>Investimento</th><th>Emissor</th><th>Rentabilidade</th><th>Vencimento</th><th class="n">Aplicado</th><th class="n">Saldo hoje</th><th class="n">Rendimento</th><th class="n">Juros recebidos</th><th class="n">Peso</th><th></th></tr></thead><tbody>${
    PV.map(x=>`<tr><td><span class="tk">${esc(x.nome)}</span> ${clsPill(x.classe)}</td><td>${esc(x.a.emissor||'—')}</td><td>${esc([x.a.indexador,x.a.taxa].filter(Boolean).join(' · ')||'—')}</td><td class="num">${fmtD(x.a.venc)}</td>
      <td class="n">${R(x.custo)}</td><td class="n">${R(x.valor)}</td><td class="n ${cls(x.res)}">${sgn(x.res)} (${PCT(x.resPct)})</td><td class="n gold">${R(x.prov)}</td><td class="n">${PCT(x.peso)}</td>
      <td><button class="linkbtn" data-edit="${esc(x.ticker)}">atualizar</button></td></tr>`).join('')}</tbody>${PV.length>1?`<tfoot><tr><td>Total</td><td></td><td></td><td></td><td class="n">${R(PV.reduce((s,x)=>s+x.custo,0))}</td><td class="n">${R(PV.reduce((s,x)=>s+x.valor,0))}</td><td class="n">${sgn(PV.reduce((s,x)=>s+x.res,0))}</td><td class="n gold">${R(PV.reduce((s,x)=>s+x.prov,0))}</td><td class="n">${PCT(PV.reduce((s,x)=>s+x.peso,0))}</td><td></td></tr></tfoot>`:''}`;
  const sm=k=>PL.reduce((a,x)=>a+(x[k]||0),0);
  const fRes=sm('res'), fProv=sm('prov'), fTot=sm('tot'), fCusto=sm('custo'), fVal=sm('valor');
  const sg=v=>v==null?'—':(v>=0?'+':'')+R(v);
  $('#tblPos').innerHTML=`<thead><tr><th>Ativo</th><th>Banco</th><th class="n">Qtd</th><th class="n">Preço pago (médio)</th><th class="n">Cotação hoje</th><th class="n">Ganho por cota</th><th class="n">Investido</th><th class="n">Valor hoje</th><th class="n">Valorização</th><th class="n">Proventos recebidos</th><th class="n">Retorno total</th><th class="n">Peso</th></tr></thead><tbody>${
    PL.length?PL.map(x=>`<tr><td><span class="tk">${esc(x.ticker)}</span> ${clsPill(x.classe)}</td><td>${esc((x.a&&x.a.corretora)||'—')}</td><td class="n">${NQ.format(x.qtd)}</td><td class="n">${x.pend?'<button class="linkbtn" data-edit="'+esc(x.ticker)+'">informar</button>':R(x.pm)}</td>
      <td class="n">${x.semCot?'<button class="linkbtn" data-edit="'+esc(x.ticker)+'">informar</button>':R(x.cot)}</td>
      <td class="n ${cls(x.gAcao)}">${sg(x.gAcao)}</td><td class="n">${R(x.custo)}</td><td class="n">${R(x.valor)}</td>
      <td class="n ${cls(x.res)}">${x.res==null?'—':sg(x.res)+' ('+PCT(x.resPct)+')'}</td><td class="n gold">${R(x.prov)}</td>
      <td class="n ${cls(x.tot)}"><b>${sg(x.tot)}</b>${x.totPct==null?'':' ('+PCT(x.totPct)+')'}</td><td class="n">${PCT(x.peso)}</td></tr>`).join('')
      :'<tr><td colspan="12" class="empty">Nenhuma posição em renda variável.</td></tr>'}</tbody>${PL.length>1?`<tfoot><tr><td>Total</td><td></td><td></td><td></td><td></td><td></td><td class="n">${R(fCusto)}</td><td class="n">${R(fVal)}</td><td class="n ${cls(fRes)}">${sg(fRes)}</td><td class="n gold">${R(fProv)}</td><td class="n ${cls(fTot)}">${sg(fTot)} (${PCT(fCusto?fTot/fCusto:null)})</td><td class="n">${PCT(P.total?fVal/P.total:null)}</td></tr></tfoot>`:''}`;

  // Dividendos por mês/ano
  const anos=[...new Set(V.divs.map(d=>(d.data||'').slice(0,4)).filter(Boolean))].sort().reverse();
  if(!anos.includes(anoAtual)) anos.unshift(anoAtual);
  const sel=$('#anoSel'); const cur=sel.value||anoAtual;
  sel.innerHTML=anos.map(a=>`<option ${a===cur?'selected':''}>${esc(a)}</option>`).join('');
  const ano=sel.value; const porMes=Array(12).fill(0).map(()=>({div:0,jcp:0,rf:0}));
  V.divs.filter(d=>(d.data||'').startsWith(ano)).forEach(d=>{const m=+d.data.slice(5,7)-1; const c=clsOf(V,d.ticker); if(c==='fii'||c==='fiagro') porMes[m].jcp+=+d.valor||0; else if(isCot(c)) porMes[m].div+=+d.valor||0; else porMes[m].rf+=+d.valor||0;});
  const tAno=porMes.reduce((s,x)=>s+x.div+x.jcp+x.rf,0);
  $('#tblMes').innerHTML=`<thead><tr><th>Mês</th><th class="n">Ações e ETFs</th><th class="n">FIIs</th><th class="n">Renda fixa</th><th class="n">Total</th></tr></thead><tbody>${porMes.map((x,i)=>`<tr><td>${MESES[i]}</td><td class="n">${x.div?R(x.div):'—'}</td><td class="n">${x.jcp?R(x.jcp):'—'}</td><td class="n">${x.rf?R(x.rf):'—'}</td><td class="n">${x.div+x.jcp+x.rf?R(x.div+x.jcp+x.rf):'—'}</td></tr>`).join('')}</tbody><tfoot><tr><td>${ano}</td><td class="n">${R(porMes.reduce((s,x)=>s+x.div,0))}</td><td class="n">${R(porMes.reduce((s,x)=>s+x.jcp,0))}</td><td class="n">${R(porMes.reduce((s,x)=>s+x.rf,0))}</td><td class="n gold">${R(tAno)}</td></tr></tfoot>`;
  const porAtivo={}; V.divs.forEach(d=>{porAtivo[d.ticker]=porAtivo[d.ticker]||{tot:0,a12:0}; porAtivo[d.ticker].tot+=+d.valor||0;});
  d12.forEach(d=>porAtivo[d.ticker].a12+=+d.valor||0);
  const custoTk=Object.fromEntries(P.list.map(x=>[x.ticker,x.custo]));
  const pa=Object.entries(porAtivo).sort((a,b)=>b[1].a12-a[1].a12);
  $('#tblDivAtivo').innerHTML=`<thead><tr><th>Ativo</th><th class="n">12 meses</th><th class="n">Total</th><th class="n">Yield on cost</th></tr></thead><tbody>${pa.length?pa.map(([t,x])=>`<tr><td><span class="tk">${esc(nomeOf(V,t))}</span> ${clsPill(clsOf(V,t))}</td><td class="n gold">${R(x.a12)}</td><td class="n">${R(x.tot)}</td><td class="n">${custoTk[t]?PCT(x.a12/custoTk[t]):'—'}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Nenhum provento lançado.</td></tr>'}</tbody>`;

  $('#ativosList').innerHTML=S.ativos.map(a=>`<option value="${esc(a.ticker)}">${esc((a.nome||a.ticker)+' · '+(MODS[a.classe]||MODS.outro).l)}</option>`).join('');
  renderHist(V,demo);
  renderCartoes(); renderContas(); renderVenc(parcelas()); renderVendas(); renderVeic();
}

const PAL=['#4fd08a','#f7b538','#ff5c74','#7c5cff','#5aa9ff','#2dd4bf','#f472b6','#a3e635','#fb923c','#94a3b8'];
function donut(items,centro,centroSub){
  const tot=items.reduce((s,x)=>s+Math.max(0,x.v),0); if(!(tot>0)) return '';
  const r=48,c=2*Math.PI*r; let off=0;
  const segs=items.filter(x=>x.v>0).map((x,i)=>{const f=x.v/tot, len=f*c; const el=`<circle r="${r}" cx="60" cy="60" fill="none" stroke="${x.c||PAL[i%PAL.length]}" stroke-width="18" stroke-dasharray="${Math.max(0,len-1.2).toFixed(2)} ${(c-len+1.2).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"><title>${esc(x.l)}: ${R(x.v)}</title></circle>`; off+=len; return el;}).join('');
  const leg=items.filter(x=>x.v>0).map((x,i)=>`<span><i style="background:${x.c||PAL[i%PAL.length]};color:${x.c||PAL[i%PAL.length]}"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.l)}</span><b>${PCT(x.v/tot)}</b></span>`).join('');
  return `<div class="donutwrap"><svg class="donut" viewBox="0 0 120 120" role="img" aria-label="${esc(centroSub||'Distribuição')}"><circle r="${r}" cx="60" cy="60" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="18"/>${segs}<text x="60" y="60" text-anchor="middle" font-size="12">${esc(centro||'')}</text><text class="dl" x="60" y="74" text-anchor="middle">${esc(centroSub||'')}</text></svg><div class="legend">${leg}</div></div>`;
}
function niceStep(x){const p=Math.pow(10,Math.floor(Math.log10(x||1)));const f=x/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p;}
function renderHist(V,demo){
  const del=(col,id)=>demo?'':`<span class="acts"><button class="btn ghost small" data-ed="${col}" data-id="${esc(id)}">Editar</button><button class="btn danger small" data-del="${col}" data-id="${esc(id)}">Excluir</button></span>`;
  if(histMode==='ops'){
    const rows=[...V.ops].sort((a,b)=>(b.data||'').localeCompare(a.data||''));
    $('#tblHist').innerHTML=`<thead><tr><th>Data</th><th>Tipo</th><th>Ativo</th><th class="n">Qtd</th><th class="n">Preço</th><th class="n">Total</th><th></th></tr></thead><tbody>${rows.length?rows.map(o=>`<tr><td class="num">${fmtD(o.data)}</td><td>${isCot(clsOf(V,o.ticker))?(o.tipo==='venda'?'<span class="pill bad">Venda</span>':'<span class="pill good">Compra</span>'):(o.tipo==='venda'?'<span class="pill bad">Resgate</span>':'<span class="pill good">Aplicação</span>')}</td><td><span class="tk">${esc(nomeOf(V,o.ticker))}</span> ${clsPill(clsOf(V,o.ticker))}</td><td class="n">${isCot(clsOf(V,o.ticker))?NQ.format(o.qtd):'—'}</td><td class="n">${isCot(clsOf(V,o.ticker))?R(+o.preco):'—'}</td><td class="n">${R(o.qtd*o.preco+(+o.taxa||0)*(o.tipo==='venda'?-1:1))}</td><td>${del('compras',o.id)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nada lançado.</td></tr>'}</tbody>`;
  } else {
    const rows=[...V.divs].sort((a,b)=>(b.data||'').localeCompare(a.data||''));
    $('#tblHist').innerHTML=`<thead><tr><th>Data</th><th>Tipo</th><th>Ativo</th><th class="n">Valor</th><th></th></tr></thead><tbody>${rows.length?rows.map(d=>`<tr><td class="num">${fmtD(d.data)}</td><td>${esc(d.tipo||'Dividendo')}</td><td class="tk">${esc(nomeOf(V,d.ticker))}</td><td class="n gold">${R(+d.valor)}</td><td>${del('dividendos',d.id)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">Nada lançado.</td></tr>'}</tbody>`;
  }
}
function fmtD(s){return s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';}

/* ---------- Simulador ---------- */
$('#fSim').addEventListener('submit',e=>{
  e.preventDefault(); const V=view(); const P=posicoes(V); const RK=ranking(V,P).filter(r=>r.score!=null&&r.score>=35&&r.cot);
  let valor=+$('#simValor').value||0; const out=$('#simOut');
  if(!valor){out.innerHTML='<p class="msg err">Digite quanto quer investir.</p>';return;}
  if(!RK.length){out.innerHTML='<p class="empty">Nenhum ativo com pontuação 35 ou mais. Revise cotações e indicadores.</p>';return;}
  const totalPos=P.total+valor; const posMap=Object.fromEntries(P.list.map(x=>[x.ticker,x.valor]));
  let alvo=RK.map(r=>({r,gap:r.meta?Math.max(0,r.meta*totalPos-(posMap[r.ticker]||0)):0}));
  const comMeta=alvo.some(a=>a.gap>0);
  if(comMeta) alvo=alvo.filter(a=>a.gap>0); else { alvo=alvo.slice(0,3); const s=alvo.reduce((t,a)=>t+a.r.score,0); alvo.forEach(a=>a.gap=valor*a.r.score/s); }
  const sumGap=alvo.reduce((t,a)=>t+a.gap,0); const res=[]; let sobra=valor;
  for(const a of alvo){ const quer=(comMeta&&sumGap>valor)?valor*a.gap/sumGap:a.gap; const q=Math.floor(Math.min(quer,sobra)/a.r.cot); if(q>0){res.push({t:a.r.ticker,q,cot:a.r.cot,s:a.r.score});sobra-=q*a.r.cot;} }
  for(const a of alvo){ if(sobra>=a.r.cot){const q=Math.floor(sobra/a.r.cot); const ex=res.find(x=>x.t===a.r.ticker); if(ex)ex.q+=q; else res.push({t:a.r.ticker,q,cot:a.r.cot,s:a.r.score}); sobra-=q*a.r.cot;} }
  out.innerHTML=res.length?res.map(x=>`<div class="row"><span><span class="tk">${esc(x.t)}</span> ${pill(x.s)}</span><span class="num">${NQ.format(x.q)} × ${R(x.cot)} = <b>${R(x.q*x.cot)}</b></span></div>`).join('')+`<p class="hint">Sobra: ${R(sobra)}. ${comMeta?'Priorizou quem está abaixo da meta de peso.':'Sem metas cadastradas, dividiu entre os 3 melhores pela pontuação.'} Simulação, não é recomendação.</p>`
    :'<p class="empty">O valor não compra nem 1 ação dos melhores colocados.</p>';
});

/* ---------- Formulários ---------- */
const up=s=>(s||'').trim().toUpperCase().replace(/\s+/g,'');
const numOrNull=v=>v===''||v==null?null:+v;
function flash(el,txt,ok){el.textContent=txt;el.className='msg '+(ok?'ok':'err');if(ok)setTimeout(()=>{if(el.textContent===txt)el.textContent='';},3500);}
function errTxt(e){return e&&e.code==='limite'?'Muitas alterações seguidas. Espere alguns segundos e tente de novo.':e&&e.code==='dado_invalido'?'Algum campo tem um valor que não é aceito. Revise e tente de novo.':e&&(e.code==='permission_denied'||e.code==='unauthenticated')?'Você não tem permissão para salvar aqui.':e&&e.code==='invalid_argument'?'Você não tem permissão para salvar aqui.':e&&e.code==='quota_exceeded'?'A base está cheia. Exclua lançamentos antigos.':'Não salvou. Tente de novo.';}

function showOnly(form,mod){
  const m=MODS[mod]||MODS.acao; const tags=new Set();
  if(isCot(mod)) tags.add('cot'); else tags.add('val');
  if(m.rf) tags.add('rf');
  if(mod==='acao'||mod==='bdr') tags.add('fund');
  if(mod==='fii'||mod==='fiagro') tags.add('fiivpa');
  form.querySelectorAll('[data-only]').forEach(el=>{el.hidden=!el.dataset.only.split(' ').some(t=>tags.has(t));});
}
function syncOpForm(){
  const mod=$('#oMod').value, cot=isCot(mod); showOnly($('#fOp'),mod);
  const tp=$('#oTipo'); const v=tp.value;
  tp.innerHTML=cot?'<option value="compra">Compra</option><option value="venda">Venda</option>':'<option value="compra">Aplicação</option><option value="venda">Resgate</option>'; tp.value=v;
  $('#oTkLbl').textContent=cot?'Ticker':'Nome do investimento';
  $('#oTk').placeholder=cot?({cripto:'BTC',etf:'BOVA11',bdr:'AAPL34',fii:'MXRF11'}[mod]||'PETR4'):({cdb:'CDB Nubank 2027',lcilca:'LCI Itaú 2026',tesouro:'Tesouro Selic 2029',cricra:'CRA Raízen 2030',debenture:'Debênture Vale 2031',poupanca:'Poupança Caixa',fundo:'Fundo XP Macro',prev:'PGBL Bradesco'}[mod]||'Nome');
  $('#oHint').textContent=cot?'':'Para aplicar de novo no mesmo investimento, use o mesmo nome. O saldo de hoje você atualiza em Carteira.';
}
$('#oMod').addEventListener('change',syncOpForm); $('#oTipo').addEventListener('change',()=>{});
$('#oTk').addEventListener('change',()=>{const t=$('#oTk').value.trim(); const a=S.ativos.find(x=>x.ticker===up(t)||x.ticker===slug(t)||x.nome===t); if(a&&a.classe&&MODS[a.classe]){$('#oMod').value=a.classe;syncOpForm();} else if(isCot($('#oMod').value)&&/^[A-Za-z0-9]{3,7}$/.test(t)){$('#oMod').value=inferCls(up(t));syncOpForm();}});

$('#fOp').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mOp'); const mod=$('#oMod').value; const cot=isCot(mod); const tipo=$('#oTipo').value;
  const raw=$('#oTk').value.trim(); const data=$('#oData').value||today();
  let t, q, p, taxa=0, nome=null;
  const exist=S.ativos.find(x=>x.ticker===up(raw)||x.ticker===slug(raw)||(x.nome&&x.nome===raw));
  if(cot){
    t=up(raw); q=+$('#oQtd').value; p=+$('#oPreco').value; taxa=+$('#oTaxa').value||0;
    if(!/^[A-Z0-9.\-]{2,12}$/.test(t)){flash(m,'Ticker inválido. Use o código, como PETR4, BOVA11 ou BTC.');return;}
    if(!(q>0)||!(p>0)){flash(m,'Informe quantidade e preço maiores que zero.');return;}
  } else {
    t=exist?exist.ticker:slug(raw); nome=exist?(exist.nome||raw):raw; const v=+$('#oValor').value;
    if(!t){flash(m,'Dê um nome ao investimento, como CDB Nubank 2027.');return;}
    if(!(v>0)){flash(m,'Informe o valor.');return;}
    const unit=(exist&&+exist.cotacao)||1; q=v/unit; p=unit;
  }
  if(tipo==='venda'){const pos=posicoes(S).list.find(x=>x.ticker===t); const tem=pos?pos.qtd:0;
    if(tem+1e-9<q){flash(m,cot?`Você tem ${NQ.format(tem)} ${t}. Não dá para vender ${NQ.format(q)}.`:`O saldo de ${nome} é ${R(pos?pos.valor:0)}. Não dá para resgatar mais que isso.`);return;} if(q>tem) q=tem;}
  try{
    await store.add('compras',{tipo,ticker:t,data,qtd:q,preco:p,taxa});
    if(!exist){
      const base={ticker:t,classe:mod,cotacao:p,meta:null,setor:'',atualizadoEm:today()};
      if(cot) Object.assign(base,{lpa:null,vpa:null,dpa:null}); else Object.assign(base,{nome,emissor:$('#oEmi').value.trim(),indexador:$('#oIdx').value,taxa:$('#oTxt').value.trim(),venc:$('#oVenc').value||''});
      await store.put('ativos',t,base);
    }
    const nm=cot?t:nome;
    flash(m,cot?`${tipo==='venda'?'Venda':'Compra'} de ${NQ.format(q)} ${nm} lançada.`:`${tipo==='venda'?'Resgate':'Aplicação'} de ${R(q*p)} em ${nm} lançada.`,true);
    ['oQtd','oPreco','oTaxa','oValor'].forEach(id=>$('#'+id).value='');
  }catch(err){flash(m,errTxt(err));}
});
$('#fDiv').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mDiv'); const raw=$('#dTk').value.trim(), v=+$('#dValor').value;
  const exist=S.ativos.find(x=>x.ticker===up(raw)||x.ticker===slug(raw)||(x.nome&&x.nome===raw));
  const t=exist?exist.ticker:up(raw);
  if(!/^[A-Z0-9.\-]{2,40}$/.test(t)){flash(m,'Escolha um ativo da lista ou digite o ticker.');return;}
  if(!(v>0)){flash(m,'Informe o valor recebido.');return;}
  try{ await store.add('dividendos',{ticker:t,tipo:$('#dTipo').value,data:$('#dData').value||today(),valor:v}); flash(m,`${R(v)} de ${exist&&exist.nome||t} lançado.`,true); $('#dValor').value=''; }
  catch(err){flash(m,errTxt(err));}
});
function syncIndForm(){showOnly($('#fInd'),$('#iCls').value||inferCls(up($('#iTk').value)));}
$('#iCls').addEventListener('change',syncIndForm);
$('#iTk').addEventListener('change',()=>{const raw=$('#iTk').value.trim(); const a=S.ativos.find(x=>x.ticker===up(raw)||x.ticker===slug(raw)||(x.nome&&x.nome===raw)); if(a) fillInd(a); else syncIndForm();});
function fillInd(a){
  const V=view(); const pos=posicoes(V).list.find(x=>x.ticker===a.ticker);
  $('#iCls').value=(a.classe&&MODS[a.classe])?a.classe:''; $('#iTk').value=a.nome||a.ticker; $('#iCot').value=a.cotacao??''; $('#iPm').value=a.pmInicial??''; $('#iCorr').value=a.corretora||''; $('#iLpa').value=a.lpa??''; $('#iVpa').value=a.vpa??''; $('#iDpa').value=a.dpa??'';
  $('#iMeta').value=a.meta??''; $('#iSetor').value=a.setor||''; $('#iSaldo').value=pos&&!isCot(a.classe)?(+pos.valor).toFixed(2):'';
  $('#iEmi').value=a.emissor||''; $('#iIdx').value=a.indexador||''; $('#iTaxa').value=a.taxa||''; $('#iVenc').value=a.venc||'';
  syncIndForm();
}
$('#fInd').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mInd'); const raw=$('#iTk').value.trim();
  const ex=S.ativos.find(x=>x.ticker===up(raw)||x.ticker===slug(raw)||(x.nome&&x.nome===raw));
  const mod=$('#iCls').value||(ex&&ex.classe)||inferCls(up(raw)); const cot=isCot(mod);
  const t=ex?ex.ticker:(cot?up(raw):slug(raw));
  if(!t||(cot&&!/^[A-Z0-9.\-]{2,12}$/.test(t))){flash(m,'Ticker ou nome inválido.');return;}
  const old=ex||{}; const data={...old,ticker:t,classe:mod,corretora:$('#iCorr').value.trim(),meta:numOrNull($('#iMeta').value),setor:$('#iSetor').value.trim(),atualizadoEm:today()};
  if(cot){ Object.assign(data,{pmInicial:numOrNull($('#iPm').value),cotacao:numOrNull($('#iCot').value),lpa:numOrNull($('#iLpa').value),vpa:numOrNull($('#iVpa').value),dpa:numOrNull($('#iDpa').value)}); }
  else {
    Object.assign(data,{nome:old.nome||raw,emissor:$('#iEmi').value.trim(),indexador:$('#iIdx').value,taxa:$('#iTaxa').value.trim(),venc:$('#iVenc').value||''});
    const saldo=numOrNull($('#iSaldo').value); const pos=posicoes(S).list.find(x=>x.ticker===t);
    if(saldo!=null){ if(!pos){flash(m,'Lance a aplicação primeiro em Lançamentos. Depois atualize o saldo aqui.');return;} data.cotacao=saldo/pos.qtd; }
    else if(data.cotacao==null) data.cotacao=1;
  }
  delete data.id;
  try{ await store.put('ativos',t,data); flash(m,`${data.nome||t} atualizado.`,true); }catch(err){flash(m,errTxt(err));}
});
let taxaT; $('#taxaBazin').addEventListener('input',e=>{clearTimeout(taxaT);taxaT=setTimeout(async()=>{const v=+e.target.value; if(v>=1&&v<=20){ try{await store.put('config','geral',{...S.config,taxaBazin:v});}catch(err){} if(view()!==S){render();} }},600);});

document.addEventListener('click',async e=>{
  const g=e.target.closest('[data-goto]'); if(g){go(g.dataset.goto);return;}
  const ed=e.target.closest('[data-edit]'); if(ed){
    const t=ed.dataset.edit; const a=view().ativos.find(x=>x.ticker===t)||{ticker:t}; fillInd(a);
    go('aporte'); setTimeout(()=>{$('#fInd').scrollIntoView({behavior:'smooth',block:'center'});($('#iCot').closest('label').hidden?$('#iSaldo'):$('#iCot')).focus();},50); return;}
  const dl=e.target.closest('[data-del]'); if(dl){
    if(dl.dataset.armed!=='1'){dl.dataset.armed='1';dl.textContent='Confirmar?';setTimeout(()=>{if(dl.isConnected){dl.dataset.armed='';dl.textContent='Excluir';}},3000);return;}
    try{await store.del(dl.dataset.del,dl.dataset.id);}catch(err){dl.textContent='Erro';}
    return;}
  const bk=e.target.closest('[data-banco]'); if(bk){posBanco=bk.dataset.banco; render(); return;}
  const c=e.target.closest('[data-c]'); if(c){posCls=c.dataset.c; document.querySelectorAll('#clsSeg button').forEach(b=>b.setAttribute('aria-pressed',b===c)); render(); return;}
  const h=e.target.closest('[data-h]'); if(h){histMode=h.dataset.h; document.querySelectorAll('#histSeg button').forEach(b=>b.setAttribute('aria-pressed',b===h)); render(); return;}
});
$('#anoSel').addEventListener('change',render);

/* ---------- Cartões de crédito ---------- */
const CATS=['Mercado','Restaurante e delivery','Transporte','Combustível','Casa','Contas e assinaturas','Saúde','Educação','Lazer','Compras','Viagem','Outros'];
const MESES_L=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const ymAdd=(ym,n)=>{let [y,m]=ym.split('-').map(Number); m+=n; y+=Math.floor((m-1)/12); m=((m-1)%12+12)%12+1; return y+'-'+String(m).padStart(2,'0');};
let fatYM=today().slice(0,7), cartSel='todos', fatAll=false;
// mês da fatura (mês do vencimento) em que cai a 1ª parcela de uma compra
function fatura1(c,data){
  const y=+data.slice(0,4), m=+data.slice(5,7), d=+data.slice(8,10);
  const fech=+c.fech||1, venc=+c.venc||10;
  let ym=y+'-'+String(m).padStart(2,'0');
  if(d>=fech) ym=ymAdd(ym,1);            // comprou no dia do fechamento ou depois: vai para o próximo fechamento
  if(venc<=fech) ym=ymAdd(ym,1);          // vencimento no mês seguinte ao fechamento
  return ym;
}
function parcelas(){
  const cm=Object.fromEntries(S.cartoes.map(c=>[c.id,c])); const out=[];
  for(const g of S.gastos){
    const c=cm[g.cartao]; if(!c) continue;
    const n=Math.max(1,Math.round(+g.parcelas||1)), tot=Math.round((+g.valor||0)*100);
    const base=Math.floor(tot/n), resto=tot-base*n, f1=/^\d{4}-\d{2}$/.test(g.fatura||'')?g.fatura:fatura1(c,g.data||today());  // g.fatura: mês da 1ª parcela como veio na fatura do banco
    for(let i=0;i<n;i++) out.push({g,c,i:i+1,n,ym:ymAdd(f1,i),v:(base+(i<resto?1:0))/100});
  }
  return out;
}
function venceEm(c,ym){const [y,m]=ym.split('-').map(Number); const last=new Date(y,m,0).getDate(); return String(Math.min(+c.venc||10,last)).padStart(2,'0')+'/'+String(m).padStart(2,'0');}
function renderCartoes(){
  const P=parcelas(); const [fy,fm]=fatYM.split('-').map(Number);
  $('#fatMes').textContent=MESES_L[fm-1]+' '+fy;
  if(cartSel!=='todos'&&!S.cartoes.some(c=>c.id===cartSel)) cartSel='todos';
  $('#cartSeg').innerHTML=S.cartoes.length>1?['todos',...S.cartoes.map(c=>c.id)].map(id=>`<button aria-pressed="${id===cartSel}" data-cs="${esc(id)}">${id==='todos'?'Todos os cartões':esc((S.cartoes.find(c=>c.id===id)||{}).nome)}</button>`).join(''):'';
  $('#cartSeg').parentElement.hidden=S.cartoes.length<2;
  const sel=x=>cartSel==='todos'||x.c.id===cartSel;
  const doMes=P.filter(x=>x.ym===fatYM&&sel(x)).sort((a,b)=>(b.g.data||'').localeCompare(a.g.data||''));
  const tot=doMes.reduce((s,x)=>s+x.v,0);
  const prox=P.filter(x=>x.ym===ymAdd(fatYM,1)&&sel(x)).reduce((s,x)=>s+x.v,0);
  const futuro=P.filter(x=>x.ym>today().slice(0,7)||(x.ym===today().slice(0,7)));
  const cs=cartSel==='todos'?S.cartoes:S.cartoes.filter(c=>c.id===cartSel);
  const lim=cs.reduce((s,c)=>s+(+c.limite||0),0); const usado=futuro.filter(sel).reduce((s,x)=>s+x.v,0);
  $('#cKpis').innerHTML=`
    <div class="ckpi"><div class="l">Fatura de ${MESES_L[fm-1]}</div><div class="v">${R(tot)}</div><div class="s">${doMes.length} lançamento${doMes.length===1?'':'s'}${cs.length===1?' · vence '+venceEm(cs[0],fatYM):''}${cs.length===1&&tot>0?` · <label style="display:inline-flex;gap:4px;align-items:center;cursor:pointer"><input type="checkbox" class="ckpago" data-fpago="${esc(cs[0].id)}|${fatYM}" ${((S.faturas||[]).find(f=>f.id==='fp-'+cs[0].id+'-'+fatYM)||{}).pago?'checked':''}> paga</label>`:''}</div></div>
    <div class="ckpi"><div class="l">Fatura seguinte</div><div class="v">${R(prox)}</div><div class="s">já comprometido em parcelas</div></div>
    <div class="ckpi"><div class="l">Limite usado</div><div class="v">${lim?PCT(usado/lim):'—'}</div><div class="s">${lim?R(usado)+' de '+R(lim):'Informe o limite do cartão'}</div></div>`;
  $('#tblFat').innerHTML=!S.cartoes.length?'<tbody><tr><td class="empty">Cadastre seu primeiro cartão em "Meus cartões" logo abaixo. Depois lance os gastos e eles aparecem aqui, separados por fatura.</td></tr></tbody>'
    :`<thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Cartão</th><th class="n">Parcela</th><th class="n">Valor</th><th></th></tr></thead><tbody>${doMes.length?(fatAll?doMes:doMes.slice(0,30)).map(x=>`<tr><td class="num">${fmtD(x.g.data)}</td><td style="white-space:normal;min-width:10em">${esc(x.g.descricao)}</td><td>${esc(x.g.categoria||'Outros')}</td><td>${esc(x.c.nome)}</td><td class="n">${x.n>1?x.i+'/'+x.n:'à vista'}</td><td class="n">${R(x.v)}</td><td><span class="acts"><button class="btn ghost small" data-ed="gastos" data-id="${esc(x.g.id)}">Editar</button><button class="btn danger small" data-del="gastos" data-id="${esc(x.g.id)}" title="${x.n>1?'Exclui a compra inteira, com todas as parcelas':'Excluir gasto'}">Excluir</button></span></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nenhum gasto nesta fatura.</td></tr>'}${!fatAll&&doMes.length>30?`<tr class="morerow"><td colspan="7"><div class="fatmore"><button class="btn ghost small" id="fatMore" type="button">Mostrar todos os ${doMes.length} lançamentos</button></div></td></tr>`:''}</tbody>${doMes.length?`<tfoot><tr><td colspan="5">Total da fatura</td><td class="n">${R(tot)}</td><td></td></tr></tfoot>`:''}`;
  const porCat={}; doMes.forEach(x=>{const k=x.g.categoria||'Outros'; porCat[k]=(porCat[k]||0)+x.v;});
  const cats=Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
  $('#catBars').innerHTML=cats.length?donut(cats.map(([k,v])=>({l:k,v})),R(tot).replace(/,\d\d$/,''),'na fatura')+cats.map(([k,v],i)=>`<div class="bar" style="grid-template-columns:minmax(0,150px) minmax(0,1fr) auto"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span><div class="track"><div class="fill" style="background:${PAL[i%PAL.length]};width:${(v/tot*100).toFixed(1)}%"></div></div><span class="num" style="text-align:right;white-space:nowrap">${R(v)} <span class="sub2">${PCT(v/tot)}</span></span></div>`).join(''):'<p class="empty">Sem gastos nesta fatura.</p>';
  const meses=[...Array(6)].map((_,i)=>ymAdd(fatYM,i+1));
  const rows=meses.map(ym=>({ym,v:P.filter(x=>x.ym===ym&&sel(x)).reduce((s,x)=>s+x.v,0)})).filter(r=>r.v>0);
  $('#tblProx').innerHTML=rows.length?`<thead><tr><th>Fatura</th><th class="n">Parcelas</th></tr></thead><tbody>${rows.map(r=>`<tr><td style="text-transform:capitalize">${MESES_L[+r.ym.slice(5)-1]} ${r.ym.slice(0,4)}</td><td class="n">${R(r.v)}</td></tr>`).join('')}</tbody>`:'<tbody><tr><td class="empty">Nenhuma parcela futura.</td></tr></tbody>';
  const gc=$('#gCartao'); const cur=gc.value;
  gc.innerHTML=S.cartoes.length?S.cartoes.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join(''):'<option value="">Cadastre um cartão primeiro</option>';
  if(S.cartoes.some(c=>c.id===cur)) gc.value=cur;
  $('#cardList').innerHTML=S.cartoes.length?S.cartoes.map(c=>{const u=P.filter(x=>x.c.id===c.id&&x.ym>=today().slice(0,7)).reduce((s,x)=>s+x.v,0); const pc=c.limite?u/c.limite:0;
    return `<div class="cchip"><div><b>${esc(c.nome)}</b><div class="sub2">fecha dia ${esc(c.fech)} · vence dia ${esc(c.venc)}${c.limite?' · limite '+R(+c.limite):''}</div>${c.limite?`<div class="limbar" title="${PCT(pc)} do limite"><i class="${pc>0.8?'hi':''}" style="width:${Math.min(100,pc*100).toFixed(0)}%"></i></div>`:''}</div><button class="btn ghost small" data-ed="cartoes" data-id="${esc(c.id)}">Editar</button><button class="btn danger small" data-del="cartoes" data-id="${esc(c.id)}" ${S.gastos.some(g=>g.cartao===c.id)?'disabled title="Exclua os gastos deste cartão antes"':''}>Excluir</button></div>`;}).join(''):'<p class="empty">Nenhum cartão cadastrado.</p>';
}
$('#fatPrev').addEventListener('click',()=>{fatYM=ymAdd(fatYM,-1);fatAll=false;renderCartoes();});
document.addEventListener('click',e=>{if(e.target.closest('#fatMore')){fatAll=true;renderCartoes();}});
$('#fatNext').addEventListener('click',()=>{fatYM=ymAdd(fatYM,1);fatAll=false;renderCartoes();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-cs]'); if(b){cartSel=b.dataset.cs;renderCartoes();}});
$('#fCartao').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mCartao'); const nome=$('#cNome').value.trim(), fech=+$('#cFech').value, venc=+$('#cVenc').value;
  if(!nome){flash(m,'Dê um nome ao cartão.');return;}
  if(!(fech>=1&&fech<=31)||!(venc>=1&&venc<=31)){flash(m,'Os dias de fechamento e vencimento vão de 1 a 31.');return;}
  const id=slug(nome)||('C'+Date.now().toString(36));
  if(S.cartoes.some(c=>c.id===id)){flash(m,'Já existe um cartão com esse nome.');return;}
  try{await store.put('cartoes',id,{nome,fech,venc,limite:numOrNull($('#cLim').value)}); flash(m,`${nome} adicionado.`,true); ['cNome','cFech','cVenc','cLim'].forEach(i=>$('#'+i).value=''); $('#gCartao').value=id;}
  catch(err){flash(m,errTxt(err));}
});
$('#fGasto').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mGasto'); const cartao=$('#gCartao').value, v=+$('#gValor').value, n=Math.round(+$('#gParc').value||1), desc=$('#gDesc').value.trim(), data=$('#gData').value||today();
  if(!cartao){flash(m,'Cadastre um cartão em "Meus cartões" primeiro.');return;}
  if(!desc){flash(m,'Escreva uma descrição.');return;}
  if(!(v>0)){flash(m,'Informe o valor.');return;}
  if(!(n>=1&&n<=48)){flash(m,'Parcelas de 1 a 48.');return;}
  try{
    await store.add('gastos',{cartao,data,descricao:desc,categoria:$('#gCat').value,valor:v,parcelas:n});
    const c=S.cartoes.find(x=>x.id===cartao); const f=fatura1(c,data);
    flash(m,`${desc} lançado${n>1?' em '+n+'x de '+R(v/n):''}. Primeira parcela na fatura de ${MESES_L[+f.slice(5)-1]}.`,true);
    $('#gDesc').value='';$('#gValor').value='';$('#gParc').value='1';
  }catch(err){flash(m,errTxt(err));}
});

/* ---------- Contas a pagar ---------- */
const CCATS=['Cartão','Casa','Assinaturas','Transporte','Parcelamentos','Saúde','Educação','Impostos','Extras','Outros'];
let ctYM=today().slice(0,7);
const ymNome=ym=>MESES_L[+ym.slice(5)-1]+' '+ym.slice(0,4);
// faturas da aba Cartões que ainda não estão lançadas como conta no mês
/* Vencimento: dia da conta, ou o do cartão ligado a ela. Sem dia, não há data. */
function vencData(c){
  let dia=+c.dia||0;
  if(!dia&&c.cartao){const k=S.cartoes.find(x=>x.id===c.cartao); if(k&&+k.venc) dia=+k.venc;}
  if(!dia||!/^\d{4}-\d{2}$/.test(c.mes||'')) return null;
  const [y,m]=c.mes.split('-').map(Number); const last=new Date(y,m,0).getDate();
  return c.mes+'-'+String(Math.min(dia,last)).padStart(2,'0');
}
function vencendo(P){
  const hoje=today(), lim=new Date(Date.now()+3*864e5).toISOString().slice(0,10), ym=hoje.slice(0,7);
  const out=[];
  for(const mm of [ymAdd(ym,-2),ymAdd(ym,-1),ym,ymAdd(ym,1)]) for(const c of contasDoMes(mm,P)){
    if(c.pago) continue; const d=vencData(c); if(!d||d>lim) continue;
    out.push({c,d,st:d<hoje?'late':d===hoje?'hoje':'breve'});
  }
  for(const l of (S.licenc||[])){ if(l.pago||!l.venc||l.venc>lim||l.venc<ymAdd(ym,-12)+'-01') continue;
    out.push({c:{descricao:'Licenciamento '+veicNome(l.placa),valor:l.valor,lic:1},d:l.venc,st:l.venc<hoje?'late':l.venc===hoje?'hoje':'breve'}); }
  return out.sort((a,b)=>a.d<b.d?-1:1);
}
function renderVenc(P){
  const L=vencendo(P), el=$('#vencBanner');
  if(!L.length){el.hidden=true;return;}
  const hoje=today(), dias=d=>{const n=Math.round((new Date(d)-new Date(hoje))/864e5);return n===1?'amanhã':'em '+n+' dias';};
  const late=L.filter(x=>x.st==='late').length;
  el.className='vbanner'+(late?' late':'');
  el.innerHTML=`<div><b>${late?late+' conta'+(late===1?'':'s')+' vencida'+(late===1?'':'s')+(L.length>late?' e '+(L.length-late)+' vencendo':''):L.length+' conta'+(L.length===1?'':'s')+' vencendo'}</b>
    <ul>${L.slice(0,6).map(x=>`<li>${esc(x.c.descricao)} · <span class="num">${R(+x.c.valor)}</span> · ${x.st==='late'?'venceu '+fmtD(x.d):x.st==='hoje'?'vence hoje':'vence '+dias(x.d)+' ('+fmtD(x.d)+')'}</li>`).join('')}${L.length>6?`<li>e mais ${L.length-6}</li>`:''}</ul></div>
    ${L.every(x=>x.c.lic)?'<button class="btn small" data-goto="veiculos">Ver veículos</button>':'<button class="btn small" data-goto="contas">Ver contas</button>'}`;
  el.hidden=false;
}
function contasDoMes(ym,P){
  const L=S.contas.filter(c=>c.mes===ym).map(c=>({...c,auto:false}));
  const porCard={}; P.filter(x=>x.ym===ym).forEach(x=>{porCard[x.c.id]=(porCard[x.c.id]||0)+x.v;});
  for(const [cid,v] of Object.entries(porCard)){
    if(L.some(c=>c.cartao===cid)) continue;
    const c=S.cartoes.find(k=>k.id===cid);
    L.push({id:'auto-'+cid,mes:ym,descricao:'Fatura '+(c?c.nome:cid),categoria:'Cartão',valor:Math.round(v*100)/100,auto:true,cartao:cid,venc:c?venceEm(c,ym):null,pago:!!((S.faturas||[]).find(f=>f.id==='fp-'+cid+'-'+ym)||{}).pago});
  }
  const ord=c=>CCATS.indexOf(c.categoria)<0?99:CCATS.indexOf(c.categoria);
  return L.sort((a,b)=>(a.pago===b.pago?0:a.pago?1:-1)||ord(a)-ord(b)||(b.valor||0)-(a.valor||0));
}
function renderContas(){
  const P=parcelas(); const L=contasDoMes(ctYM,P);
  $('#ctMes').textContent=ymNome(ctYM);
  const tot=L.reduce((s,c)=>s+(+c.valor||0),0), pago=L.filter(c=>c.pago).reduce((s,c)=>s+(+c.valor||0),0);
  const rec=S.receitas.filter(r=>r.mes===ctYM).sort((a,b)=>(b.valor||0)-(a.valor||0)); const rt=rec.reduce((s,r)=>s+(+r.valor||0),0);
  const saldo=rt-tot;
  $('#ctKpis').innerHTML=`
    <div class="ckpi"><div class="l">A pagar em ${MESES_L[+ctYM.slice(5)-1]}</div><div class="v">${R(tot)}</div><div class="s">${L.length} conta${L.length===1?'':'s'} · ${tot-pago>0.004?'faltam '+R(tot-pago):'tudo pago'}</div></div>
    <div class="ckpi"><div class="l">Receitas do mês</div><div class="v">${R(rt)}</div><div class="s">${rec.length?rec.length+' entrada'+(rec.length===1?'':'s'):'Lance suas receitas abaixo'}</div></div>
    <div class="ckpi"><div class="l">Sobra do mês</div><div class="v ${rec.length?cls(saldo):''}">${rec.length?R(saldo):'—'}</div><div class="s">${rec.length?(saldo>=0?'receitas menos contas':'as contas passam das receitas'):'precisa das receitas do mês'}</div></div>`;
  const itens=c=>c.itens&&c.itens.length?`<details class="itens"><summary>${c.itens.length} ite${c.itens.length===1?'m':'ns'}</summary><ul>${c.itens.map(i=>`<li><span>${esc(i.d)}</span><span class="num">${R(i.v)}</span></li>`).join('')}</ul></details>`:'';
  $('#tblContas').innerHTML=`<thead><tr><th>Pago</th><th>Conta</th><th>Situação</th><th class="n">Valor</th><th></th></tr></thead><tbody>${L.length?L.map(c=>`<tr class="${c.pago?'pago':''}">
    <td>${c.auto?`<input type="checkbox" class="ckpago" data-fpago="${esc(c.cartao)}|${esc(c.mes)}" ${c.pago?'checked':''} aria-label="Marcar ${esc(c.descricao)} como paga" title="Fatura vem da aba Cartões">`:`<input type="checkbox" class="ckpago" data-pago="${esc(c.id)}" ${c.pago?'checked':''} aria-label="Marcar ${esc(c.descricao)} como paga">`}</td>
    <td style="white-space:normal;min-width:11em"><span class="cdesc">${esc(c.descricao)}</span>${c.parcela?` <span class="sub2">${esc(c.parcela)}</span>`:''}${!c.auto&&vencData(c)?` <span class="sub2">· vence ${fmtD(vencData(c))}</span>`:''}${c.auto?` <span class="sub2">· da aba Cartões${c.venc?', vence '+esc(c.venc):''}</span>`:''}${itens(c)}</td>
    <td>${c.pago?'<span class="st ok">Paga</span>':c.mes<today().slice(0,7)?'<span class="st late">Atrasada</span>':'<span class="st wait">A pagar</span>'} <span class="sub2">${esc(c.categoria||'Outros')}</span></td><td class="n">${R(+c.valor)}</td>
    <td>${c.auto?`<button class="btn ghost small" data-goto="cartoes">Ver</button>`:`<span class="acts"><button class="btn ghost small" data-ed="contas" data-id="${esc(c.id)}">Editar</button><button class="btn danger small" data-del="contas" data-id="${esc(c.id)}">Excluir</button></span>`}</td></tr>`).join(''):`<tr><td colspan="5" class="empty">Nenhuma conta em ${ymNome(ctYM)}.</td></tr>`}</tbody>${L.length?`<tfoot><tr><td colspan="3">Total do mês</td><td class="n">${R(tot)}</td><td></td></tr></tfoot>`:''}`;
  const meses=[...Array(12)].map((_,i)=>ymAdd(today().slice(0,7),i));
  const rows=meses.map(ym=>({ym,v:contasDoMes(ym,P).reduce((s,c)=>s+(+c.valor||0),0)}));
  const mx=Math.max(...rows.map(r=>r.v),1);
  $('#ctBars').innerHTML=rows.some(r=>r.v>0)?rows.map(r=>`<div class="bar" style="grid-template-columns:minmax(0,120px) minmax(0,1fr) auto;cursor:pointer" data-ctym="${r.ym}" title="Abrir ${ymNome(r.ym)}"><span style="text-transform:capitalize;white-space:nowrap">${MESES[+r.ym.slice(5)-1]} ${r.ym.slice(2,4)}</span><div class="track"><div class="fill" style="width:${(r.v/mx*100).toFixed(1)}%"></div></div><span class="num" style="text-align:right;white-space:nowrap">${R(r.v)}</span></div>`).join(''):'<p class="empty">Nenhuma conta nos próximos meses.</p>';
  $('#tblRec').innerHTML=rec.length?`<tbody>${rec.map(r=>`<tr><td>${esc(r.fonte)}</td><td class="n">${R(+r.valor)}</td><td style="width:1%"><span class="acts"><button class="btn ghost small" data-ed="receitas" data-id="${esc(r.id)}">Editar</button><button class="btn danger small" data-del="receitas" data-id="${esc(r.id)}">Excluir</button></span></td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="n">${R(rt)}</td><td></td></tr></tfoot>`:`<tbody><tr><td class="empty">Nenhuma receita em ${ymNome(ctYM)}.</td></tr></tbody>`;
  $('#fontesList').innerHTML=[...new Set(S.receitas.map(r=>r.fonte))].map(f=>`<option value="${esc(f)}">`).join('');
}
$('#ctPrev').addEventListener('click',()=>{ctYM=ymAdd(ctYM,-1);renderContas();});
$('#ctNext').addEventListener('click',()=>{ctYM=ymAdd(ctYM,1);renderContas();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-ctym]'); if(b){ctYM=b.dataset.ctym;renderContas();$('#ctMes').scrollIntoView({behavior:'smooth',block:'center'});}});
document.addEventListener('change',async e=>{const k=e.target.closest('[data-fpago]'); if(!k) return;
  const [cid,ym]=k.dataset.fpago.split('|'); const tot=(contasDoMes(ym,parcelas()).find(x=>x.auto&&x.cartao===cid)||{}).valor;
  try{await store.put('faturas','fp-'+cid+'-'+ym,{cartao:cid,mes:ym,pago:k.checked,pagoEm:k.checked?today():null,valor:tot??null});}catch(err){k.checked=!k.checked; alert(errTxt(err));}
});
document.addEventListener('change',async e=>{const k=e.target.closest('[data-pago]'); if(!k) return;
  const c=S.contas.find(x=>x.id===k.dataset.pago); if(!c) return; const {id,...d}=c;
  try{await store.put('contas',id,{...d,pago:k.checked});}catch(err){k.checked=!k.checked; alert(errTxt(err));}
});
$('#fConta').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mConta'); const ym=$('#ctM').value, desc=$('#ctDesc').value.trim(), v=+$('#ctValor').value, n=Math.round(+$('#ctRep').value||1), num=$('#ctParc').value==='1';
  if(!/^\d{4}-\d{2}$/.test(ym)){flash(m,'Escolha o mês.');return;}
  if(!desc){flash(m,'Escreva uma descrição.');return;}
  if(!(v>0)){flash(m,'Informe o valor.');return;}
  if(!(n>=1&&n<=60)){flash(m,'Repetir de 1 a 60 meses.');return;}
  const dia=$('#ctDia').value===''?null:Math.round(+$('#ctDia').value); if(dia!=null&&!(dia>=1&&dia<=31)){flash(m,'Dia do vencimento de 1 a 31.');return;}
  try{
    for(let i=0;i<n;i++){const d={mes:ymAdd(ym,i),descricao:desc,categoria:$('#ctCat').value,valor:v,pago:false}; if(dia) d.dia=dia; if(num&&n>1) d.parcela=(i+1)+'/'+n; await store.add('contas',d);}
    flash(m,`${desc} adicionada${n>1?' em '+n+' meses, de '+ymNome(ym)+' a '+ymNome(ymAdd(ym,n-1)):' em '+ymNome(ym)}.`,true);
    $('#ctDesc').value='';$('#ctValor').value='';$('#ctRep').value='1'; ctYM=ym; renderContas();
  }catch(err){flash(m,errTxt(err));}
});
$('#fRec').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mRec'); const fonte=$('#rFonte').value.trim(), v=+$('#rValor').value, n=Math.round(+$('#rRep').value||1);
  if(!fonte){flash(m,'Diga de onde vem a receita.');return;}
  if(!(v>0)){flash(m,'Informe o valor.');return;}
  if(!(n>=1&&n<=60)){flash(m,'Repetir de 1 a 60 meses.');return;}
  try{ for(let i=0;i<n;i++) await store.add('receitas',{mes:ymAdd(ctYM,i),fonte,valor:v});
    flash(m,`${fonte} lançada em ${ymNome(ctYM)}${n>1?(n===2?' e no mês seguinte':' e nos '+(n-1)+' meses seguintes'):''}.`,true); $('#rFonte').value='';$('#rValor').value='';$('#rRep').value='1';
  }catch(err){flash(m,errTxt(err));}
});

/* ---------- Editar lançamentos ---------- */
const TIPOS_DIV=['Dividendo','JCP','Rendimento (FII)','Juros/cupom','Outro'];
function edSchema(col,d){
  const num=(k,l,o={})=>({k,l,t:'number',...o});
  switch(col){
    case 'gastos': return {tit:'Editar gasto do cartão',sub:'Para parcelada, o valor é o total da compra.',f:[
      {k:'cartao',l:'Cartão',t:'select',opts:S.cartoes.map(c=>[c.id,c.nome])},{k:'data',l:'Data da compra',t:'date'},
      {k:'descricao',l:'Descrição',t:'text',wide:1},{k:'categoria',l:'Categoria',t:'select',opts:CATS.map(c=>[c,c])},
      num('valor','Valor total (R$)',{step:'0.01'}),num('parcelas','Parcelas',{step:'1',min:1,max:48})]};
    case 'contas': return {tit:'Editar conta',f:[{k:'mes',l:'Mês',t:'month'},{k:'descricao',l:'Descrição',t:'text',wide:1},
      {k:'categoria',l:'Categoria',t:'select',opts:CCATS.map(c=>[c,c])},num('valor','Valor (R$)',{step:'0.01'}),num('dia','Dia do vencimento',{step:'1',min:1,max:31,opt:1}),{k:'parcela',l:'Parcela (ex.: 3/12)',t:'text',opt:1},
      {k:'pago',l:'Situação',t:'select',opts:[['0','A pagar'],['1','Paga']]}]};
    case 'vendas': if(d.valor!=null) return {tit:'Editar fiado',f:[{k:'cliente',l:'Cliente',t:'text',list:'cliList',wide:1},{k:'data',l:'Dia',t:'date'},
      {k:'produto',l:'Mercadoria',t:'select',opts:[['Leite','Leite'],['Queijo','Queijo']]},num('valor','Valor (R$)',{step:'0.01'}),{k:'pago',l:'Pagamento',t:'select',opts:[['0','Ainda não pagou'],['1','Pagou']]}]};
      return {tit:'Editar venda',f:[{k:'data',l:'Data',t:'date'},{k:'produto',l:'Produto',t:'text',list:'prodList'},num('qtd','Quantidade',{step:'0.001'}),
      {k:'un',l:'Unidade',t:'select',opts:[['kg','kg'],['L','litro'],['un','unidade']]},num('preco','Preço por unidade (R$)',{step:'0.01'}),{k:'cliente',l:'Cliente',t:'text',list:'cliList',opt:1,wide:1},
      {k:'pago',l:'Pagamento',t:'select',opts:[['1','Recebido'],['0','A receber']]}]};
    case 'clientes': return {tit:'Editar cliente',f:[{k:'nome',l:'Nome',t:'text',wide:1},{k:'telefone',l:'Telefone',t:'text',opt:1},{k:'endereco',l:'Endereço ou referência',t:'text',wide:1,opt:1},
      {k:'produto',l:'Compra',t:'select',opts:[['','Leite e queijo'],['Queijo','Queijo'],['Leite','Leite']]}]};
    case 'chgastos': return {tit:'Editar despesa da chácara',f:[{k:'mes',l:'Mês',t:'month'},{k:'descricao',l:'Descrição',t:'text',wide:1},num('valor','Valor (R$)',{step:'0.01'})]};
    case 'veiculos': return {tit:'Editar veículo',sub:'Placa '+d.placa,f:[{k:'nome',l:'Veículo',t:'text',wide:1},{k:'renavam',l:'RENAVAM',t:'text',opt:1},{k:'obs',l:'Observação',t:'text',wide:1,opt:1}]};
    case 'licenc': return {tit:'Editar pagamento do veículo',sub:veicNome(d.placa)+' · '+d.ano,f:[{k:'venc',l:'Vencimento',t:'date',opt:1},num('valor','Valor (R$)',{step:'0.01'}),{k:'pago',l:'Situação',t:'select',opts:[['0','A pagar'],['1','Pago']]},{k:'obs',l:'Observação',t:'text',wide:1,opt:1}]};
    case 'animais': return {tit:'Editar animal',f:[{k:'nome',l:'Nome',t:'text',wide:1},{k:'obs',l:'Observação',t:'text',wide:1,opt:1}]};
    case 'receitas': return {tit:'Editar receita',f:[{k:'mes',l:'Mês',t:'month'},{k:'fonte',l:'Fonte',t:'text',wide:1},num('valor','Valor (R$)',{step:'0.01'})]};
    case 'cartoes': return {tit:'Editar cartão',f:[{k:'nome',l:'Nome do cartão',t:'text',wide:1},num('fech','Dia do fechamento',{step:'1',min:1,max:31}),
      num('venc','Dia do vencimento',{step:'1',min:1,max:31}),num('limite','Limite (R$)',{step:'0.01',opt:1})]};
    case 'dividendos': return {tit:'Editar provento',f:[{k:'ticker',l:'Ativo',t:'text',list:'ativosList'},{k:'tipo',l:'Tipo',t:'select',opts:TIPOS_DIV.map(c=>[c,c])},
      {k:'data',l:'Data',t:'date'},num('valor','Valor recebido (R$)',{step:'0.01'})]};
    case 'compras': { const cot=isCot(clsOf(S,d.ticker));
      return cot?{tit:'Editar compra ou venda',f:[{k:'tipo',l:'Tipo',t:'select',opts:[['compra','Compra'],['venda','Venda']]},{k:'ticker',l:'Ativo',t:'text',list:'ativosList'},
        {k:'data',l:'Data',t:'date'},num('qtd','Quantidade',{step:'any'}),num('preco','Preço por unidade (R$)',{step:'any',opt:1}),num('taxa','Taxas (R$)',{step:'0.01',opt:1})]}
      :{tit:'Editar aplicação ou resgate',f:[{k:'tipo',l:'Tipo',t:'select',opts:[['compra','Aplicação'],['venda','Resgate']]},{k:'data',l:'Data',t:'date'},
        {k:'_valor',l:'Valor (R$)',t:'number',step:'0.01'}]}; }
  }
}
let edCur=null;
function openEd(col,id){
  const d=S[colKey(col)].find(x=>x.id===id); if(!d) return;
  const sc=edSchema(col,d); edCur={col,id,d,sc};
  $('#edTit').textContent=sc.tit; $('#edSub').textContent=sc.sub||''; $('#edSub').hidden=!sc.sub; $('#edMsg').textContent='';
  const val=f=>f.k==='_valor'?((+d.qtd||0)*(+d.preco||0)).toFixed(2):f.k==='pago'?(d.pago?'1':'0'):(d[f.k]??'');
  $('#edFields').innerHTML=sc.f.map((f,i)=>{const v=val(f);
    const inp=f.t==='select'?`<select data-k="${f.k}">${f.opts.map(([o,l])=>`<option value="${esc(o)}" ${String(o)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`
      :`<input data-k="${f.k}" type="${f.t}" value="${esc(v)}" ${f.step?`step="${f.step}"`:''} ${f.min!=null?`min="${f.min}"`:''} ${f.max!=null?`max="${f.max}"`:''} ${f.list?`list="${f.list}"`:''} ${f.t==='number'?'inputmode="decimal"':''} ${f.opt?'':'required'} autocomplete="off">`;
    return `<label class="fld${f.wide?' wide':''}">${esc(f.l)}${inp}</label>`;}).join('');
  const dl=$('#edDlg'); if(dl.showModal) dl.showModal(); else dl.setAttribute('open','');
  setTimeout(()=>{const first=dl.querySelector('[data-k]'); if(first&&!matchMedia('(max-width:640px)').matches) first.focus();},30);
}
function closeEd(){const dl=$('#edDlg'); if(dl.close) dl.close(); else dl.removeAttribute('open'); edCur=null;}
$('#edCancel').addEventListener('click',closeEd);
$('#edDlg').addEventListener('click',e=>{if(e.target===$('#edDlg')) closeEd();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-ed]'); if(b) openEd(b.dataset.ed,b.dataset.id);});
$('#edForm').addEventListener('submit',async e=>{
  e.preventDefault(); if(!edCur) return; const {col,id,d,sc}=edCur; const m=$('#edMsg');
  const {id:_x,...data}=d;
  for(const f of sc.f){ const el=$('#edFields').querySelector(`[data-k="${f.k}"]`); let v=el.value.trim();
    if(f.k==='pago'){data.pago=v==='1';continue;}
    if(f.t==='number'){ if(v===''){ if(f.opt){data[f.k]=null;continue;} flash(m,`Preencha "${f.l}".`);return;} v=+v; if(!isFinite(v)){flash(m,`"${f.l}" não é um número.`);return;} }
    else if(!v&&!f.opt&&f.k!=='parcela'){flash(m,`Preencha "${f.l}".`);return;}
    if(f.k==='ticker') v=up(v);
    if(f.k==='_valor'){ if(!(v>0)){flash(m,'Informe o valor.');return;} const p=+d.preco||1; data.preco=p; data.qtd=v/p; continue; }
    data[f.k]=v;
  }
  if(col==='gastos'){ data.parcelas=Math.round(data.parcelas); if(!(data.parcelas>=1&&data.parcelas<=48)){flash(m,'Parcelas de 1 a 48.');return;} if(!data.valor){flash(m,'Informe o valor.');return;} if(data.data!==d.data||data.cartao!==d.cartao) delete data.fatura; }
  if(col==='cartoes'&&(!(data.fech>=1&&data.fech<=31)||!(data.venc>=1&&data.venc<=31))){flash(m,'Os dias vão de 1 a 31.');return;}
  if(col==='contas'&&!data.parcela) delete data.parcela;
  if(col==='licenc'){ if(!data.venc) data.venc=null; data.pagoEm=data.pago?(d.pagoEm||today()):null; }
  if(col==='compras'&&!(data.qtd>0)){flash(m,'Informe a quantidade.');return;}
  if('valor' in data&&col!=='gastos'&&!(data.valor>0)){flash(m,'Informe o valor.');return;}
  try{ $('#edSave').disabled=true; await store.put(col,id,data); closeEd(); }
  catch(err){ flash(m,errTxt(err)); }
  finally{ $('#edSave').disabled=false; }
});

/* ---------- Celular: tabelas largas viram cartões ---------- */
function stackTables(){
  document.querySelectorAll('.tbl table').forEach(t=>{
    const hs=[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    const wrap=t.closest('.tbl'); wrap.classList.toggle('stack',hs.length>=4);
    if(hs.length<4) return;
    t.querySelectorAll('tbody tr, tfoot tr').forEach(tr=>{let i=0; [...tr.children].forEach(td=>{const h=hs[i]; if(h&&!td.colSpan||td.colSpan===1){ if(h) td.dataset.label=h; } i+=td.colSpan||1;});});
  });
}
new MutationObserver(()=>{clearTimeout(stackTables.t);stackTables.t=setTimeout(stackTables,30);}).observe(document.querySelector('main'),{childList:true,subtree:true});

/* ---------- Vendas (queijo, leite…) ---------- */
let vdYM=today().slice(0,7);
const vTot=v=>Math.round((v.valor!=null?+v.valor||0:(+v.qtd||0)*(+v.preco||0))*100)/100;
const UN={kg:'kg',L:'L',un:'un'};
function renderVendas(){
  const V=S.vendas||[]; const L=V.filter(v=>(v.data||'').slice(0,7)===vdYM).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  $('#vdMes').textContent=ymNome(vdYM);
  const tot=L.reduce((s,v)=>s+vTot(v),0), rec=L.filter(v=>v.pago).reduce((s,v)=>s+vTot(v),0);
  const ym=vdYM, PR=(S.producao||[]).find(x=>x.id==='pm-'+ym)||{mes:ym,leite:{},pegou:{}};
  const LV=Object.values(PR.leite||{}).map(Number).filter(x=>x>0); const lit=LV.reduce((t,x)=>t+x,0), diasL=LV.length;
  const LM=(S.leitemes||[]).find(x=>x.id==='lm-'+ym)||{}; const recL=+LM.recebido||0;
  const G=(S.chgastos||[]).filter(x=>x.mes===ym); const desp=G.reduce((t,x)=>t+(+x.valor||0),0);
  const lucro=recL+rec-desp;
  $('#vdKpis').innerHTML=`
    <div class="ckpi"><div class="l">Leite em ${MESES_L[+ym.slice(5)-1]}</div><div class="v">${NQ.format(lit)} L</div><div class="s">${diasL?diasL+' dias · média '+NQ.format(Math.round(lit/diasL*10)/10)+' L':'nenhum dia lançado'}</div></div>
    <div class="ckpi"><div class="l">Recebido</div><div class="v up">${R(recL+rec)}</div><div class="s">${recL&&lit?'leite a '+R(recL/lit)+'/L':'leite '+R(recL)}${rec?' · vendas '+R(rec):''}</div></div>
    <div class="ckpi"><div class="l">Despesas</div><div class="v ${desp?'down':''}">${R(desp)}</div><div class="s">${G.length} lançamento${G.length===1?'':'s'}</div></div>
    <div class="ckpi"><div class="l">Lucro líquido</div><div class="v ${cls(lucro)}">${R(lucro)}</div><div class="s">${tot-rec>0.004?'a receber '+R(tot-rec):(+LM.faltou?'faltou receber '+R(+LM.faltou):'recebido − despesas')}</div></div>`;
  renderLeite(PR,LM); renderChG(G);
  const porP={}; L.forEach(v=>{const k=(v.produto||'Outro')+'|'+(v.un||'un'); const o=porP[k]||(porP[k]={p:v.produto||'Outro',un:v.un||'un',q:0,v:0}); o.q+=+v.qtd||0; o.v+=vTot(v);});
  const ps=Object.values(porP).sort((a,b)=>b.v-a.v);
  $('#vdProd').innerHTML=ps.map((o,i)=>`<div class="bar" style="grid-template-columns:minmax(0,150px) minmax(0,1fr) auto"><span>${esc(o.p)} <span class="sub2">${NQ.format(Math.round(o.q*1000)/1000)} ${esc(UN[o.un]||o.un)}</span></span><div class="track"><div class="fill" style="background:${PAL[i%PAL.length]};width:${(tot?o.v/tot*100:0).toFixed(1)}%"></div></div><span class="num" style="text-align:right;white-space:nowrap">${R(o.v)} <span class="sub2">média ${R(o.q?o.v/o.q:0)}/${esc(UN[o.un]||o.un)}</span></span></div>`).join('');
  $('#tblVendas').innerHTML=`<thead><tr><th>Recebido</th><th>Data</th><th>Cliente</th><th>Produto</th><th class="n">Quantidade</th><th class="n">Total</th><th></th></tr></thead><tbody>${L.length?L.map(v=>`<tr class="${v.pago?'pago':''}">
    <td><input type="checkbox" class="ckpago" data-vpago="${esc(v.id)}" ${v.pago?'checked':''} aria-label="Marcar venda como recebida"></td>
    <td class="num">${fmtD(v.data)}</td><td>${esc(v.cliente||'—')}</td><td>${esc(v.produto||'')}</td>
    <td class="n">${v.valor!=null?'<span class="sub2">fiado</span>':`${NQ.format(+v.qtd||0)} ${esc(UN[v.un]||v.un||'')} <span class="sub2">× ${R(+v.preco||0)}</span>`}</td><td class="n">${R(vTot(v))}</td>
    <td><span class="acts"><button class="btn ghost small" data-ed="vendas" data-id="${esc(v.id)}">Editar</button><button class="btn danger small" data-del="vendas" data-id="${esc(v.id)}">Excluir</button></span></td></tr>`).join('')
    :`<tr><td colspan="7" class="empty">Nenhuma venda em ${ymNome(vdYM)}. Lance a primeira em "Nova venda".</td></tr>`}</tbody>${L.length?`<tfoot><tr><td colspan="5">Total do mês</td><td class="n">${R(tot)}</td><td></td></tr></tfoot>`:''}`;
  const dev={}; V.filter(v=>!v.pago).forEach(v=>{const k=(v.cliente||'').trim()||'Sem nome'; (dev[k]=dev[k]||[]).push(v);});
  const ds=Object.entries(dev).map(([k,l])=>[k,l.sort((a,b)=>(a.data||'').localeCompare(b.data||'')),l.reduce((t,v)=>t+vTot(v),0)]).sort((a,b)=>b[2]-a[2]);
  const totF=ds.reduce((t,x)=>t+x[2],0);
  $('#fiadoTot').innerHTML=ds.length?`<span>Total a receber</span><b class="num gold">${R(totF)}</b><span class="sub2">${ds.length} cliente${ds.length===1?'':'s'}</span>`:'';
  $('#tblDeve').innerHTML=ds.length?ds.map(([k,l,t])=>`<div class="fic"><div class="hd"><b>${esc(k)}</b><span class="num gold">${R(t)}</span><button class="btn ghost small" data-quita="${esc(k)}">Recebi tudo</button></div>
    <ul>${l.map(v=>`<li><span class="num">${fmtD(v.data).slice(0,5)}</span><span class="st ${/leite/i.test(v.produto||'')?'leite':'queijo'}">${esc(v.produto||'')}</span><span class="num v">${R(vTot(v))}</span><span class="acts"><button class="btn small" data-pagou="${esc(v.id)}">Pagou</button><button class="btn ghost small" data-ed="vendas" data-id="${esc(v.id)}">Editar</button><button class="btn danger small" data-del="vendas" data-id="${esc(v.id)}">Excluir</button></span></li>`).join('')}</ul></div>`).join('')
    :'<p class="empty">Ninguém devendo.</p>';
  const CL=[...(S.clientes||[])].sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'));
  $('#cliList').innerHTML=[...new Set([...CL.map(c=>c.nome),...V.map(v=>v.cliente)].filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('');
  const norm=x=>(x||'').trim().toLowerCase();
  $('#cliCards').innerHTML=CL.length?CL.map(c=>{const vs=V.filter(v=>norm(v.cliente)===norm(c.nome)); const deve=vs.filter(v=>!v.pago).reduce((t,v)=>t+vTot(v),0); const tel=(c.telefone||'').replace(/\D/g,'');
    return `<div class="fic"><div class="hd"><b>${esc(c.nome)}</b>${deve>0.004?`<span class="num gold">deve ${R(deve)}</span>`:'<span class="sub2">em dia</span>'}<span class="acts"><button class="btn ghost small" data-ed="clientes" data-id="${esc(c.id)}">Editar</button><button class="btn danger small" data-del="clientes" data-id="${esc(c.id)}">Excluir</button></span></div>
    <div class="sub2" style="margin-top:4px">${[c.produto||'Leite e queijo',tel.length>=8?`<a href="tel:${tel}">${esc(c.telefone)}</a>`:'',c.endereco?esc(c.endereco):'',vs.length?vs.length+' compra'+(vs.length===1?'':'s')+' · total '+R(vs.reduce((t,v)=>t+vTot(v),0)):'nenhuma compra ainda'].filter(Boolean).join(' · ')}</div>
    <div style="margin-top:8px"><button class="btn ghost small" data-fiacli="${esc(c.nome)}">Lançar fiado</button></div></div>`;}).join('')
    :'<p class="empty">Nenhum cliente cadastrado.</p>';
  const meses=[...Array(12)].map((_,i)=>ymAdd(today().slice(0,7),i-11));
  const rows=meses.map(ym=>({ym,v:lucroMes(ym)}));
  const mx=Math.max(...rows.map(r=>Math.abs(r.v)),1);
  $('#vdBars').innerHTML=rows.some(r=>r.v)?rows.map(r=>`<div class="bar" style="grid-template-columns:minmax(0,120px) minmax(0,1fr) auto;cursor:pointer" data-vdym="${r.ym}"><span style="text-transform:capitalize;white-space:nowrap">${MESES[+r.ym.slice(5)-1]} ${r.ym.slice(2,4)}</span><div class="track"><div class="fill" style="width:${(Math.abs(r.v)/mx*100).toFixed(1)}%;${r.v<0?'background:var(--down)':''}"></div></div><span class="num ${cls(r.v)}" style="text-align:right;white-space:nowrap">${R(r.v)}</span></div>`).join(''):'<p class="empty">Nada lançado nos últimos 12 meses.</p>';
  renderAnimais();
  vPrev();
}
function vPrev(){const q=+$('#vQtd').value, p=+$('#vPreco').value; $('#vTotal').textContent=q>0&&p>0?'Total: '+R(Math.round(q*p*100)/100):'';}
function vSugere(){const pr=$('#vProd').value.trim().toLowerCase(); const ult=(S.vendas||[]).filter(v=>(v.produto||'').toLowerCase()===pr).sort((a,b)=>(b.data||'').localeCompare(a.data||''))[0];
  if(ult){$('#vUn').value=ult.un||'un'; $('#vPreco').value=ult.preco;} else {$('#vUn').value=pr==='leite'?'L':pr==='queijo'?'kg':'un';} vPrev();}
$('#vProd').addEventListener('change',vSugere);
['vQtd','vPreco'].forEach(i=>$('#'+i).addEventListener('input',vPrev));
$('#vdPrev').addEventListener('click',()=>{vdYM=ymAdd(vdYM,-1);renderVendas();});
$('#vdNext').addEventListener('click',()=>{vdYM=ymAdd(vdYM,1);renderVendas();});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-vdym]'); if(b){vdYM=b.dataset.vdym;renderVendas();return;}
  const q=e.target.closest('[data-quita]'); if(!q) return;
  if(q.dataset.armed!=='1'){q.dataset.armed='1';q.textContent='Confirmar?';setTimeout(()=>{if(q.isConnected){q.dataset.armed='';q.textContent='Recebi tudo';}},3000);return;}
  const k=q.dataset.quita; q.disabled=true;
  try{for(const v of S.vendas.filter(v=>!v.pago&&(((v.cliente||'').trim()||'Sem nome')===k))){const {id,...d}=v; await store.put('vendas',id,{...d,pago:true});}}catch(err){alert(errTxt(err));}
});
document.addEventListener('change',async e=>{const k=e.target.closest('[data-vpago]'); if(!k) return;
  const v=S.vendas.find(x=>x.id===k.dataset.vpago); if(!v) return; const {id,...d}=v;
  try{await store.put('vendas',id,{...d,pago:k.checked});}catch(err){k.checked=!k.checked; alert(errTxt(err));}
});
$('#fVenda').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mVenda'); const data=$('#vData').value, produto=$('#vProd').value.trim(), qtd=+$('#vQtd').value, preco=+$('#vPreco').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){flash(m,'Escolha a data.');return;}
  if(!produto){flash(m,'Escreva o produto.');return;}
  if(!(qtd>0)){flash(m,'Informe a quantidade.');return;}
  if(!(preco>0)){flash(m,'Informe o preço.');return;}
  const d={data,produto:produto.slice(0,60),qtd,un:$('#vUn').value,preco,cliente:$('#vCli').value.trim().slice(0,80),pago:$('#vPago').value==='1'};
  const btn=e.target.querySelector('button[type=submit]'); btn.disabled=true;
  try{await store.add('vendas',d); flash(m,`Venda de ${R(vTot(d))} lançada${d.cliente?' para '+d.cliente:''}.`,true); $('#vQtd').value=''; $('#vCli').value=''; vdYM=data.slice(0,7); renderVendas();}
  catch(err){flash(m,errTxt(err));} finally{btn.disabled=false;}
});
$('#vData').value=today(); $('#fiData').value=today();
$('#fFiado').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mFiado'), cli=$('#fiCli').value.trim(), data=$('#fiData').value, v=+$('#fiValor').value;
  if(!cli){flash(m,'Escreva o nome do cliente.');return;} if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){flash(m,'Escolha o dia.');return;} if(!(v>0)){flash(m,'Informe o valor.');return;}
  const btn=e.target.querySelector('button[type=submit]'); btn.disabled=true;
  try{await store.add('vendas',{data,produto:$('#fiProd').value,valor:Math.round(v*100)/100,cliente:cli.slice(0,80),pago:false}); flash(m,`${$('#fiProd').value} de ${R(v)} no fiado de ${cli}.`,true); $('#fiValor').value='';}
  catch(err){flash(m,errTxt(err));} finally{btn.disabled=false;}
});
$('#fCli').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mCli'), nome=$('#clNome').value.trim().slice(0,80);
  if(!nome){flash(m,'Escreva o nome.');return;}
  if((S.clientes||[]).some(c=>(c.nome||'').trim().toLowerCase()===nome.toLowerCase())){flash(m,nome+' já está cadastrado.');return;}
  try{await store.add('clientes',{nome,telefone:$('#clTel').value.trim().slice(0,30),endereco:$('#clEnd').value.trim().slice(0,120),produto:$('#clProd').value}); flash(m,nome+' cadastrado.',true); ['clNome','clTel','clEnd'].forEach(i=>$('#'+i).value=''); $('#clProd').value='';}
  catch(err){flash(m,errTxt(err));}
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-fiacli]'); if(!b) return; const c=(S.clientes||[]).find(x=>x.nome===b.dataset.fiacli);
  $('#fiCli').value=b.dataset.fiacli; if(c&&c.produto) $('#fiProd').value=c.produto; $('#fFiado').scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>$('#fiValor').focus(),300);});
$('#fiCli').addEventListener('change',()=>{const c=(S.clientes||[]).find(x=>(x.nome||'').toLowerCase()===$('#fiCli').value.trim().toLowerCase()); if(c&&c.produto) $('#fiProd').value=c.produto;});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-pagou]'); if(!b) return;
  const v=S.vendas.find(x=>x.id===b.dataset.pagou); if(!v) return; const {id,...d}=v; b.disabled=true;
  try{await store.put('vendas',id,{...d,pago:true,pagoEm:today()});}catch(err){b.disabled=false; alert(errTxt(err));}
});

function lucroMes(ym){
  const lm=(S.leitemes||[]).find(x=>x.id==='lm-'+ym); const r=lm?+lm.recebido||0:0;
  const v=(S.vendas||[]).filter(x=>x.pago&&(x.data||'').slice(0,7)===ym).reduce((t,x)=>t+vTot(x),0);
  const g=(S.chgastos||[]).filter(x=>x.mes===ym).reduce((t,x)=>t+(+x.valor||0),0);
  return Math.round((r+v-g)*100)/100;
}
let lSel=null;
function renderLeite(PR,LM){
  const [y,m]=vdYM.split('-').map(Number), n=new Date(y,m,0).getDate(), pad=(new Date(y,m-1,1).getDay()+6)%7;
  const LT=PR.leite||{}, PG=PR.pegou||{}, k=ds=>'d'+ds.slice(8,10);
  let h=['S','T','Q','Q','S','S','D'].map(d=>`<span class="sub2" style="text-align:center">${d}</span>`).join('')+'<span></span>'.repeat(pad);
  for(let d=1;d<=n;d++){const ds=vdYM+'-'+String(d).padStart(2,'0');
    const lv=LT[k(ds)]; h+=`<button type="button" data-ldia="${ds}" class="${+lv?'tem':''}" aria-pressed="${lSel===ds}">${d}<b>${lv!=null?NQ.format(+lv):'·'}</b></button>`;}
  $('#leiteDias').innerHTML=h;
  if(!lSel||lSel.slice(0,7)!==vdYM){ lSel=vdYM===today().slice(0,7)?today():vdYM+'-01'; }
  $('#lData').value=lSel; $('#lLitros').value=LT[k(lSel)]??''; $('#lPegou').value=PG[k(lSel)]??'';
  $('#lmRec').value=LM.recebido!=null?LM.recebido:''; $('#lmFalta').value=LM.faltou!=null?LM.faltou:'';
  const peg=Object.values(PG).reduce((t,x)=>t+(+x||0),0);
  $('#leiteSub').textContent='Litros tirados por dia. Toque num dia para lançar ou corrigir.'+(peg?` Retirado para casa: ${NQ.format(peg)} L.`:'');
}
function renderChG(G){
  $('#tblChG').innerHTML=G.length?`<tbody>${G.map(g=>`<tr><td>${esc(g.descricao)}</td><td class="n">${R(+g.valor)}</td><td style="width:1%"><span class="acts"><button class="btn ghost small" data-ed="chgastos" data-id="${esc(g.id)}">Editar</button><button class="btn danger small" data-del="chgastos" data-id="${esc(g.id)}">Excluir</button></span></td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="n">${R(G.reduce((t,x)=>t+(+x.valor||0),0))}</td><td></td></tr></tfoot>`
    :`<tbody><tr><td class="empty">Nenhuma despesa em ${ymNome(vdYM)}.</td></tr></tbody>`;
  $('#cgList').innerHTML=[...new Set((S.chgastos||[]).map(g=>g.descricao))].slice(0,50).map(f=>`<option value="${esc(f)}">`).join('');
}
function renderAnimais(){
  const A=[...(S.animais||[])].sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'));
  $('#animList').innerHTML=A.length?A.map(a=>{const cr=[...(a.crias||[])].sort((x,y)=>(y.data||'').localeCompare(x.data||''));
    return `<div class="anim"><div class="hd"><b>${esc(a.nome)}</b><span class="acts"><button class="btn ghost small" data-ed="animais" data-id="${esc(a.id)}">Editar</button><button class="btn danger small" data-del="animais" data-id="${esc(a.id)}">Excluir</button></span></div>${a.obs?`<div class="sub2">${esc(a.obs)}</div>`:''}
    ${cr.length?`<ul>${cr.map(c=>`<li><span>${c.data?fmtD(c.data):'sem data'} · ${esc(c.genero||'gênero ?')}${c.filhote?' · '+esc(c.filhote):''}</span><button class="linkbtn" data-delcria="${esc(a.id)}" data-cria="${esc(JSON.stringify(c))}">remover</button></li>`).join('')}</ul>`:'<div class="sub2">Nenhuma cria registrada</div>'}</div>`;}).join('')
    :'<p class="empty">Nenhum animal cadastrado.</p>';
  $('#animDl').innerHTML=A.map(a=>`<option value="${esc(a.nome)}">`).join('');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ldia]'); if(!b) return; lSel=b.dataset.ldia; renderVendas(); $('#lLitros').focus();});
$('#lData').addEventListener('change',()=>{const v=$('#lData').value; if(/^\d{4}-\d{2}-\d{2}$/.test(v)){lSel=v; vdYM=v.slice(0,7); renderVendas();}});
$('#fLeite').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mLeite'), d=$('#lData').value, l=$('#lLitros').value, pg=$('#lPegou').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){flash(m,'Escolha o dia.');return;}
  const id='pm-'+d.slice(0,7), ex=(S.producao||[]).find(x=>x.id===id), kk='d'+d.slice(8,10);
  const o={mes:d.slice(0,7),leite:{...((ex&&ex.leite)||{})},pegou:{...((ex&&ex.pegou)||{})}};
  if((l!==''&&!(+l>=0))||(pg!==''&&!(+pg>=0))){flash(m,'Litros inválidos.');return;}
  if(l!=='') o.leite[kk]=+l; else delete o.leite[kk];
  if(pg!=='') o.pegou[kk]=+pg; else delete o.pegou[kk];
  try{
    await store.put('producao',id,o); flash(m,l===''&&pg===''?'Dia '+fmtD(d)+' limpo.':`${fmtD(d)}: ${l!==''?NQ.format(+l)+' L':''} salvo.`,true);
    const nx=new Date(d+'T12:00:00'); nx.setDate(nx.getDate()+1); const ns=nx.toISOString().slice(0,10); if(l!==''&&ns.slice(0,7)===vdYM){lSel=ns; renderVendas(); $('#lLitros').focus();}
  }catch(err){flash(m,errTxt(err));}
});
$('#fLeiteMes').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mLeiteMes'), r=$('#lmRec').value, f=$('#lmFalta').value;
  const o={mes:vdYM}; if(r!=='') o.recebido=+r; if(f!=='') o.faltou=+f;
  try{await store.put('leitemes','lm-'+vdYM,o); flash(m,'Fechamento de '+ymNome(vdYM)+' salvo.',true);}catch(err){flash(m,errTxt(err));}
});
$('#fChG').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mChG'), desc=$('#cgDesc').value.trim(), v=+$('#cgValor').value;
  if(!desc){flash(m,'Escreva a descrição.');return;} if(!(v>0)){flash(m,'Informe o valor.');return;}
  try{await store.add('chgastos',{mes:vdYM,descricao:desc.slice(0,120),valor:v}); flash(m,`${desc} lançada em ${ymNome(vdYM)}.`,true); $('#cgDesc').value=''; $('#cgValor').value='';}catch(err){flash(m,errTxt(err));}
});
$('#fCria').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#mCria'), nome=$('#crAnim').value.trim(); if(!nome){flash(m,'Escreva o nome do animal.');return;}
  const a=(S.animais||[]).find(x=>(x.nome||'').toLowerCase()===nome.toLowerCase());
  const c={data:$('#crData').value||'',genero:$('#crGen').value,filhote:$('#crFil').value.trim().slice(0,60)};
  const temCria=c.data||c.genero||c.filhote;
  try{
    if(a){ if(!temCria){flash(m,nome+' já está cadastrada.');return;} const {id,...d}=a; await store.put('animais',id,{...d,crias:[...(a.crias||[]),c]}); }
    else { await store.add('animais',{nome:nome.slice(0,60),crias:temCria?[c]:[]}); }
    flash(m,temCria?'Cria de '+nome+' salva.':nome+' cadastrada.',true); ['crData','crFil'].forEach(i=>$('#'+i).value=''); $('#crGen').value='';
  }catch(err){flash(m,errTxt(err));}
});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-delcria]'); if(!b) return;
  if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='confirmar?';setTimeout(()=>{if(b.isConnected){b.dataset.armed='';b.textContent='remover';}},3000);return;}
  const a=S.animais.find(x=>x.id===b.dataset.delcria); if(!a) return; const alvo=b.dataset.cria; const {id,...d}=a;
  const cr=[...(a.crias||[])]; const i=cr.findIndex(c=>JSON.stringify(c)===alvo); if(i<0) return; cr.splice(i,1);
  try{await store.put('animais',id,{...d,crias:cr});}catch(err){alert(errTxt(err));}
});

/* ---------- Ocultar valores ---------- */
function setPriv(on){document.body.classList.toggle('priv',on);$('#privBtn').setAttribute('aria-pressed',on);$('#privBtn').textContent=on?'Mostrar valores':'Ocultar valores';try{localStorage.setItem('carteira-priv',on?'1':'');}catch(e){}}
$('#privBtn').addEventListener('click',()=>setPriv(!document.body.classList.contains('priv')));
try{setPriv(localStorage.getItem('carteira-priv')==='1');}catch(e){}

function chSeg(k){ if(k!=='fiado') k='main'; $('#chMain').hidden=k!=='main'; $('#chFiado').hidden=k!=='fiado';
  document.querySelectorAll('[data-chseg]').forEach(b=>{ if(b.closest('.chseg')) b.setAttribute('aria-pressed',b.dataset.chseg===k); });
  try{localStorage.setItem('carteira-chseg',k);}catch(e){} }
document.addEventListener('click',e=>{const b=e.target.closest('[data-chseg]'); if(!b) return; chSeg(b.dataset.chseg); window.scrollTo({top:0});});
try{chSeg(localStorage.getItem('carteira-chseg')||'main');}catch(e){chSeg('main');}

/* ---------- Senha de acesso (PIN) ----------
   Trava de tela: o site já só abre para a conta do dono; o PIN impede que alguém com o celular destravado veja os dados.
   Guarda só o hash PBKDF2 com sal, nunca o PIN. Bloqueia após 5 min sem uso e espera após 5 erros. */
let PIN=undefined, lockMode='load';
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function pinHash(pin,salt,iter){
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:iter,hash:'SHA-256'},k,256);
  return hex(bits);
}
function eqStr(a,b){ if(a.length!==b.length) return false; let r=0; for(let i=0;i<a.length;i++) r|=a.charCodeAt(i)^b.charCodeAt(i); return r===0; }
const IDLE=5*60*1000; let lastAct=Date.now();
function unlocked(){ try{const t=+sessionStorage.getItem('carteira-unl')||0; return Date.now()-t<IDLE;}catch(e){return false;} }
function touch(){ lastAct=Date.now(); if(!document.body.classList.contains('locked')) try{sessionStorage.setItem('carteira-unl',String(lastAct));}catch(e){} }
['click','keydown','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,touch,{passive:true}));
setInterval(()=>{ if(PIN&&!document.body.classList.contains('locked')&&Date.now()-lastAct>IDLE) lockShow('enter'); },15000);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&PIN&&!unlocked()) lockShow('enter'); });
function lockShow(m){
  lockMode=m; const L=$('#lockScr'); L.hidden=false; document.body.classList.add('locked');
  const t={menu:['Senha de acesso',0,0,''],verify:['Digite a senha atual',1,0,'Continuar'],load:['Carregando…',0,0,''],enter:['Digite sua senha para entrar',1,0,'Entrar'],create:['Crie uma senha de 4 a 8 números',1,1,'Salvar senha'],change:['Digite a nova senha (4 a 8 números)',1,1,'Salvar senha'],remove:['Digite a senha atual para remover',1,0,'Remover senha']}[m];
  $('#lockSub').textContent=t[0]; $('#lockPin').hidden=!t[1]; $('#lockPin2').hidden=!t[2]; $('#lockBtn').hidden=!t[3]; $('#lockBtn').textContent=t[3];
  $('#lockCancel').hidden=!['create','change','remove','menu','verify'].includes(m); $('#lockMenu').hidden=m!=='menu'; $('#lockMsg').textContent=''; $('#lockMsg').className='msg';
  $('#lockPin').value=''; $('#lockPin2').value=''; bioUI(); if(t[1]&&!(bioOk&&bioId()&&m==='enter')) setTimeout(()=>$('#lockPin').focus(),50);
}
/* Rosto/digital (WebAuthn): só aparece se o aparelho tiver Face ID/biometria e o navegador permitir aqui.
   A chave fica no próprio aparelho; o site guarda só o id dela neste navegador. É uma trava de tela, como o PIN. */
const BIOK='carteira-bio';
const bioId=()=>{try{return localStorage.getItem(BIOK)||'';}catch(e){return '';}};
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
let bioOk=false;
(async()=>{try{bioOk=!!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());}catch(e){bioOk=false;} bioUI();})();
function bioUI(){ $('#bioBtn').hidden=!(bioOk&&bioId()&&PIN&&lockMode==='enter'); $('#bioSetup').hidden=!(bioOk&&PIN); $('#bioSetup').textContent=bioId()?'Desativar rosto ou digital neste aparelho':'Ativar entrada por rosto ou digital'; }
function bioErr(e){ const n=e&&e.name; return n==='NotAllowedError'?'Cancelado ou não reconhecido. Tente de novo ou use a senha.':(n==='SecurityError'||n==='NotSupportedError')?'Este navegador não deixa usar rosto ou digital aqui. Use a senha.':'Não deu certo. Use a senha.'; }
async function bioCreate(){
  const c=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'Controle Financeiro'},
    user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'Higor',displayName:'Controle Financeiro'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},timeout:60000,attestation:'none'}});
  try{localStorage.setItem(BIOK,b64(c.rawId));}catch(e){}
}
async function bioGet(){
  const a=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:'public-key',id:unb64(bioId()),transports:['internal']}],userVerification:'required',timeout:60000}});
  return !!(a&&a.response&&new Uint8Array(a.response.authenticatorData)[32]&4); // bit UV: o rosto/digital foi conferido
}
$('#bioBtn').addEventListener('click',async()=>{ const m=$('#lockMsg'); m.className='msg err';
  try{ if(await bioGet()){ setTries({n:0,t:0}); lockHide(); } else m.textContent='Rosto ou digital não conferido. Use a senha.'; }catch(e){ m.textContent=bioErr(e); } });
$('#bioSetup').addEventListener('click',async()=>{ const m=$('#lockMsg');
  if(bioId()){ try{localStorage.removeItem(BIOK);}catch(e){} m.className='msg ok'; m.textContent='Entrada por rosto ou digital desativada neste aparelho.'; bioUI(); return; }
  try{ await bioCreate(); m.className='msg ok'; m.textContent='Pronto! Da próxima vez, toque em "Entrar com rosto ou digital".'; }catch(e){ m.className='msg err'; m.textContent=bioErr(e); } bioUI(); });
function lockHide(){ $('#lockScr').hidden=true; document.body.classList.remove('locked'); try{sessionStorage.setItem('carteira-unl',String(Date.now()));}catch(e){} lastAct=Date.now(); }
function pinUI(){ $('#pinBtn').textContent=PIN?'Senha':'Criar senha'; $('#lockNow').hidden=!PIN; }
function pinSet(d){
  const first=PIN===undefined; PIN=d&&d.hash&&d.salt?d:null; pinUI();
  if(first){ if(PIN&&!unlocked()) lockShow('enter'); else lockHide(); }
  else if(!PIN&&lockMode==='enter') lockHide();
}
async function pinSave(d){ if(db){ await store.put('acesso','pin',d); } else { try{ if(d) localStorage.setItem('carteira-pin',JSON.stringify(d)); else localStorage.removeItem('carteira-pin'); }catch(e){} pinSet(d); } }
async function pinDel(){ try{localStorage.removeItem(BIOK);}catch(e){} if(db){ await store.del('acesso','pin'); } else { await pinSave(null); } }
function tries(){ try{return JSON.parse(localStorage.getItem('carteira-pin-err')||'{"n":0,"t":0}');}catch(e){return {n:0,t:0};} }
function setTries(o){ try{localStorage.setItem('carteira-pin-err',JSON.stringify(o));}catch(e){} }
async function pinOk(v){
  const tr=tries(); if(tr.t>Date.now()){ throw new Error('espera'); }
  const ok=eqStr(await pinHash(v,PIN.salt,PIN.iter||150000),PIN.hash);
  if(ok) setTries({n:0,t:0}); else { const n=tr.n+1; setTries({n,t:n>=5?Date.now()+Math.min(30*2**(n-5),900)*1000:0}); }
  return ok;
}
$('#lockForm').addEventListener('submit',async e=>{
  e.preventDefault(); const m=$('#lockMsg'), v=$('#lockPin').value.trim(), v2=$('#lockPin2').value.trim(); m.className='msg err';
  if(!/^\d{4,8}$/.test(v)){ m.textContent='A senha tem de 4 a 8 números.'; return; }
  $('#lockBtn').disabled=true;
  try{
    if(lockMode==='enter'||lockMode==='remove'||lockMode==='verify'){
      let ok; try{ ok=await pinOk(v); }catch(er){ const s=Math.ceil((tries().t-Date.now())/1000); m.textContent=`Muitas tentativas. Espere ${s} segundos.`; return; }
      if(!ok){ const tr=tries(); m.textContent=tr.t>Date.now()?`Senha errada. Espere ${Math.ceil((tr.t-Date.now())/1000)} segundos.`:`Senha errada. ${5-tr.n} tentativa${5-tr.n===1?'':'s'} antes de esperar.`; $('#lockPin').value=''; return; }
      if(lockMode==='remove'){ await pinDel(); lockHide(); } else if(lockMode==='verify'){ lockShow('change'); } else lockHide();
    } else {
      if(v!==v2){ m.textContent='As duas senhas não são iguais.'; return; }
      const salt=hex(crypto.getRandomValues(new Uint8Array(16))), iter=150000;
      await pinSave({salt,iter,hash:await pinHash(v,salt,iter),criada:today()}); lockHide();
    }
  }catch(err){ m.textContent=errTxt(err); }
  finally{ $('#lockBtn').disabled=false; }
});
$('#lockCancel').addEventListener('click',lockHide);
document.addEventListener('click',e=>{const b=e.target.closest('[data-lk]'); if(b) lockShow(b.dataset.lk);});
$('#lockNow').addEventListener('click',()=>{ try{sessionStorage.removeItem('carteira-unl');}catch(e){} lockShow('enter'); });
$('#pinBtn').addEventListener('click',()=>{
  if(!PIN){ lockShow('create'); return; }
  lockShow('menu');
});
lockShow('load');
setTimeout(()=>{ if(PIN===undefined) pinSet(null); },4000);

/* ---------- Veículos: licenciamento e IPVA por ano ---------- */
let vcAno=+today().slice(0,4);
const veicNome=p=>{const v=(S.veiculos||[]).find(x=>x.placa===p||x.id===p); return v?v.nome:p;};
const placaOk=p=>/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p);
function renderVeic(){
  const VS=[...(S.veiculos||[])].sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'));
  const LS=S.licenc||[]; const hoje=today();
  $('#vcAno').textContent=vcAno;
  const L=LS.filter(l=>+l.ano===vcAno).sort((a,b)=>(a.pago===b.pago?0:a.pago?1:-1)||(a.venc||'9').localeCompare(b.venc||'9')||veicNome(a.placa).localeCompare(veicNome(b.placa),'pt'));
  const tot=L.reduce((t,l)=>t+(+l.valor||0),0), pg=L.filter(l=>l.pago).reduce((t,l)=>t+(+l.valor||0),0);
  const late=L.filter(l=>!l.pago&&l.venc&&l.venc<hoje);
  const prox=L.filter(l=>!l.pago&&l.venc&&l.venc>=hoje).sort((a,b)=>a.venc.localeCompare(b.venc))[0];
  $('#vcKpis').innerHTML=`
    <div class="ckpi"><div class="l">Total de ${vcAno}</div><div class="v">${R(tot)}</div><div class="s">${L.length} veículo${L.length===1?'':'s'} com valor</div></div>
    <div class="ckpi"><div class="l">Pago</div><div class="v up">${R(pg)}</div><div class="s">${L.filter(l=>l.pago).length} pago${L.filter(l=>l.pago).length===1?'':'s'}</div></div>
    <div class="ckpi"><div class="l">Falta pagar</div><div class="v ${tot-pg>0.004?'down':''}">${R(tot-pg)}</div><div class="s">${prox?'próximo: '+esc(veicNome(prox.placa))+' em '+fmtD(prox.venc):'nada com data à frente'}</div></div>
    <div class="ckpi"><div class="l">Vencidos</div><div class="v ${late.length?'down':''}">${late.length}</div><div class="s">${late.length?R(late.reduce((t,l)=>t+(+l.valor||0),0)):'nenhum atrasado'}</div></div>`;
  $('#tblLic').innerHTML=L.length?`<thead><tr><th>Veículo</th><th>Vencimento</th><th class="n">Valor</th><th></th></tr></thead><tbody>${L.map(l=>{const st=l.pago?'':(l.venc&&l.venc<hoje?' <span class="tag late">vencido</span>':'');
      return `<tr class="${l.pago?'pago':''}"><td><label style="display:inline-flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" class="ckpago" data-lpago="${esc(l.id)}" ${l.pago?'checked':''} aria-label="Marcar ${esc(veicNome(l.placa))} como pago">${esc(veicNome(l.placa))}</b></label> <span class="sub2">${esc(l.placa)}</span></td><td>${l.venc?fmtD(l.venc):'—'}${st}${l.pago&&l.pagoEm?' <span class="sub2">pago '+fmtD(l.pagoEm)+'</span>':''}</td><td class="n">${R(+l.valor||0)}</td><td style="width:1%"><span class="acts"><button class="btn ghost small" data-ed="licenc" data-id="${esc(l.id)}">Editar</button><button class="btn danger small" data-del="licenc" data-id="${esc(l.id)}">Excluir</button></span></td></tr>`;}).join('')}</tbody><tfoot><tr><td>Total</td><td></td><td class="n">${R(tot)}</td><td></td></tr></tfoot>`
    :`<tbody><tr><td class="empty">Nenhum pagamento lançado em ${vcAno}.</td></tr></tbody>`;
  const anos=[...new Set(LS.map(l=>+l.ano))].sort(); const rows=anos.map(a=>({a,v:LS.filter(l=>+l.ano===a).reduce((t,l)=>t+(+l.valor||0),0)})); const mx=Math.max(...rows.map(r=>r.v),1);
  $('#vcBars').innerHTML=rows.length?rows.map(r=>`<div class="bar" style="grid-template-columns:minmax(0,60px) minmax(0,1fr) auto;cursor:pointer" data-vcano="${r.a}" title="Abrir ${r.a}"><span>${r.a}</span><div class="track"><div class="fill" style="width:${(r.v/mx*100).toFixed(1)}%"></div></div><span class="num" style="text-align:right;white-space:nowrap">${R(r.v)}</span></div>`).join(''):'<p class="empty">Nenhum pagamento lançado.</p>';
  $('#tblVeic').innerHTML=VS.length?`<thead><tr><th>Veículo</th><th>Placa</th><th>RENAVAM</th><th></th></tr></thead><tbody>${VS.map(v=>`<tr><td><b>${esc(v.nome)}</b>${v.obs?' <span class="sub2">'+esc(v.obs)+'</span>':''}</td><td>${esc(v.placa)}</td><td>${esc(v.renavam||'—')}</td><td style="width:1%"><span class="acts"><button class="btn ghost small" data-ed="veiculos" data-id="${esc(v.id)}">Editar</button><button class="btn danger small" data-del="veiculos" data-id="${esc(v.id)}">Excluir</button></span></td></tr>`).join('')}</tbody>`
    :`<tbody><tr><td class="empty">Nenhum veículo cadastrado.</td></tr></tbody>`;
  const sel=$('#lcVeic'), cur=sel.value; sel.innerHTML=VS.map(v=>`<option value="${esc(v.placa)}">${esc(v.nome)} · ${esc(v.placa)}</option>`).join(''); if(cur) sel.value=cur;
  if(!$('#lcAno').value) $('#lcAno').value=vcAno;
}
$('#vcPrev').addEventListener('click',()=>{vcAno--;$('#lcAno').value=vcAno;renderVeic();});
$('#vcNext').addEventListener('click',()=>{vcAno++;$('#lcAno').value=vcAno;renderVeic();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-vcano]'); if(b){vcAno=+b.dataset.vcano;$('#lcAno').value=vcAno;renderVeic();$('#vcAno').scrollIntoView({behavior:'smooth',block:'center'});}});
document.addEventListener('change',async e=>{const k=e.target.closest('[data-lpago]'); if(!k) return;
  const l=(S.licenc||[]).find(x=>x.id===k.dataset.lpago); if(!l) return; const {id,...d}=l;
  try{await store.put('licenc',id,{...d,pago:k.checked,pagoEm:k.checked?today():null});}catch(err){k.checked=!k.checked; alert(errTxt(err));}
});
$('#fVeic').addEventListener('submit',async e=>{e.preventDefault(); const m=$('#mVeic');
  const nome=$('#veNome').value.trim(), placa=up($('#vePlaca').value.replace(/[\s-]/g,'')), ren=$('#veRen').value.replace(/\D/g,'');
  if(!nome){flash(m,'Informe o nome do veículo.');return;} if(!placaOk(placa)){flash(m,'Placa inválida. Use o formato ABC1234 ou ABC1D23.');return;}
  const ex=(S.veiculos||[]).find(v=>v.id===placa);
  try{await store.put('veiculos',placa,{...(ex?(({id,...r})=>r)(ex):{}),nome,placa,renavam:ren||(ex&&ex.renavam)||null}); flash(m,ex?`${nome} atualizado.`:`${nome} cadastrado.`,true); $('#veNome').value='';$('#vePlaca').value='';$('#veRen').value='';}
  catch(err){flash(m,errTxt(err));}
});
$('#fLic').addEventListener('submit',async e=>{e.preventDefault(); const m=$('#mLic');
  const placa=$('#lcVeic').value, ano=Math.round(+$('#lcAno').value), venc=$('#lcVenc').value||null, valor=+$('#lcValor').value, pago=$('#lcPago').value==='1';
  if(!placa){flash(m,'Cadastre o veículo primeiro.');return;} if(!(ano>=2000&&ano<=2100)){flash(m,'Ano inválido.');return;} if(!(valor>0)){flash(m,'Informe o valor.');return;}
  const id='lv-'+placa+'-'+ano, ex=(S.licenc||[]).find(l=>l.id===id);
  try{await store.put('licenc',id,{...(ex?(({id,...r})=>r)(ex):{}),placa,ano,venc,valor,pago,pagoEm:pago?((ex&&ex.pagoEm)||today()):null}); flash(m,`${veicNome(placa)} ${ano} salvo.`,true); vcAno=ano; $('#lcValor').value='';$('#lcVenc').value=''; renderVeic();}
  catch(err){flash(m,errTxt(err));}
});

/* ---------- Abas ---------- */
const TABS=['resumo','carteira','dividendos','aporte','lancar','cartoes','contas','chacara','veiculos'];
function go(t){ if(t==='fiado'){t='chacara'; chSeg('fiado');} if(!TABS.includes(t)) t='resumo';
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==t);
  $('#kpis').hidden=(t==='contas'||t==='cartoes'||t==='chacara'||t==='veiculos');
  try{localStorage.setItem('carteira-tab',t);}catch(e){}
  if(matchMedia('(max-width:640px)').matches&&go.ready) window.scrollTo({top:0});
  go.ready=true;
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.tab)));
let start=(location.hash||'').slice(1); if(!TABS.includes(start)){try{start=localStorage.getItem('carteira-tab')||'resumo';}catch(e){start='resumo';}}
go(start);
$('#oData').value=today(); $('#dData').value=today(); $('#gData').value=today();
$('#gCat').innerHTML=CATS.map(c=>`<option>${c}</option>`).join('');
$('#ctCat').innerHTML=CCATS.map(c=>`<option>${c}</option>`).join(''); $('#ctM').value=today().slice(0,7);
modOptions($('#oMod')); modOptions($('#iCls'),true); syncOpForm(); syncIndForm();
boot();
})();
