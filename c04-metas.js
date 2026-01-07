(function () {
  "use strict";

  // --- OUVINTE PARA ABRIR VIA HUB ---
  window.addEventListener('c04_open_metas', () => {
      const painel = document.getElementById("c04-painel-metas");
      if (painel) painel.style.display = 'flex';
      else initMetasUI();
  });

  // --- Configurações ---
  const RELATORIOS = {
      CAIXA: { url: "https://clube04.com.br/digital/relatoriocaixa.php", target: "RelatorioCaixaN001.php", btn: ".btn-primary" },
      PRODUTO: { url: "https://clube04.com.br/digital/relproduto.php", target: "RelatorioProdutoN001.php", btn: "#buttonbuscarRelatorioProduto" },
      PRODUCAO: { url: "https://clube04.com.br/digital/relproducaovenda.php", target: "RelatorioProducaoVendaN002.php", btn: "#buttonbuscarRelatorioProducaoVenda" },
      VENDA: { url: "https://clube04.com.br/digital/relvendafechada.php", target: "RelatorioVendaFechadaN001.php", btn: "#buttonbuscarVendaFechada" }
  };

  const INDICADORES = [
    { key: "fat_total",           label: "FATURAMENTO TOTAL (LÍQUIDO)",   type: "currency" },
    { key: "qtd_serv_agend",      label: "QTD SERVIÇOS AGENDADOS",         type: "int" },
    { key: "qtd_banho_avulso",    label: "QTD BANHO AVULSO",               type: "int" },
    { key: "qtd_tosa_avulsa",     label: "QTD TOSA AVULSA",                type: "int" },
    { key: "fat_extras",          label: "FAT. SERVIÇOS EXTRAS",           type: "currency" },
    { key: "qtd_extras_avulsos",  label: "QTD SERV. EXTRAS AVULSOS",       type: "int" },
    { key: "qtd_pacotes_banho",   label: "QTD PACOTES BANHOS (VENDIDOS)",  type: "int" },
    { key: "fat_produtos_loja",   label: "FAT. PRODUTOS LOJA",             type: "currency" },
  ];

  // --- Sistema de Debug ---
  const Debugger = {
      logs: { caixa: [], vendas_analise: [], prod_banho: [], prod_tosa: [], prod_tecnico: [], prod_extras: [], auditoria_final: [], erros: [] },
      logItem: (section, item) => { if (Debugger.logs[section]) Debugger.logs[section].push(item); },
      logError: (msg) => { Debugger.logs.erros.push(msg); console.warn("⚠️ [Clube04 Script]:", msg); },
      clear: () => { for(let k in Debugger.logs) Debugger.logs[k] = []; console.clear(); },
      printAll: () => {
          console.clear();
          console.log("%c 🐞 RELATÓRIO DE DEBUG ", "background: #000; color: #0f0; font-weight: bold;");
          if(Debugger.logs.erros.length > 0) { console.group("❌ ERROS"); console.table(Debugger.logs.erros); console.groupEnd(); }
          // (Lógica de impressão mantida igual à v4.30)
          if(Debugger.logs.auditoria_final.length) console.table(Debugger.logs.auditoria_final);
      }
  };

  // --- CSS Injection (Sem GM_addStyle) ---
  const style = document.createElement('style');
  style.innerHTML = `#c04-painel-metas { position: fixed; top: 10%; left: 50%; transform: translateX(-50%); width: 480px; max-height: 85vh; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); z-index: 2147483647; display: none; font-family: 'Segoe UI', Tahoma, sans-serif; border: 1px solid #cbd5e1; flex-direction: column; overflow: hidden; } 
  #c04-header { background: #0f172a; color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none; }
  #c04-body { padding: 20px; overflow-y: auto; }
  .c04-row { display: flex; gap: 10px; margin-bottom: 15px; align-items: flex-end; } .c04-col { flex: 1; }
  .c04-label { display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; }
  .c04-input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; box-sizing: border-box; }
  .c04-btn { padding: 10px 16px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 13px; width: 100%; }
  .c04-btn-primary { background: #2563eb; color: #fff; } .c04-btn-primary:hover { background: #1d4ed8; }
  .c04-btn-success { background: #10b981; color: #fff; margin-top: 15px; } .c04-btn-success:hover { background: #059669; }
  .c04-btn-copied { background-color: #047857 !important; }
  #c04-status { margin: 10px 0; font-size: 12px; color: #475569; text-align: center; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; }
  .c04-status-error { background: #fee2e2 !important; color: #b91c1c !important; } .c04-status-success { background: #dcfce7 !important; color: #15803d !important; }
  .c04-alert-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 12px; margin-top: 15px; border-radius: 4px; font-size: 12px; color: #9a3412; display: none; }
  .c04-alert-category-header { font-weight: bold; color: #431407; background: #ffedd5; padding: 4px 8px; border-radius: 4px; margin-top: 10px; margin-bottom: 5px; font-size: 11px; text-transform: uppercase; }
  .c04-alert-item { display: block; margin-bottom: 4px; border-bottom: 1px solid #fed7aa; padding-bottom: 4px; }
  .c04-alert-action-footer { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #fdba74; font-weight: 600; color: #c2410c; }
  .c04-table { width: 100%; font-size: 13px; border-collapse: collapse; margin-top: 10px; } .c04-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #334155; } .c04-table td:last-child { text-align: right; font-weight: 700; color: #0f172a; }
  .c04-warning-tag { background: #fee2e2; color: #b91c1c; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 5px; font-weight: bold; }
  .c04-diff-info { display: block; font-size: 10px; font-weight: normal; margin-top: 2px; }
  .c04-diff-green { color: #16a34a; } .c04-diff-yellow { color: #ca8a04; font-weight: 700; } .c04-diff-orange { color: #ea580c; font-weight: 700; } .c04-diff-red { color: #dc2626; font-weight: 800; } .c04-diff-error { color: #b91c1c; font-weight: 800; }`;
  document.head.appendChild(style);

  // --- UI Creation ---
  function initMetasUI() {
      const mainDiv = document.createElement("div"); mainDiv.id = "c04-painel-metas";
      mainDiv.innerHTML = `
        <div id="c04-header"><span>Dashboard de Metas</span><button id="c04-close" style="background:none; border:none; color:#cbd5e1; cursor:pointer; font-size:24px; line-height:1;">×</button></div>
        <div id="c04-body">
            <div class="c04-row">
                <div class="c04-col"><label class="c04-label">Data Início</label><input type="date" id="c04-data-ini" class="c04-input"></div>
                <div class="c04-col" id="c04-container-fim" style="display:none;"><label class="c04-label">Data Fim</label><input type="date" id="c04-data-fim" class="c04-input"></div>
            </div>
            <label style="font-size:12px;color:#64748b;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="c04-periodo-check"> Buscar por período</label>
            <div style="margin-top: 15px;"><button id="c04-gerar" class="c04-btn c04-btn-primary">SINCRONIZAR DADOS</button></div>
            <div id="c04-status">Pronto.</div>
            <div id="c04-divergencia" class="c04-alert-box">
                <span class="c04-alert-title">⚠️ Alertas de Auditoria</span>
                <div id="c04-divergencia-msg"></div>
            </div>
            <div id="c04-resumo"></div>
            <button id="c04-copiar" class="c04-btn c04-btn-success" style="display:none;">COPIAR VALORES</button>
        </div>`;
      document.body.appendChild(mainDiv);
      
      setupLogic();
  }

  function setupLogic() {
      const elDataIni = document.getElementById("c04-data-ini"), elDataFim = document.getElementById("c04-data-fim"), elCheckPeriodo = document.getElementById("c04-periodo-check"), elStatus = document.getElementById("c04-status"), elResumo = document.getElementById("c04-resumo"), elBtnCopiar = document.getElementById("c04-copiar"), elDivAlert = document.getElementById("c04-divergencia"), elMsgAlert = document.getElementById("c04-divergencia-msg");
      
      const today = new Date().toISOString().split('T')[0];
      elDataIni.max = today; elDataFim.max = today;
      const cached = JSON.parse(localStorage.getItem("c04_cache_v4") || "{}");
      elDataIni.value = cached.ini || today; elDataFim.value = cached.fim || elDataIni.value;
      elCheckPeriodo.checked = cached.isPeriodo || false;
      if (elCheckPeriodo.checked) document.getElementById("c04-container-fim").style.display = "block";

      // Eventos
      document.getElementById("c04-close").onclick = () => document.getElementById("c04-painel-metas").style.display = 'none';
      elCheckPeriodo.onchange = (e) => { document.getElementById("c04-container-fim").style.display = e.target.checked ? "block" : "none"; if (!e.target.checked) elDataFim.value = elDataIni.value; };
      
      // DRAG
      const panel = document.getElementById("c04-painel-metas");
      const handle = document.getElementById("c04-header");
      let isDragging = false, startX, startY, initLeft, initTop;
      handle.onmousedown = (e) => { isDragging=true; startX=e.clientX; startY=e.clientY; initLeft=panel.offsetLeft; initTop=panel.offsetTop; };
      document.onmousemove = (e) => { if(isDragging) { panel.style.left = `${initLeft + e.clientX - startX}px`; panel.style.top = `${initTop + e.clientY - startY}px`; panel.style.transform='none'; }};
      document.onmouseup = () => isDragging=false;

      // PROCESSAMENTO (Mesma lógica da v4.30)
      document.getElementById("c04-gerar").onclick = async () => {
          Debugger.clear(); elDivAlert.style.display = 'none'; elBtnCopiar.style.display = 'none';
          elResumo.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;">⏳ Processando dados...</div>';
          const ini = elDataIni.value, fim = elCheckPeriodo.checked ? elDataFim.value : ini;
          localStorage.setItem("c04_cache_v4", JSON.stringify({ini, fim, isPeriodo:elCheckPeriodo.checked}));

          const dados = { fat_bruto: 0, fat_total: 0, qtd_serv_agend: 0, qtd_banho_avulso: 0, qtd_tosa_avulsa: 0, fat_extras: 0, qtd_extras_avulsos: 0, qtd_pacotes_banho: 0, fat_produtos_loja: 0 };
          const statusFlags = {}; const alertasBucket = { servicos: [], financeiro: [], caixa: [] };

          try {
              setStatus("📦 Analisando Vendas...", "info");
              const ifrProd = await createIfr(RELATORIOS.PRODUTO.url);
              let salesData = {banhos:0, tosas:0, extrasQtd:0, extrasFat:0, pacotesQtd:0, banhosTec:0, lojaFat:0, totalBruto:0};
              try {
                  await searchWithAjaxHook(ifrProd, ini, fim, RELATORIOS.PRODUTO.btn, RELATORIOS.PRODUTO.target, true);
                  salesData = extractSalesFromProduto(ifrProd.contentDocument);
                  dados.qtd_banho_avulso = salesData.banhos; dados.qtd_tosa_avulsa = salesData.tosas; dados.qtd_extras_avulsos = salesData.extrasQtd;
                  dados.qtd_pacotes_banho = salesData.pacotesQtd; dados.fat_produtos_loja += salesData.lojaFat; dados.fat_bruto = salesData.totalBruto;
              } finally { ifrProd.remove(); }

              setStatus("🐶 Verificando Produção...", "info");
              const ifrServ = await createIfr(RELATORIOS.PRODUCAO.url);
              let execData = {};
              try {
                  await searchProducaoAjax(ifrServ, ini, fim, '0', RELATORIOS.PRODUCAO.target);
                  const execNormal = extractExecutionFromProducao(ifrServ.contentDocument, 'normal');
                  await searchProducaoAjax(ifrServ, ini, fim, '1', RELATORIOS.PRODUCAO.target);
                  const execExtras = extractExecutionFromProducao(ifrServ.contentDocument, 'extra');
                  execData = { ...execNormal, ...execExtras };
                  dados.qtd_serv_agend = (salesData.banhos + salesData.tosas + salesData.banhosTec) + (execData.banhosPacoteExec + execData.tosasPacoteExec + execData.banhosParaTosarPacoteExec);
                  dados.fat_extras = execData.extrasExecValor;
              } finally { ifrServ.remove(); }

              // Auditoria
              const auditItem = (tipo, vendido, executado, valorVenda=0, valorExecutado=0, isCurrency=false) => {
                  const diff = vendido - executado;
                  const percent = vendido > 0 ? (diff/vendido)*100 : 0;
                  if (tipo === "Faturamento total") {
                      if (diff < -0.05) alertasBucket.financeiro.push(`<span class="c04-alert-item">❌ <b>${tipo}:</b> Líquido maior que Bruto!</span>`);
                      else if (percent > 5) alertasBucket.financeiro.push(`<span class="c04-alert-item" style="color:#b45309">⚠️ <b>${tipo}:</b> Dif: ${formatBRL(diff)} (${percent.toFixed(1)}%). Cuidado com descontos.</span>`);
                  } else {
                      if (diff > 0.05) {
                          const msg = `❌ <b>${tipo}:</b> Vendido ${isCurrency?formatBRL(vendido):vendido} > Feito ${isCurrency?formatBRL(executado):executado}`;
                          if(isCurrency || tipo.includes('Fat')) alertasBucket.financeiro.push(`<span class="c04-alert-item">${msg}</span>`);
                          else alertasBucket.servicos.push(`<span class="c04-alert-item">${msg}</span>`);
                      } else if (diff < -0.05) {
                          const msg = `⚠️ <b>${tipo}:</b> Feito ${isCurrency?formatBRL(executado):executado} > Vendido ${isCurrency?formatBRL(vendido):vendido}`;
                          if(isCurrency || tipo.includes('Fat')) alertasBucket.financeiro.push(`<span class="c04-alert-item">${msg}</span>`);
                          else alertasBucket.servicos.push(`<span class="c04-alert-item">${msg}</span>`);
                      }
                  }
                  Debugger.logItem('auditoria_final', { Categoria: tipo, Vendido: vendido, Executado: executado, Diff: diff });
                  return { diff, percent };
              };

              statusFlags.qtd_banho_avulso = auditItem("Banho Avulso", dados.qtd_banho_avulso, execData.banhosAvulsosExec);
              statusFlags.qtd_tosa_avulsa = auditItem("Tosa Avulsa", dados.qtd_tosa_avulsa, execData.tosasAvulsasExec);
              auditItem("Banho p/ Tosar", salesData.banhosTec, execData.banhosParaTosarExec);
              statusFlags.qtd_extras_avulsos = auditItem("Serviços Extras", dados.qtd_extras_avulsos, execData.extrasExec);
              statusFlags.qtd_serv_agend = auditItem("Qtd Serviços Agendados", dados.qtd_serv_agend, execData.totalQtdNormal);

              setStatus("🛍️ Loja...", "info");
              const ifrVenda = await createIfr(RELATORIOS.VENDA.url);
              try {
                  await searchWithAjaxHook(ifrVenda, ini, fim, RELATORIOS.VENDA.btn, RELATORIOS.VENDA.target, true);
                  await waitForTextInDoc(ifrVenda.contentDocument, "Centro de Estética:");
                  const tVenda = parseBRLStrict(findVal(ifrVenda.contentDocument, "Total:"));
                  const tEstetica = parseBRLStrict(findVal(ifrVenda.contentDocument, "Centro de Estética:"));
                  dados.fat_produtos_loja = tVenda - tEstetica;
              } finally { ifrVenda.remove(); }

              setStatus("💰 Caixa...", "info");
              const ifrCaixa = await createIfr(RELATORIOS.CAIXA.url);
              try {
                  const d1 = new Date(ini); d1.setDate(d1.getDate()-1);
                  const d2 = new Date(fim); d2.setDate(d2.getDate()+1);
                  await searchWithAjaxHook(ifrCaixa, d1.toISOString().split('T')[0], d2.toISOString().split('T')[0], RELATORIOS.CAIXA.btn, RELATORIOS.CAIXA.target);
                  const cx = extractCaixaData(ifrCaixa.contentDocument, ini, fim);
                  if (cx.total > 0) dados.fat_total = cx.total; else statusFlags.caixa = "zerado";
                  if (cx.alertas.length) alertasBucket.caixa.push(...cx.alertas);
                  statusFlags.fat_total = auditItem("Faturamento total", dados.fat_bruto, dados.fat_total, 0, 0, true);
                  statusFlags.fat_extras = { diff: salesData.extrasFat - execData.extrasExecValor, percent: salesData.extrasFat ? ((salesData.extrasFat - execData.extrasExecValor)/salesData.extrasFat)*100 : 0 };
              } finally { ifrCaixa.remove(); }

              // RENDER
              let htmlAlerts = "";
              if(alertasBucket.servicos.length) htmlAlerts += `<div class="c04-alert-category-header">🛠️ Execução de Serviços</div>${alertasBucket.servicos.join("")}<div class="c04-alert-action-footer">⚠️ Ação: Reforçar com a equipe o manuseio correto da fila de serviço e Caixa PDV.</div>`;
              if(alertasBucket.financeiro.length) htmlAlerts += `<div class="c04-alert-category-header">💰 Financeiro</div>${alertasBucket.financeiro.join("")}`;
              if(alertasBucket.caixa.length) htmlAlerts += `<div class="c04-alert-category-header">📦 Caixa & Operacional</div>${alertasBucket.caixa.join("")}`;
              
              if(htmlAlerts) { elMsgAlert.innerHTML = htmlAlerts; elDivAlert.style.display = "block"; }
              render(dados, statusFlags);
              setStatus("✅ Concluído!", "success");
              Debugger.printAll();

          } catch(e) { setStatus("❌ " + e.message, "error"); console.error(e); }
      };
  }

  // --- Funções Auxiliares (Simplificadas para caber) ---
  function setStatus(m, t) { const el = document.getElementById("c04-status"); el.textContent = m; el.className = t==='error'?'c04-status-error':t==='success'?'c04-status-success':''; }
  async function createIfr(u) { const f=document.createElement("iframe"); f.style.display="none"; f.src=u; document.body.appendChild(f); await new Promise(r=>f.onload=r); return f; }
  function parseBRLStrict(s) { const m = (s||"").match(/R\$\s*([\d\.]*,\d{2})/); return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : 0; }
  function formatBRL(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function parseIntSafe(s) { return parseInt((s||"0").replace(/\D/g,""), 10) || 0; }
  function findVal(d, l) { const e = Array.from(d.querySelectorAll("*")).find(x => x.innerText?.includes(l)); return e ? e.innerText.split(l)[1] : "0"; }
  async function waitForTextInDoc(doc, txt) { return new Promise(r=>{let c=0;const i=setInterval(()=>{if(doc.body.textContent.includes(txt)||c++>60){clearInterval(i);r();}},250);}); }
  
  function searchWithAjaxHook(ifr, i, f, btnSelector, targetUrl, forceExpand) {
      return new Promise((resolve, reject) => {
          const doc = ifr.contentDocument; const win = ifr.contentWindow;
          const elI = doc.getElementById("dataInicio") || doc.getElementById("dataInicioBusca"); 
          const elF = doc.getElementById("dataFim") || doc.getElementById("dataFimBusca");
          if(elI) elI.value = i; if(elF) elF.value = f;
          if (!win.$) { reject("jQuery off"); return; }
          const hook = (e, xhr, settings) => {
              if (settings && settings.url && settings.url.includes(targetUrl)) {
                  win.$(doc).off("ajaxComplete", hook);
                  if(forceExpand) tryExpandTable(doc).then(resolve); else resolve();
              }
          };
          win.$(doc).on("ajaxComplete", hook);
          doc.querySelector(btnSelector).click();
      });
  }
  function searchProducaoAjax(ifr, i, f, ex, targetUrl) {
      return new Promise((resolve) => {
          const doc = ifr.contentDocument; const win = ifr.contentWindow;
          doc.getElementById("dataInicioBusca").value = i; doc.getElementById("dataFimBusca").value = f;
          const sel = doc.getElementById("tipoProdutosExtra"); if(sel){ sel.value=ex; sel.dispatchEvent(new Event('change')); }
          const hook = (e, xhr, settings) => {
              if (settings && settings.url && settings.url.includes(targetUrl)) {
                  win.$(doc).off("ajaxComplete", hook); tryExpandTable(doc).then(resolve);
              }
          };
          win.$(doc).on("ajaxComplete", hook);
          doc.querySelector("#buttonbuscarRelatorioProducaoVenda").click();
      });
  }
  async function tryExpandTable(doc) {
      try { const sel = doc.querySelector("select[name*='_length']"); if(sel && sel.value !== "-1") { if(!sel.querySelector("option[value='-1']")) { const o = document.createElement("option"); o.value="-1"; o.text="Todos"; sel.add(o); } sel.value = "-1"; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1000)); } } catch (e) { }
  }

  function extractSalesFromProduto(doc) {
      let r={banhos:0, tosas:0, extrasQtd:0, extrasFat:0, pacotesQtd:0, banhosTec:0, lojaFat:0, totalBruto:0};
      doc.getElementById("idTabelaVenda").querySelectorAll("tbody tr").forEach(tr => {
          if (tr.cells.length < 4) return;
          const nome=tr.cells[0].textContent.toLowerCase(), cat=tr.cells[1].textContent.toLowerCase();
          const qtd=parseIntSafe(tr.cells[2].textContent), val=parseBRLStrict(tr.cells[3].textContent);
          r.totalBruto += val;
          let sub="IGNORADO";
          if (cat.includes('estética') || cat.includes('estetica')) {
              if (nome.includes("pacote")) { if (nome.includes("tosa")) sub="PT"; else if (nome.includes("banho")) { r.pacotesQtd+=qtd; sub="PB"; } else sub="PE"; }
              else if (nome.includes("higi") || nome.includes("higi")) { r.extrasQtd+=qtd; r.extrasFat+=val; sub="EX"; }
              else if (nome==='-banho' || nome==='banho') { r.banhos+=qtd; sub="BA"; }
              else if (nome.includes("banho para tosar")) { r.banhosTec+=qtd; sub="BT"; }
              else if (nome.includes("tosa")) { r.tosas+=qtd; sub="TA"; }
              else if (!nome.includes("cortesia")) { r.extrasQtd+=qtd; r.extrasFat+=val; sub="EX"; }
          } else { r.lojaFat+=val; sub="LJ"; }
          Debugger.logItem('vendas_analise', { Produto: nome, Cat: cat, Sub: sub, Qtd: qtd, Val: val });
      });
      return r;
  }

  function extractExecutionFromProducao(doc, mode) {
      let r={banhosPacoteExec:0, tosasPacoteExec:0, banhosParaTosarPacoteExec:0, banhosAvulsosExec:0, banhosParaTosarExec:0, tosasAvulsasExec:0, extrasExec:0, extrasExecValor:0, totalQtdNormal:0};
      doc.getElementById("idTabelaVenda").querySelectorAll("tbody tr").forEach(tr => {
          if (tr.cells.length < 5) return;
          const nome=tr.cells[2].textContent.toLowerCase();
          const noP=parseIntSafe(tr.cells[3].textContent), semP=parseIntSafe(tr.cells[4].textContent), val=parseBRLStrict(tr.cells[6]?.textContent);
          if (mode === 'normal') {
              r.totalQtdNormal += (noP+semP);
              if (nome.includes("banho") && !nome.includes("para tosar")) { r.banhosPacoteExec+=noP; r.banhosAvulsosExec+=semP; }
              else if (nome.includes("tosa") && !nome.includes("higi") && !nome.includes("para tosar")) { r.tosasPacoteExec+=noP; r.tosasAvulsasExec+=semP; }
              else if (nome.includes("banho para tosar")) { r.banhosParaTosarExec+=semP; r.banhosParaTosarPacoteExec+=noP; }
          } else {
              r.extrasExec+=semP; r.extrasExecValor+=val;
          }
      });
      return r;
  }

  function extractCaixaData(doc, ini, fim) {
      let t=0, a=[]; 
      const dtI=new Date(ini+"T00:00:00"), dtF=new Date(fim+"T23:59:59");
      doc.querySelectorAll("#idTabelaRelatorio tbody tr").forEach(tr => {
          if(tr.cells.length<6) return;
          const val=parseBRLStrict(tr.cells[5].textContent);
          const txt=tr.cells[1].textContent;
          const mA=txt.match(/Abertura:\s*(\d{2}\/\d{2}\/\d{4})/), mF=txt.match(/Fechamento:\s*(\d{2}\/\d{2}\/\d{4})/);
          if(mA) {
              const [dA,MA,AA]=mA[1].split('/'); const dtA=new Date(`${AA}-${MA}-${dA}T12:00:00`);
              let dtFch=null;
              if(mF){ const [dF,MF,AF]=mF[1].split('/'); dtFch=new Date(`${AF}-${MF}-${dF}T12:00:00`); }
              if((dtFch && dtFch>=dtI && dtFch<=dtF) || (dtA>=dtI && dtA<=dtF)) {
                  t+=val;
                  if(dtA.getDay()===0) a.push(`<span class="c04-alert-item">📅 Caixa ID ${tr.cells[0].innerText} em Domingo.</span>`);
              }
          }
      });
      return {total:t, alertas:a};
  }

  function formatDiffMsg(diff, perc, isCurr) {
      if(Math.abs(diff)<0.05) return "";
      if(!isCurr) return `<span class="c04-diff-info c04-diff-error">Dif: ${diff}</span>`;
      const ap=Math.abs(perc), cls = ap>10?'red':ap>5?'orange':ap>2.5?'yellow':'green';
      return `<span class="c04-diff-info c04-diff-${cls}">Dif: ${formatBRL(diff)} (${perc.toFixed(1)}%)</span>`;
  }

  function render(d, flags) {
      const el=document.getElementById("c04-resumo"); if(!d || !el) return;
      el.innerHTML = `<table class="c04-table">${INDICADORES.map(i => {
          let sub="";
          if(i.key==='fat_total' && flags.fat_total) sub=formatDiffMsg(flags.fat_total.diff, flags.fat_total.percent, true);
          if(i.key==='fat_extras' && flags.fat_extras) sub=formatDiffMsg(flags.fat_extras.diff, flags.fat_extras.percent, true);
          if(flags[i.key] && i.type==='int') sub=formatDiffMsg(flags[i.key].diff, flags[i.key].percent, false);
          return `<tr><td>${i.label}</td><td>${i.type==='currency'?formatBRL(d[i.key]):d[i.key]}${sub}</td></tr>`;
      }).join('')}</table>`;
      
      const btn=document.getElementById("c04-copiar");
      btn.style.display="block";
      btn.onclick=()=>{
          const txt=INDICADORES.map(i=>i.type==='currency'?d[i.key].toFixed(2).replace(".",","):d[i.key]).join("\n");
          navigator.clipboard.writeText(txt);
          btn.innerText="COPIADO!"; btn.classList.add("c04-btn-copied");
          setTimeout(()=>{ btn.innerText="COPIAR VALORES"; btn.classList.remove("c04-btn-copied");}, 1000);
      };
  }

  // Se já carregou, abre
  if(document.getElementById("c04-painel-metas")) document.getElementById("c04-painel-metas").style.display='flex';
  else initMetasUI();

})();
