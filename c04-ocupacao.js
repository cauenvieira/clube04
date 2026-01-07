/**
 * CLUBE04 - MÓDULO OCUPAÇÃO (Deep Analytics)
 * Adaptado para integração com Suite Central
 * Reformulado com base na arquitetura do c04-metas.js
 */
(function () {
    "use strict";

    // --- Configurações ---
    const ENDPOINTS = {
        OCUPACAO: "https://clube04.com.br/digital/Dashboard/DashboardN010.php",
        SERVICOS: "https://clube04.com.br/digital/Dashboard/DashboardN008.php",
        FATURAMENTO: "https://clube04.com.br/digital/Dashboard/DashboardN003.php"
    };

    const DIAS_SEMANA = ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"];

    // --- Helpers UI (Estilos iguais ao Metas) ---
    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    // --- HTML Styles ---
    const STYLES_CSS = `
        #c04-painel-ocup { position: fixed; top: 10%; left: 50%; transform: translateX(-50%); width: 600px; max-height: 90vh; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); z-index: 2147483647; display: none; font-family: 'Segoe UI', Tahoma, sans-serif; border: 1px solid #cbd5e1; flex-direction: column; overflow: hidden; } 
        #c04-header-ocup { background: #6d28d9; color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; cursor: grab; border-radius: 12px 12px 0 0; user-select: none; } 
        #c04-header-ocup:active { cursor: grabbing; } 
        #c04-body-ocup { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; } 
        .c04-row { display: flex; gap: 10px; align-items: flex-end; } 
        .c04-col { flex: 1; } 
        .c04-label { display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; } 
        .c04-input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; box-sizing: border-box; } 
        .c04-btn { padding: 10px 16px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 13px; width: 100%; } 
        .c04-btn-primary { background: #8b5cf6; color: #fff; } 
        .c04-btn-primary:hover { background: #7c3aed; } 
        .c04-btn-success { background: #10b981; color: #fff; }
        .c04-btn-success:hover { background: #059669; }
        .c04-btn:disabled { background: #cbd5e1; cursor: not-allowed; }
        #c04-status-ocup { font-size: 12px; color: #475569; text-align: center; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; } 
        
        /* Progress Bar */
        .c04-progress-container { width: 100%; background-color: #e2e8f0; border-radius: 4px; height: 6px; overflow: hidden; margin-top: 5px; display:none; }
        .c04-progress-bar { height: 100%; background-color: #8b5cf6; width: 0%; transition: width 0.3s; }

        /* Tabelas de Resultado */
        .c04-table-resumo { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
        .c04-table-resumo th { background: #f1f5f9; text-align: left; padding: 8px; color: #475569; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
        .c04-table-resumo td { padding: 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .c04-val { font-family: monospace; font-weight: 600; }
        
        /* Gráfico CSS Simples */
        .c04-chart-row { display: flex; align-items: flex-end; height: 100px; gap: 4px; padding-top: 10px; border-bottom: 1px solid #cbd5e1; margin-bottom: 10px; }
        .c04-bar-group { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; position: relative; }
        .c04-bar { width: 80%; background: #ddd; border-radius: 2px 2px 0 0; min-height: 1px; transition: height 0.5s; position: relative; }
        .c04-bar-ocup { background: #8b5cf6; }
        .c04-bar-label { font-size: 9px; color: #64748b; margin-top: 4px; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg); }
        .c04-bar:hover::after { content: attr(data-title); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #1e293b; color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap; z-index: 10; pointer-events: none; }
    `;

    // --- Inicialização ---
    function initModule() {
        if (document.getElementById("c04-painel-ocup")) {
            document.getElementById("c04-painel-ocup").style.display = 'flex';
            return;
        }

        addStyle(STYLES_CSS);

        const mainDiv = document.createElement("div");
        mainDiv.id = "c04-painel-ocup";
        mainDiv.innerHTML = `
        <div id="c04-header-ocup"><span>Análise de Ocupação & Metas</span><button id="c04-close-ocup" style="background:none; border:none; color:#e2e8f0; cursor:pointer; font-size:24px; line-height:1;">×</button></div>
        <div id="c04-body-ocup">
            <div class="c04-row">
                <div class="c04-col"><label class="c04-label">Data Início</label><input type="date" id="c04-ocup-ini" class="c04-input"></div>
                <div class="c04-col"><label class="c04-label">Data Fim</label><input type="date" id="c04-ocup-fim" class="c04-input"></div>
            </div>
            
            <button id="c04-btn-analisar" class="c04-btn c04-btn-primary">INICIAR ANÁLISE DETALHADA</button>
            
            <div class="c04-progress-container" id="c04-progress-wrapper">
                <div class="c04-progress-bar" id="c04-progress-bar"></div>
            </div>
            <div id="c04-status-ocup">Selecione o período para começar.</div>
            
            <div id="c04-resumo-ocup"></div>
            
            <button id="c04-btn-csv" class="c04-btn c04-btn-success" style="display:none;">BAIXAR RELATÓRIO CSV</button>
        </div>`;
        document.body.appendChild(mainDiv);

        setupLogic();
        setupDrag(mainDiv, document.getElementById("c04-header-ocup"));
    }

    function setupDrag(element, handle) {
        let startX, startY, moved = false;
        handle.onmousedown = (e) => {
            e.preventDefault(); startX = e.clientX; startY = e.clientY; let iL = element.offsetLeft, iT = element.offsetTop;
            const move = (evt) => {
                element.style.left = `${iL + evt.clientX - startX}px`; element.style.top = `${iT + evt.clientY - startY}px`; element.style.transform = "none";
            };
            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
        };
    }

    // --- Lógica Principal ---
    function setupLogic() {
        const elIni = document.getElementById("c04-ocup-ini");
        const elFim = document.getElementById("c04-ocup-fim");
        const btnAnalisar = document.getElementById("c04-btn-analisar");
        const btnCsv = document.getElementById("c04-btn-csv");
        const elStatus = document.getElementById("c04-status-ocup");
        const elResumo = document.getElementById("c04-resumo-ocup");
        const elProgWrapper = document.getElementById("c04-progress-wrapper");
        const elProgBar = document.getElementById("c04-progress-bar");

        // Datas Padrão (Últimos 30 dias)
        const hoje = new Date();
        const passado = new Date(); passado.setDate(hoje.getDate() - 30);
        elFim.value = hoje.toISOString().split('T')[0];
        elIni.value = passado.toISOString().split('T')[0];

        // Cache do último resultado para CSV
        let ultimoResultado = null;

        document.getElementById("c04-close-ocup").onclick = () => document.getElementById("c04-painel-ocup").style.display = 'none';

        btnAnalisar.onclick = async () => {
            if (btnAnalisar.disabled) return;
            
            // UI Reset
            btnAnalisar.disabled = true; btnCsv.style.display = 'none';
            elResumo.innerHTML = ''; elProgWrapper.style.display = 'block'; elProgBar.style.width = '0%';
            ultimoResultado = null;

            try {
                const dtIni = new Date(elIni.value + "T00:00:00");
                const dtFim = new Date(elFim.value + "T00:00:00");
                const idUnidade = document.getElementById('idUnidade') ? document.getElementById('idUnidade').value : '';

                if (!idUnidade) throw new Error("ID da Unidade não encontrado. Você está logado?");

                const diffTime = Math.abs(dtFim - dtIni);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                if (diffDays > 90) {
                    if(!confirm(`Atenção: Você selecionou ${diffDays} dias. Isso pode demorar. Deseja continuar?`)) {
                        btnAnalisar.disabled = false; return;
                    }
                }

                let processados = 0;
                const dadosDiarios = [];

                elStatus.textContent = `Iniciando análise de ${diffDays} dias...`;

                // Loop de Requisições
                for (let i = 0; i < diffDays; i++) {
                    const currentDt = new Date(dtIni);
                    currentDt.setDate(dtIni.getDate() + i);
                    
                    const diaSemana = DIAS_SEMANA[currentDt.getDay()];
                    const dataFmt = currentDt.toISOString().split('T')[0]; // YYYY-MM-DD
                    const dataPt = currentDt.toLocaleDateString('pt-BR');

                    // Atualiza Progresso
                    const pct = Math.round(((i + 1) / diffDays) * 100);
                    elProgBar.style.width = `${pct}%`;
                    elStatus.textContent = `Analisando: ${dataPt} (${diaSemana})...`;

                    // Pular Domingos (Opcional, mas economiza tempo se a loja fecha)
                    if (diaSemana === "Domingo") {
                        dadosDiarios.push({ data: dataFmt, diaSemana, ocupacao: 0, servicos: 0, faturamento: 0 });
                        continue;
                    }

                    // Prepara FormData
                    const fd = new FormData();
                    fd.append('dataInicioBusca', dataFmt);
                    fd.append('dataFimBusca', dataFmt);
                    fd.append('idUnidade', idUnidade);

                    // Fetch Paralelo para o dia (Performance Boost)
                    const [resOcup, resServ, resFat] = await Promise.all([
                        fetch(ENDPOINTS.OCUPACAO, { method: 'POST', body: fd }).then(r => r.text()),
                        fetch(ENDPOINTS.SERVICOS, { method: 'POST', body: fd }).then(r => r.text()),
                        fetch(ENDPOINTS.FATURAMENTO, { method: 'POST', body: fd }).then(r => r.text())
                    ]);

                    // Parsers (Regex nos scripts retornados)
                    const ocupacao = parseChartData(resOcup, /label: "Geral.*?data: \[([\d\.]+)/) || 0;
                    const servicos = parseSumData(resServ);
                    const faturamento = parseSumData(resFat);

                    dadosDiarios.push({
                        data: dataFmt,
                        dataPt: dataPt,
                        diaSemana: diaSemana,
                        ocupacao: parseFloat(ocupacao),
                        servicos: parseFloat(servicos),
                        faturamento: parseFloat(faturamento)
                    });

                    // Pequeno delay para não travar a UI em loops longos
                    if(i % 5 === 0) await new Promise(r => setTimeout(r, 10));
                }

                // Compilação dos Resultados
                ultimoResultado = processarResultados(dadosDiarios);
                renderizarDashboard(ultimoResultado, elResumo);

                elStatus.textContent = "Análise concluída com sucesso!";
                elStatus.className = "c04-status-success";
                btnCsv.style.display = 'block';

            } catch (err) {
                console.error(err);
                elStatus.textContent = "Erro: " + err.message;
                elStatus.style.color = "red";
            } finally {
                btnAnalisar.disabled = false;
                setTimeout(() => { elProgWrapper.style.display = 'none'; }, 2000);
            }
        };

        btnCsv.onclick = () => {
            if (ultimoResultado) gerarCSV(ultimoResultado);
        };
    }

    // --- Processamento de Dados ---
    function processarResultados(dados) {
        const diasUteis = dados.filter(d => d.diaSemana !== "Domingo");
        const totalFat = dados.reduce((a, b) => a + b.faturamento, 0);
        const totalServ = dados.reduce((a, b) => a + b.servicos, 0);
        
        // Médias Semanais
        const porDiaSemana = {};
        DIAS_SEMANA.forEach(d => { if(d !== "Domingo") porDiaSemana[d] = { count: 0, ocup: 0, fat: 0 }; });
        
        diasUteis.forEach(d => {
            if(porDiaSemana[d.diaSemana]) {
                porDiaSemana[d.diaSemana].count++;
                porDiaSemana[d.diaSemana].ocup += d.ocupacao;
                porDiaSemana[d.diaSemana].fat += d.faturamento;
            }
        });

        const resumoSemanal = Object.keys(porDiaSemana).map(dia => {
            const info = porDiaSemana[dia];
            return {
                dia: dia.replace("-Feira", ""),
                mediaOcup: info.count ? info.ocup / info.count : 0,
                mediaFat: info.count ? info.fat / info.count : 0
            };
        });

        return { dados, resumoSemanal, totalFat, totalServ };
    }

    // --- Renderização ---
    function renderizarDashboard(res, container) {
        // 1. Cards de Resumo
        const mediaOcupGeral = res.dados.filter(d => d.diaSemana !== "Domingo").reduce((a,b)=>a+b.ocupacao,0) / (res.dados.filter(d => d.diaSemana !== "Domingo").length || 1);
        
        let html = `
        <div style="display:flex; gap:10px; margin-bottom:15px;">
            <div style="flex:1; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                <div style="font-size:10px; color:#64748b; font-weight:bold;">FATURAMENTO TOTAL</div>
                <div style="font-size:16px; color:#0f172a; font-weight:bold;">${formatBRL(res.totalFat)}</div>
            </div>
            <div style="flex:1; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                <div style="font-size:10px; color:#64748b; font-weight:bold;">SERVIÇOS REALIZADOS</div>
                <div style="font-size:16px; color:#0f172a; font-weight:bold;">${res.totalServ}</div>
            </div>
            <div style="flex:1; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                <div style="font-size:10px; color:#64748b; font-weight:bold;">OCUPAÇÃO MÉDIA</div>
                <div style="font-size:16px; color:#8b5cf6; font-weight:bold;">${mediaOcupGeral.toFixed(1)}%</div>
            </div>
        </div>`;

        // 2. Gráfico CSS (Ocupação Semanal)
        const maxOcup = Math.max(...res.resumoSemanal.map(r => r.mediaOcup), 100);
        html += `<div style="margin-bottom:5px; font-size:11px; font-weight:bold; color:#334155;">MÉDIA DE OCUPAÇÃO POR DIA DA SEMANA</div>
        <div class="c04-chart-row">
            ${res.resumoSemanal.map(r => `
                <div class="c04-bar-group">
                    <div class="c04-bar c04-bar-ocup" style="height:${(r.mediaOcup/maxOcup)*100}%" data-title="${r.mediaOcup.toFixed(1)}%"></div>
                    <div class="c04-bar-label">${r.dia.substring(0,3)}</div>
                </div>
            `).join('')}
        </div>`;

        // 3. Tabela Detalhada (Top 5 e Últimos dias)
        html += `<div style="margin-top:15px; font-size:11px; font-weight:bold; color:#334155;">DETALHAMENTO DIÁRIO</div>
        <div style="max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:4px;">
            <table class="c04-table-resumo">
                <thead><tr><th>Data</th><th>Dia</th><th>Ocupação</th><th>Fat.</th></tr></thead>
                <tbody>
                    ${res.dados.map(d => `
                        <tr>
                            <td>${d.dataPt.substring(0,5)}</td>
                            <td>${d.diaSemana.replace("-Feira","")}</td>
                            <td class="c04-val" style="color:${d.ocupacao < 50 ? '#ef4444' : '#10b981'}">${d.ocupacao.toFixed(0)}%</td>
                            <td class="c04-val">${formatBRL(d.faturamento)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;

        container.innerHTML = html;
    }

    // --- Parsers ---
    function parseChartData(html, regex) {
        try {
            const scriptContent = html.match(/<script[^>]*>([\s\S]*?)<\/script>/); 
            if (!scriptContent || !scriptContent[1]) return 0;
            const match = scriptContent[1].match(regex);
            return (match && match[1]) ? parseFloat(match[1]) : 0;
        } catch (e) { return 0; }
    }

    function parseSumData(html) {
        try {
            const scriptContent = html.match(/<script[^>]*>([\s\S]*?)<\/script>/); 
            if (!scriptContent || !scriptContent[1]) return 0;
            const regex = /data: \[([\d.,\s]+)\]/g; 
            const match = scriptContent[1].match(regex); 
            if (!match) return 0; 
            let total = 0; 
            match.forEach(ds => { 
                const nums = ds.replace(/data: \[|\]/g, '').split(','); 
                nums.forEach(n => total += parseFloat(n.trim()) || 0); 
            }); 
            return total; 
        } catch (e) { return 0; }
    }

    function formatBRL(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

    function gerarCSV(res) {
        let csv = "Data;Dia;Ocupacao (%);Servicos (Qtd);Faturamento (R$)\n";
        res.dados.forEach(d => {
            csv += `${d.data};${d.diaSemana};${d.ocupacao.toFixed(2).replace('.',',')};${d.servicos};${d.faturamento.toFixed(2).replace('.',',')}\n`;
        });
        
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_ocupacao_c04.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    // --- Listener da Suite ---
    window.addEventListener('c04_open_ocupacao', function () {
        initModule();
    });

})();
