/**
 * CLUBE04 - MÓDULO METAS (Deep Analytics)
 * Adaptado para integração com Suite Central
 * Versão: 4.32.0 (Relatório Console Restaurado + Teardown Fix)
 */
(function () {
    "use strict";

    // --- Configurações ---
    const RELATORIOS = {
        CAIXA: { url: "https://clube04.com.br/digital/relatoriocaixa.php", target: "RelatorioCaixaN001.php", btn: ".btn-primary" },
        PRODUTO: { url: "https://clube04.com.br/digital/relproduto.php", target: "RelatorioProdutoN001.php", btn: "#buttonbuscarRelatorioProduto" },
        PRODUCAO: { url: "https://clube04.com.br/digital/relproducaovenda.php", target: "RelatorioProducaoVendaN002.php", btn: "#buttonbuscarRelatorioProducaoVenda" },
        VENDA: { url: "https://clube04.com.br/digital/relvendafechada.php", target: "RelatorioVendaFechadaN001.php", btn: "#buttonbuscarVendaFechada" }
    };

    const INDICADORES = [
        { key: "fat_total", label: "FATURAMENTO TOTAL (LÍQUIDO)", type: "currency" },
        { key: "qtd_serv_agend", label: "QTD SERVIÇOS AGENDADOS", type: "int" },
        { key: "qtd_banho_avulso", label: "QTD BANHO AVULSO", type: "int" },
        { key: "qtd_tosa_avulsa", label: "QTD TOSA AVULSA", type: "int" },
        { key: "fat_extras", label: "FAT. SERVIÇOS EXTRAS", type: "currency" },
        { key: "qtd_extras_avulsos", label: "QTD SERV. EXTRAS AVULSOS", type: "int" },
        { key: "qtd_pacotes_banho", label: "QTD PACOTES BANHOS (VENDIDOS)", type: "int" },
        { key: "fat_produtos_loja", label: "FAT. PRODUTOS LOJA", type: "currency" },
    ];

    // --- HELPERS (Definidos antes do uso para evitar erros) ---
    function setStatus(msg, type = 'info') {
        const el = document.getElementById("c04-status");
        if (el) {
            el.textContent = msg;
            el.className = "";
            if (type === 'error') el.classList.add('c04-status-error');
            if (type === 'success') el.classList.add('c04-status-success');
        }
    }

    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }

    async function createIfr(url) {
        const f = document.createElement("iframe");
        f.style.display = "none";
        f.src = url;
        document.body.appendChild(f);
        await new Promise(r => f.onload = r);
        return f;
    }

    function parseBRLStrict(htmlOrText) {
        const match = (htmlOrText || "").match(/R\$\s*([\d\.]*,\d{2})/);
        return match ? parseFloat(match[1].replace(/\./g, "").replace(",", ".")) : 0;
    }

    function formatBRL(v) {
        return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function parseIntSafe(s) {
        return parseInt((s || "0").replace(/\D/g, ""), 10) || 0;
    }

    function findVal(doc, label) {
        const el = Array.from(doc.querySelectorAll("*")).find(x => x.innerText?.includes(label));
        return el ? el.innerText.split(label)[1] : "0";
    }

    function formatDiffMsg(diff, perc, isCurrency = false) {
        if (Math.abs(diff) < 0.05) return "";
        if (!isCurrency) {
            return `<span class="c04-diff-info c04-diff-error">Dif: ${diff}</span>`;
        } else {
            const absPerc = Math.abs(perc);
            let colorClass = "c04-diff-green";
            if (absPerc > 10) colorClass = "c04-diff-red";
            else if (absPerc > 5) colorClass = "c04-diff-orange";
            else if (absPerc > 2.5) colorClass = "c04-diff-yellow";
            return `<span class="c04-diff-info ${colorClass}">Dif: ${formatBRL(diff)} (${perc.toFixed(1)}%)</span>`;
        }
    }

    async function waitForTextInDoc(doc, txt) {
        return new Promise(r => {
            let c = 0;
            const i = setInterval(() => {
                if (doc.body.textContent.includes(txt) || c++ > 60) { clearInterval(i); r(); }
            }, 250);
        });
    }

    // --- SISTEMA DE DEBUG (RESTAURADO COMPLETO) ---
    const Debugger = {
        logs: {
            caixa: [],
            vendas_analise: [],
            prod_banho: [], prod_tosa: [], prod_tecnico: [], prod_extras: [],
            auditoria_final: [],
            erros: []
        },
        logItem: (section, item) => { if (Debugger.logs[section]) Debugger.logs[section].push(item); },
        logError: (msg) => { Debugger.logs.erros.push(msg); console.warn("⚠️ [Clube04 Script]:", msg); },
        clear: () => { for (let k in Debugger.logs) Debugger.logs[k] = []; console.clear(); },

        printAll: () => {
            console.clear();
            console.log("%c 🐞 RELATÓRIO DE DEBUG - CLUBE04 v4.32.0 ", "background: #000; color: #0f0; font-size: 16px; padding: 10px; border-radius: 4px; font-weight: bold;");

            if (Debugger.logs.erros.length > 0) { console.group("❌ ERROS"); console.table(Debugger.logs.erros); console.groupEnd(); }

            const printTableGroup = (title, data, firstColName = 'Produto') => {
                console.groupCollapsed(title);
                if (data && data.length > 0) {
                    const tData = JSON.parse(JSON.stringify(data));
                    const totalRow = {};
                    totalRow[firstColName] = 'TOTAL GERAL';
                    Object.keys(tData[0]).forEach(key => {
                        if (key !== firstColName && typeof tData[0][key] === 'number') {
                            totalRow[key] = tData.reduce((acc, row) => acc + (row[key] || 0), 0);
                        } else if (key !== firstColName) {
                            totalRow[key] = '';
                        }
                    });
                    tData.push(totalRow);
                    console.table(tData);
                } else {
                    console.log("%c Nenhum item nesta categoria.", "color: #999; font-style: italic;");
                }
                console.groupEnd();
            };

            // 1. RELATÓRIO DE VENDAS
            console.groupCollapsed("🛒 1. RELATÓRIO VENDAS (CAIXA)");
            printTableGroup("1.1 GERAL (Todos os Itens)", Debugger.logs.vendas_analise);
            const sales = Debugger.logs.vendas_analise;
            printTableGroup("1.2 BANHOS AVULSOS", sales.filter(i => i.Subcategoria === "BANHO AVULSO"));
            printTableGroup("1.3 TOSAS AVULSAS", sales.filter(i => i.Subcategoria === "TOSA AVULSA"));
            printTableGroup("1.4 BANHO P/ TOSAR", sales.filter(i => i.Subcategoria === "BANHO P/ TOSAR"));
            printTableGroup("1.5 SERVIÇOS EXTRAS", sales.filter(i => i.Subcategoria === "SERV. EXTRA"));
            printTableGroup("1.6 PACOTES BANHO", sales.filter(i => i.Subcategoria === "PACOTE BANHO"));
            printTableGroup("1.7 PACOTES TOSA", sales.filter(i => i.Subcategoria === "PACOTE TOSA"));
            printTableGroup("1.8 PACOTES SERV. EXTRA", sales.filter(i => i.Subcategoria === "PACOTE SERV EXTRA"));
            printTableGroup("1.9 PRODUTOS LOJA", sales.filter(i => i.Subcategoria === "PRODUTO LOJA"));
            printTableGroup("1.10 OUTROS / NÃO CATEGORIZADOS", sales.filter(i => i.Subcategoria === "IGNORADO" || i.Subcategoria.startsWith("OUTRA")));
            console.groupEnd();

            // 2. PRODUÇÃO
            console.groupCollapsed("🐶 2. PRODUÇÃO (Execução por Colaborador)");
            console.groupCollapsed("2.1 Serviços Não Extra (Principais)");
            printTableGroup("2.1.1 Banhos", Debugger.logs.prod_banho, 'Colaborador');
            printTableGroup("2.1.2 Tosas", Debugger.logs.prod_tosa, 'Colaborador');
            printTableGroup("2.1.3 Banho para Tosar", Debugger.logs.prod_tecnico, 'Colaborador');
            console.groupEnd();
            console.groupCollapsed("2.2 Serviços Extras");
            printTableGroup("2.2.1 Extras Executados", Debugger.logs.prod_extras, 'Colaborador');
            console.groupEnd();
            console.groupEnd();

            // 3. CAIXA
            console.groupCollapsed("💰 3. CAIXA & FINANCEIRO");
            const cData = JSON.parse(JSON.stringify(Debugger.logs.caixa));
            if (cData.length) {
                const tCaixa = cData.reduce((a, b) => a + b.Valor, 0);
                cData.push({ ID: 'TOTAL GERAL', Valor: tCaixa, Abertura: '', Fechamento: '' });
                console.table(cData);
            } else console.log("Nenhum caixa encontrado.");
            console.groupEnd();

            // 4. AUDITORIA
            console.group("⚠️ 4. AUDITORIA COMPLETA");
            if (Debugger.logs.auditoria_final.length) {
                console.table(Debugger.logs.auditoria_final);
            } else {
                console.log("Auditoria vazia.");
            }
            console.groupEnd();
        }
    };

    // --- HTML Styles ---
    const STYLES_CSS = `
        #c04-painel { position: fixed; top: 10%; left: 50%; transform: translateX(-50%); width: 480px; max-height: 85vh; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); z-index: 2147483647; display: none; font-family: 'Segoe UI', Tahoma, sans-serif; border: 1px solid #cbd5e1; flex-direction: column; overflow: hidden; } 
        #c04-header { background: #0f172a; color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; cursor: grab; border-radius: 12px 12px 0 0; user-select: none; } 
        #c04-header:active { cursor: grabbing; } 
        #c04-body { padding: 20px; overflow-y: auto; } 
        .c04-row { display: flex; gap: 10px; margin-bottom: 15px; align-items: flex-end; } 
        .c04-col { flex: 1; } 
        .c04-label { display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; } 
        .c04-input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; box-sizing: border-box; } 
        .c04-btn { padding: 10px 16px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 13px; width: 100%; } 
        .c04-btn-primary { background: #2563eb; color: #fff; } 
        .c04-btn-primary:hover { background: #1d4ed8; } 
        .c04-btn-success { background: #10b981; color: #fff; margin-top: 15px; } 
        .c04-btn-success:hover { background: #059669; } 
        .c04-btn-copied { background-color: #047857 !important; transform: scale(0.98); box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); } 
        #c04-status { margin: 10px 0; font-size: 12px; color: #475569; text-align: center; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; transition: all 0.3s; } 
        .c04-status-error { background: #fee2e2 !important; color: #b91c1c !important; border-color: #fca5a5 !important; } 
        .c04-status-success { background: #dcfce7 !important; color: #15803d !important; border-color: #86efac !important; } 
        .c04-alert-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 12px; margin-top: 15px; border-radius: 4px; font-size: 12px; color: #9a3412; display: none; } 
        .c04-alert-title { font-weight: 800; margin-bottom: 6px; display: block; font-size: 13px; text-transform: uppercase; } 
        .c04-alert-item { display: block; margin-bottom: 4px; border-bottom: 1px solid #fed7aa; padding-bottom: 4px; } 
        .c04-alert-category-header { font-weight: bold; color: #431407; background: #ffedd5; padding: 4px 8px; border-radius: 4px; margin-top: 10px; margin-bottom: 5px; font-size: 11px; text-transform: uppercase; } 
        .c04-alert-action-footer { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #fdba74; font-weight: 600; color: #c2410c; } 
        .c04-alert-footer { margin-top: 8px; font-style: italic; font-size: 11px; opacity: 0.8; border-top: 1px solid #fed7aa; padding-top: 6px; } 
        .c04-table { width: 100%; font-size: 13px; border-collapse: collapse; margin-top: 10px; } 
        .c04-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #334155; } 
        .c04-table td:last-child { text-align: right; font-weight: 700; color: #0f172a; } 
        .c04-warning-tag { background: #fee2e2; color: #b91c1c; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 5px; font-weight: bold; } 
        .c04-toggle { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; cursor: pointer; margin-top: 5px; user-select: none; } 
        .c04-diff-info { display: block; font-size: 10px; font-weight: normal; margin-top: 2px; } 
        .c04-diff-green { color: #16a34a; } 
        .c04-diff-yellow { color: #ca8a04; font-weight: 700; } 
        .c04-diff-orange { color: #ea580c; font-weight: 700; } 
        .c04-diff-red { color: #dc2626; font-weight: 800; } 
        .c04-diff-error { color: #b91c1c; font-weight: 800; }
    `;

    // --- FUNÇÃO DE LIMPEZA (TEARDOWN) ---
    function destroyModule() {
        const el = document.getElementById("c04-painel");
        if (el) el.remove();
    }

    // --- Função Principal de Inicialização ---
    function initModule() {
        destroyModule();
        addStyle(STYLES_CSS);

        const mainDiv = document.createElement("div");
        mainDiv.id = "c04-painel";
        mainDiv.style.display = 'flex';
        mainDiv.innerHTML = `
        <div id="c04-header"><span>Dashboard de Metas</span><button id="c04-close" style="background:none; border:none; color:#cbd5e1; cursor:pointer; font-size:24px; line-height:1;">×</button></div>
        <div id="c04-body">
            <div class="c04-row">
                <div class="c04-col"><label class="c04-label">Data Início</label><input type="date" id="c04-data-ini" class="c04-input"></div>
                <div class="c04-col" id="c04-container-fim" style="display:none;"><label class="c04-label">Data Fim</label><input type="date" id="c04-data-fim" class="c04-input"></div>
            </div>
            <label class="c04-toggle"><input type="checkbox" id="c04-periodo-check"> Buscar por período</label>
            <div style="margin-top: 15px;"><button id="c04-gerar" class="c04-btn c04-btn-primary">SINCRONIZAR DADOS</button></div>
            <div id="c04-status">Pronto.</div>
            <div id="c04-divergencia" class="c04-alert-box">
                <span class="c04-alert-title">⚠️ Alertas de Auditoria</span>
                <div id="c04-divergencia-msg"></div>
                <div class="c04-alert-footer">Verifique os detalhes no console (F12).</div>
            </div>
            <div id="c04-resumo"></div>
            <button id="c04-copiar" class="c04-btn c04-btn-success" style="display:none;">COPIAR VALORES</button>
        </div>`;
        document.body.appendChild(mainDiv);

        setupLogic();
    }

    function setupLogic() {
        const elDataIni = document.getElementById("c04-data-ini"), elDataFim = document.getElementById("c04-data-fim"), elCheckPeriodo = document.getElementById("c04-periodo-check"), elStatus = document.getElementById("c04-status"), elResumo = document.getElementById("c04-resumo"), elBtnCopiar = document.getElementById("c04-copiar"), elDivAlert = document.getElementById("c04-divergencia"), elMsgAlert = document.getElementById("c04-divergencia-msg");
        
        function getLocalToday() { const d = new Date(); const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
        const today = getLocalToday();
        elDataIni.max = today; elDataFim.max = today;
        const cached = JSON.parse(localStorage.getItem("c04_cache_v4") || "{}");
        elDataIni.value = cached.ini || today;
        elDataFim.value = cached.fim || elDataIni.value;
        elCheckPeriodo.checked = cached.isPeriodo || false;
        if (elCheckPeriodo.checked) document.getElementById("c04-container-fim").style.display = "block";

        function saveState() { localStorage.setItem("c04_cache_v4", JSON.stringify({ ini: elDataIni.value, fim: elDataFim.value, isPeriodo: elCheckPeriodo.checked })); }

        elDataIni.onchange = () => { if (elDataIni.value > today) elDataIni.value = today; elDataFim.min = elDataIni.value; if (elDataFim.value < elDataIni.value) elDataIni.value = elDataIni.value; saveState(); };
        elDataFim.onchange = () => { if (elDataFim.value > today) elDataFim.value = today; if (elDataFim.value < elDataIni.value) elDataIni.value = elDataFim.value; saveState(); };
        elCheckPeriodo.onchange = (e) => { document.getElementById("c04-container-fim").style.display = e.target.checked ? "block" : "none"; if (!e.target.checked) elDataFim.value = elDataIni.value; saveState(); };
        
        const mainDiv = document.getElementById("c04-painel");

        function setupDrag(element, handle) {
            let startX, startY, moved = false;
            handle.onmousedown = (e) => {
                e.preventDefault(); startX = e.clientX; startY = e.clientY; let iL = element.offsetLeft, iT = element.offsetTop;
                moved = false;
                const move = (evt) => {
                    if (Math.abs(evt.clientX - startX) > 3 || Math.abs(evt.clientY - startY) > 3) moved = true;
                    if (moved) { element.style.left = `${iL + evt.clientX - startX}px`; element.style.top = `${iT + evt.clientY - startY}px`; element.style.transform = "none"; }
                };
                const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
                document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
            };
        }
        setupDrag(mainDiv, document.getElementById("c04-header"));
        
        document.getElementById("c04-close").onclick = () => {
            if (window.killAllModules) window.killAllModules(); else destroyModule();
        };

        // --- Processamento ---
        document.getElementById("c04-gerar").onclick = async () => {
            Debugger.clear();
            elDivAlert.style.display = 'none'; elBtnCopiar.style.display = 'none';
            elResumo.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;font-style:italic;">⏳ Processando dados...</div>';

            const ini = elDataIni.value, fim = elCheckPeriodo.checked ? elDataFim.value : ini;
            saveState();
            const dados = { fat_bruto: 0, fat_total: 0, qtd_serv_agend: 0, qtd_banho_avulso: 0, qtd_tosa_avulsa: 0, fat_extras: 0, qtd_extras_avulsos: 0, qtd_pacotes_banho: 0, fat_produtos_loja: 0 };
            const statusFlags = {};
            const alertasBucket = { servicos: [], financeiro: [], caixa: [] };
            try {
                setStatus("📦 Analisando Vendas...", "info");
                const ifrProd = await createIfr(RELATORIOS.PRODUTO.url);
                let salesData = { banhos: 0, tosas: 0, extrasQtd: 0, extrasFat: 0, pacotesQtd: 0, banhosTec: 0, tosaHigi: 0, lojaFat: 0, totalBruto: 0 };
                try {
                    await searchWithAjaxHook(ifrProd, ini, fim, RELATORIOS.PRODUTO.btn, RELATORIOS.PRODUTO.target, true);
                    salesData = extractSalesFromProduto(ifrProd.contentDocument);
                    dados.qtd_banho_avulso = salesData.banhos; dados.qtd_tosa_avulsa = salesData.tosas; dados.qtd_extras_avulsos = salesData.extrasQtd; dados.qtd_pacotes_banho = salesData.pacotesQtd; dados.fat_produtos_loja += salesData.lojaFat; dados.fat_bruto = salesData.totalBruto;
                } catch (err) { Debugger.logError("Erro Vendas: " + err); throw new Error("Falha em Vendas."); } finally { ifrProd.remove(); }

                setStatus("🐶 Verificando Produção...", "info");
                const ifrServ = await createIfr(RELATORIOS.PRODUCAO.url);
                let execData = { banhosPacoteExec: 0, tosasPacoteExec: 0, banhosParaTosarPacoteExec: 0, banhosAvulsosExec: 0, banhosParaTosarExec: 0, tosasAvulsasExec: 0, extrasExec: 0, extrasExecValor: 0, totalQtdNormal: 0 };
                try {
                    await searchProducaoAjax(ifrServ, ini, fim, '0', RELATORIOS.PRODUCAO.target);
                    const execNormal = extractExecutionFromProducao(ifrServ.contentDocument, 'normal');
                    await searchProducaoAjax(ifrServ, ini, fim, '1', RELATORIOS.PRODUCAO.target);
                    const execExtras = extractExecutionFromProducao(ifrServ.contentDocument, 'extra');
                    execData = { banhosPacoteExec: execNormal.banhosPacoteExec || 0, tosasPacoteExec: execNormal.tosasPacoteExec || 0, banhosParaTosarPacoteExec: execNormal.banhosParaTosarPacoteExec || 0, banhosAvulsosExec: execNormal.banhosAvulsosExec || 0, banhosParaTosarExec: execNormal.banhosParaTosarExec || 0, tosasAvulsasExec: execNormal.tosasAvulsasExec || 0, extrasExec: execExtras.extrasExec || 0, extrasExecValor: execExtras.extrasExecValor || 0, totalQtdNormal: execNormal.totalQtdNormal || 0 };
                    const qtdAgendadoHibrido = (salesData.banhos + salesData.tosas + salesData.banhosTec) + (execData.banhosPacoteExec + execData.tosasPacoteExec + execData.banhosParaTosarPacoteExec);
                    dados.qtd_serv_agend = qtdAgendadoHibrido;
                    dados.fat_extras = execData.extrasExecValor;
                } catch (err) { Debugger.logError("Erro Produção: " + err); throw new Error("Falha em Produção."); } finally { ifrServ.remove(); }

                const auditItem = (tipo, vendido, executado, valorVenda = 0, valorExecutado = 0, isCurrency = false) => {
                    const diff = (vendido || 0) - (executado || 0);
                    let status = "OK"; let obs = ""; let percent = (vendido > 0 ? (diff / vendido) * 100 : 0);
                    if (tipo === "Faturamento total") {
                        if (diff < -0.05) { status = "❌ ERRO"; obs = `Líquido (${formatBRL(executado)}) maior que Bruto (${formatBRL(vendido)})! Verifique lançamentos fiscais.`; alertasBucket.financeiro.push(`<span class="c04-alert-item">❌ <b>${tipo}:</b> ${obs}</span>`); } 
                        else if (percent > 5) { status = "⚠️ ATENÇÃO"; obs = `Diferença de ${formatBRL(diff)} (${percent.toFixed(1)}%). Cuidado com descontos excessivos.`; alertasBucket.financeiro.push(`<span class="c04-alert-item" style="color:#b45309">⚠️ <b>${tipo}:</b> ${obs}</span>`); }
                    } else {
                        if (diff > 0.05) { status = "❌ ERRO"; obs = `${isCurrency ? 'Bruto' : 'Vendido'} ${isCurrency ? formatBRL(vendido) : vendido} > ${isCurrency ? 'Líquido' : 'Feito'} ${isCurrency ? formatBRL(executado) : executado}`; if (isCurrency || ['Faturamento total', 'Fat. Serviços Extras'].includes(tipo)) { alertasBucket.financeiro.push(`<span class="c04-alert-item">❌ <b>${tipo}:</b> ${obs}</span>`); } else { alertasBucket.servicos.push(`<span class="c04-alert-item">❌ <b>${tipo}:</b> ${obs}</span>`); } } 
                        else if (diff < -0.05) { status = "⚠️ ALERTA"; obs = `${isCurrency ? 'Líquido' : 'Feito'} ${isCurrency ? formatBRL(executado) : executado} > ${isCurrency ? 'Bruto' : 'Vendido'} ${isCurrency ? formatBRL(vendido) : vendido}`; if (isCurrency || ['Faturamento total', 'Fat. Serviços Extras'].includes(tipo)) { alertasBucket.financeiro.push(`<span class="c04-alert-item">⚠️ <b>${tipo}:</b> ${obs}</span>`); } else { alertasBucket.servicos.push(`<span class="c04-alert-item">⚠️ <b>${tipo}:</b> ${obs}</span>`); } }
                    }
                    const logObj = { Categoria: tipo, Status: status, Diferenca: isCurrency ? formatBRL(diff) : diff };
                    if (isCurrency) { logObj.Bruto = formatBRL(vendido); logObj.Liquido = formatBRL(executado); } else { logObj.Vendido = vendido; logObj.Executado = executado; logObj.ValorVenda = valorVenda > 0 ? formatBRL(valorVenda) : '-'; logObj.ValorExecutado = valorExecutado > 0 ? formatBRL(valorExecutado) : '-'; }
                    Debugger.logItem('auditoria_final', logObj);
                    return { diff, percent };
                };

                statusFlags.qtd_banho_avulso = auditItem("Banho Avulso", dados.qtd_banho_avulso, execData.banhosAvulsosExec);
                statusFlags.qtd_tosa_avulsa = auditItem("Tosa Avulsa", dados.qtd_tosa_avulsa, execData.tosasAvulsasExec);
                auditItem("Banho p/ Tosar", salesData.banhosTec, execData.banhosParaTosarExec);
                statusFlags.qtd_extras_avulsos = auditItem("Serviços Extras", dados.qtd_extras_avulsos, execData.extrasExec, salesData.extrasFat, execData.extrasExecValor);
                statusFlags.qtd_serv_agend = auditItem("Qtd Serviços Agendados (Global)", dados.qtd_serv_agend, execData.totalQtdNormal);

                setStatus("🛍️ Calculando Loja...", "info");
                const ifrVenda = await createIfr(RELATORIOS.VENDA.url);
                try {
                    await searchWithAjaxHook(ifrVenda, ini, fim, RELATORIOS.VENDA.btn, RELATORIOS.VENDA.target, true);
                    await waitForTextInDoc(ifrVenda.contentDocument, "Centro de Estética:");
                    const totalVenda = parseBRLStrict(findVal(ifrVenda.contentDocument, "Total:"));
                    const totalEstetica = parseBRLStrict(findVal(ifrVenda.contentDocument, "Centro de Estética:"));
                    dados.fat_produtos_loja = totalVenda - totalEstetica;
                } catch (err) { Debugger.logError("Erro Loja: " + err); } finally { ifrVenda.remove(); }

                setStatus("💰 Auditando Caixa...", "info");
                const ifrCaixa = await createIfr(RELATORIOS.CAIXA.url);
                try {
                    const dateD1 = new Date(ini); dateD1.setDate(dateD1.getDate() - 1);
                    const iniD1 = dateD1.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
                    const dateF1 = new Date(fim); dateF1.setDate(dateF1.getDate() + 1);
                    const fimD1 = dateF1.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
                    await searchWithAjaxHook(ifrCaixa, iniD1, fimD1, RELATORIOS.CAIXA.btn, RELATORIOS.CAIXA.target);
                    const caixaData = extractCaixaData(ifrCaixa.contentDocument, ini, fim);
                    if (caixaData.total > 0) dados.fat_total = caixaData.total; else statusFlags.caixa = "zerado";
                    if (caixaData.alertas && caixaData.alertas.length > 0) { alertasBucket.caixa.push(...caixaData.alertas); }
                    statusFlags.fat_total = auditItem("Faturamento total", dados.fat_bruto, dados.fat_total, 0, 0, true);
                    statusFlags.fat_extras = { diff: salesData.extrasFat - execData.extrasExecValor, percent: (salesData.extrasFat > 0 ? ((salesData.extrasFat - execData.extrasExecValor) / salesData.extrasFat) * 100 : 0) };
                } catch (err) { Debugger.logError("Erro Caixa: " + err); throw new Error("Erro Caixa."); } finally { ifrCaixa.remove(); }

                Debugger.printAll();
                saveState();
                render(dados, statusFlags);

                let alertasHtml = "";
                if (alertasBucket.servicos.length > 0) { alertasHtml += `<div class="c04-alert-category-header">🛠️ Execução de Serviços</div>` + alertasBucket.servicos.join(""); alertasHtml += `<div class="c04-alert-action-footer">⚠️ Ação: Reforçar com a equipe o manuseio correto da fila de serviço e Caixa PDV para que não ocorra erros.</div>`; }
                if (alertasBucket.financeiro.length > 0) { alertasHtml += `<div class="c04-alert-category-header">💰 Financeiro</div>` + alertasBucket.financeiro.join(""); }
                if (alertasBucket.caixa.length > 0) { alertasHtml += `<div class="c04-alert-category-header">📦 Caixa & Operacional</div>` + alertasBucket.caixa.join(""); }
                if (alertasHtml !== "") { elMsgAlert.innerHTML = alertasHtml; elDivAlert.style.display = "block"; }
                elBtnCopiar.style.display = "block";
                setStatus("✅ Concluído!", "success");

            } catch (e) {
                setStatus("❌ " + e.message, "error"); console.error(e); elResumo.innerHTML = `<p style="color:red; text-align:center;">${e.message}</p>`;
            }
        };
    }

    // --- AJAX Helpers ---
    function searchWithAjaxHook(ifr, i, f, btnSelector, targetUrl, forceExpand = false) {
        return new Promise((resolve, reject) => {
            const doc = ifr.contentDocument; const win = ifr.contentWindow;
            const elI = doc.getElementById("dataInicio") || doc.getElementById("dataInicioBusca"); const elF = doc.getElementById("dataFim") || doc.getElementById("dataFimBusca");
            if (elI) elI.value = i; if (elF) elF.value = f;
            if (!win.$) { reject("jQuery off"); return; }
            const timeoutId = setTimeout(() => { reject(`Timeout (8s) em ${targetUrl}`); }, 8000);
            const hook = (event, xhr, settings) => {
                if (settings && settings.url && settings.url.includes(targetUrl)) {
                    win.$(doc).off("ajaxComplete", hook); clearTimeout(timeoutId);
                    if (forceExpand) { tryExpandTable(doc).then(resolve); } else { resolve(); }
                }
            };
            win.$(doc).on("ajaxComplete", hook);
            doc.querySelector(btnSelector).click();
        });
    }

    function searchProducaoAjax(ifr, i, f, ex, targetUrl) {
        return new Promise((resolve, reject) => {
            const doc = ifr.contentDocument; const win = ifr.contentWindow;
            doc.getElementById("dataInicioBusca").value = i; doc.getElementById("dataFimBusca").value = f;
            const selExtra = doc.getElementById("tipoProdutosExtra"); if (selExtra) { selExtra.value = ex; selExtra.dispatchEvent(new Event('change')); }
            if (!win.$) { reject("jQuery off"); return; }
            const timeoutId = setTimeout(() => { reject(`Timeout (8s) Produção`); }, 8000);
            const hook = (event, xhr, settings) => {
                if (settings && settings.url && settings.url.includes(targetUrl)) {
                    win.$(doc).off("ajaxComplete", hook); clearTimeout(timeoutId); tryExpandTable(doc).then(resolve);
                }
            };
            win.$(doc).on("ajaxComplete", hook);
            doc.querySelector("#buttonbuscarRelatorioProducaoVenda").click();
        });
    }

    async function tryExpandTable(doc) {
        try {
            const sel = doc.querySelector("select[name*='_length']");
            if (sel && sel.value !== "-1") {
                if (!sel.querySelector("option[value='-1']")) { const o = document.createElement("option"); o.value = "-1"; o.text = "Todos"; sel.add(o); } sel.value = "-1";
                sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) { }
    }

    // --- Business Logic Extractors ---
    function extractCaixaData(doc, userIni, userFim) {
        let total = 0; let alertas = []; const contagemDias = {};
        const rows = Array.from(doc.querySelectorAll("#idTabelaRelatorio tbody tr"));
        const dtIni = new Date(userIni + "T00:00:00"); const dtFim = new Date(userFim + "T23:59:59");
        rows.forEach(tr => {
            if (tr.cells.length < 6) return;
            const idCaixa = tr.cells[0].innerText.trim(); const valorCaixa = parseBRLStrict(tr.cells[5].textContent);
            const htmlData = tr.cells[1].innerHTML; const txtData = tr.cells[1].textContent;
            const matchAbertura = htmlData.match(/Abertura:\s*<\/b>\s*(\d{2}\/\d{2}\/\d{4})/i) || txtData.match(/Abertura:\s*(\d{2}\/\d{2}\/\d{4})/);
            const matchFechamento = htmlData.match(/Fechamento:\s*<\/b>\s*(\d{2}\/\d{2}\/\d{4})/i) || txtData.match(/Fechamento:\s*(\d{2}\/\d{2}\/\d{4})/);
            if (matchAbertura) {
                const strAbertura = matchAbertura[1]; const strFechamento = matchFechamento ? matchFechamento[1] : null;
                const [diaA, mesA, anoA] = strAbertura.split('/'); const dateAbertura = new Date(`${anoA}-${mesA}-${diaA}T12:00:00`);
                let dateFechamento = null;
                if (strFechamento) { const [diaF, mesF, anoF] = strFechamento.split('/'); dateFechamento = new Date(`${anoF}-${mesF}-${diaF}T12:00:00`); }
                let contabilizar = false;
                const fechouNoPeriodo = dateFechamento && dateFechamento >= dtIni && dateFechamento <= dtFim;
                const abriuNoPeriodo = dateAbertura >= dtIni && dateAbertura <= dtFim;
                if (fechouNoPeriodo || abriuNoPeriodo) contabilizar = true;
                if (contabilizar) {
                    total += valorCaixa;
                    Debugger.logItem('caixa', { ID: idCaixa, Valor: valorCaixa, Abertura: strAbertura, Fechamento: strFechamento });
                    contagemDias[strAbertura] = (contagemDias[strAbertura] || 0) + 1;
                    if (dateAbertura.getDay() === 0) alertas.push(`<span class="c04-alert-item">📅 <b>Domingo:</b> Caixa ID ${idCaixa} aberto em ${strAbertura}.</span>`);
                    if (strFechamento && strAbertura !== strFechamento) alertas.push(`<span class="c04-alert-item">🌙 <b>Virada:</b> Caixa ID ${idCaixa} (${strAbertura} a ${strFechamento}).</span>`);
                }
            }
        });
        for (const [dia, qtd] of Object.entries(contagemDias)) if (qtd > 1) alertas.push(`<span class="c04-alert-item">🔄 <b>Duplicidade:</b> ${qtd} caixas em ${dia}.</span>`);
        return { total, alertas };
    }

    function extractSalesFromProduto(doc) {
        let banhos = 0, tosas = 0, extrasQtd = 0, extrasFat = 0, pacotesQtd = 0, banhosTec = 0, lojaFat = 0, totalBruto = 0;
        doc.getElementById("idTabelaVenda").querySelectorAll("tbody tr").forEach(tr => {
            if (tr.cells.length < 4) return;
            const nome = tr.cells[0].textContent.toLowerCase().trim(); const cat = tr.cells[1].textContent.toLowerCase().trim(); const qtd = parseIntSafe(tr.cells[2].textContent); const val = parseBRLStrict(tr.cells[3].textContent);
            totalBruto += val; let sub = "IGNORADO";
            if (cat === 'centro de estética' || cat === 'centro de estetica') {
                if (nome.includes("pacote")) {
                    if (nome.includes("tosa")) sub = "PACOTE TOSA"; else if (nome.includes("banho")) { pacotesQtd += qtd; sub = "PACOTE BANHO"; } else sub = "PACOTE SERV EXTRA";
                } else if (nome.includes("higiênica") || nome.includes("higienica")) { extrasQtd += qtd; extrasFat += val; sub = "SERV. EXTRA"; } 
                else if (nome === '-banho' || nome === 'banho') { banhos += qtd; sub = "BANHO AVULSO"; } 
                else if (nome.includes("banho para tosar")) { banhosTec += qtd; sub = "BANHO P/ TOSAR"; } 
                else if (nome.includes("tosa")) { tosas += qtd; sub = "TOSA AVULSA"; } 
                else if (!nome.includes("banho cortesia")) { extrasQtd += qtd; extrasFat += val; sub = "SERV. EXTRA"; }
            } else { lojaFat += val; sub = "PRODUTO LOJA"; }
            Debugger.logItem('vendas_analise', { Produto: nome, Categoria: cat, Subcategoria: sub, Qtd: qtd, ValorTotal: val });
        });
        return { banhos, tosas, extrasQtd, extrasFat, pacotesQtd, banhosTec, lojaFat, totalBruto };
    }

    function extractExecutionFromProducao(doc, mode) {
        let banhosPacoteExec = 0, tosasPacoteExec = 0, banhosParaTosarPacoteExec = 0, banhosAvulsosExec = 0, banhosParaTosarExec = 0, tosasAvulsasExec = 0, extrasExec = 0, extrasExecValor = 0, totalQtdNormal = 0;
        doc.getElementById("idTabelaVenda").querySelectorAll("tbody tr").forEach(tr => {
            if (tr.cells.length < 5) return;
            const collab = tr.cells[0].textContent.trim(); const nome = tr.cells[2].textContent.toLowerCase(); const noPacote = parseIntSafe(tr.cells[3].textContent); const semPacote = parseIntSafe(tr.cells[4].textContent); const val = parseBRLStrict(tr.cells[6]?.textContent); const totalLinha = noPacote + semPacote;
            if (mode === 'normal') {
                totalQtdNormal += totalLinha;
                if (nome.includes("banho") && !nome.includes("para tosar")) { banhosPacoteExec += noPacote; banhosAvulsosExec += semPacote; Debugger.logItem('prod_banho', { Colaborador: collab, Servico: nome, NoPacote: noPacote, SemPacote: semPacote, Total: totalLinha }); } 
                else if (nome.includes("tosa") && !nome.includes("higienica") && !nome.includes("banho para tosar")) { tosasPacoteExec += noPacote; tosasAvulsasExec += semPacote; Debugger.logItem('prod_tosa', { Colaborador: collab, Servico: nome, NoPacote: noPacote, SemPacote: semPacote, Total: totalLinha }); } 
                else if (nome.includes("banho para tosar")) { banhosParaTosarExec += semPacote; banhosParaTosarPacoteExec += noPacote; Debugger.logItem('prod_tecnico', { Colaborador: collab, Servico: nome, NoPacote: noPacote, SemPacote: semPacote, Total: totalLinha }); }
            } else if (mode === 'extra') {
                extrasExec += semPacote; extrasExecValor += val; Debugger.logItem('prod_extras', { Colaborador: collab, Servico: nome, NoPacote: noPacote, SemPacote: semPacote, Total: totalLinha, 'Valor Total (R$)': val });
            }
        });
        return { banhosPacoteExec, tosasPacoteExec, banhosParaTosarPacoteExec, banhosAvulsosExec, banhosParaTosarExec, tosasAvulsasExec, extrasExec, extrasExecValor, totalQtdNormal };
    }

    function render(d, flags = {}) {
        const elResumo = document.getElementById("c04-resumo");
        if (!d || !elResumo) return;
        elResumo.innerHTML = `<table class="c04-table">${INDICADORES.map(i => {
            let aviso = ""; let subtitle = "";
            if (i.key === 'fat_total') { if (flags.caixa) aviso = `<span class="c04-warning-tag">${flags.caixa === 'zerado' ? 'VAZIO' : 'ERRO'}</span>`; if (flags.fat_total) subtitle = formatDiffMsg(flags.fat_total.diff, flags.fat_total.percent, true); } 
            else if (i.key === 'fat_extras' && flags.fat_extras) { subtitle = formatDiffMsg(flags.fat_extras.diff, flags.fat_extras.percent, true); } 
            else if (i.key === 'qtd_serv_agend' && flags.qtd_serv_agend) { subtitle = formatDiffMsg(flags.qtd_serv_agend.diff, flags.qtd_serv_agend.percent); } 
            else if (i.key === 'qtd_banho_avulso' && flags.qtd_banho_avulso) { subtitle = formatDiffMsg(flags.qtd_banho_avulso.diff, flags.qtd_banho_avulso.percent); } 
            else if (i.key === 'qtd_tosa_avulsa' && flags.qtd_tosa_avulsa) { subtitle = formatDiffMsg(flags.qtd_tosa_avulsa.diff, flags.qtd_tosa_avulsa.percent); } 
            else if (i.key === 'qtd_extras_avulsos' && flags.qtd_extras_avulsos) { subtitle = formatDiffMsg(flags.qtd_extras_avulsos.diff, flags.qtd_extras_avulsos.percent); }
            if ((i.key.includes('banho') || i.key.includes('tosa')) && flags.vendas) aviso = `<span class="c04-warning-tag">ERRO VENDAS</span>`;
            return `<tr><td>${i.label}</td><td>${i.type === 'currency' ? formatBRL(d[i.key]) : d[i.key]}${aviso}${subtitle}</td></tr>`;
        }).join('')}</table>`;
        const btn = document.getElementById("c04-copiar");
        if (btn) btn.onclick = () => {
            const txt = INDICADORES.map(i => i.type === 'currency' ? d[i.key].toFixed(2).replace(".", ",") : d[i.key]).join("\n");
            copyToClipboard(txt); setStatus("Copiado!", "success"); btn.classList.add("c04-btn-copied"); btn.innerText = "COPIADO!"; setTimeout(() => { btn.classList.remove("c04-btn-copied"); btn.innerText = "COPIAR VALORES"; }, 1000);
        };
    }

    // --- LISTENER GLOBAL DE TEARDOWN ---
    window.addEventListener('c04_global_teardown', destroyModule);

    // --- ESCUTA O EVENTO DA SUITE ---
    window.addEventListener('c04_open_metas', function () {
        initModule();
    });

})();
