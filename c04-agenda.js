/**
 * CLUBE04 - MÓDULO AGENDA & PROJEÇÃO (Suite Version)
 * Baseado na arquitetura do c04-metas.js e estrutura do agenda.txt
 * Versão: 16.0.0
 */
(function () {
    "use strict";

    // --- CONFIGURAÇÕES ---
    // URL baseada na análise dos seus arquivos anteriores
    const URL_AGENDA = "https://clube04.com.br/digital/agenda.php"; 
    
    const CONFIG = {
        META_OCUPACAO_PADRAO: 65, 
        DIAS_NAO_TRABALHADOS: [0], // 0 = Domingo
        // Mapeamento de cores baseado no agenda.txt e script anterior
        CORES_SERVICOS: {
            'rgb(204, 255, 204)': 'banho', // #CCFFCC
            'rgb(204, 238, 255)': 'tosa',  // #CCEEFF (Azul claro, verificado no source 78)
            'rgb(230, 230, 230)': 'disponivel', // #E6E6E6 (Cinza claro, livre)
            'rgb(255, 204, 204)': 'bloqueado'   // #FFCCCC (Vermelho claro, bloqueado/vazio)
        }
    };

    // --- ESTILOS CSS ---
    const STYLES_CSS = `
        #c04-painel-agenda { position: fixed; top: 5%; left: 50%; transform: translateX(-50%); width: 550px; max-height: 90vh; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); z-index: 2147483647; display: none; font-family: 'Segoe UI', sans-serif; border: 1px solid #cbd5e1; flex-direction: column; overflow: hidden; } 
        #c04-ag-header { background: #f59e0b; color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; cursor: grab; font-weight:bold; } 
        #c04-ag-body { padding: 20px; overflow-y: auto; background: #f8fafc; flex: 1; }
        .c04-ag-section { background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px; }
        .c04-ag-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-end; }
        .c04-ag-col { flex: 1; }
        .c04-ag-label { display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; }
        .c04-ag-input { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
        .c04-ag-btn { width: 100%; padding: 10px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; color: white; transition: 0.2s; }
        .btn-primary { background: #f59e0b; color: #fff; } .btn-primary:hover { background: #d97706; }
        .btn-danger { background: white; color: #dc2626; border: 1px solid #dc2626; margin-top:5px; } .btn-danger:hover { background: #fee2e2; }
        #c04-ag-status { font-size: 12px; text-align: center; color: #64748b; margin: 10px 0; font-style: italic; min-height: 20px; }
        .c04-ag-table { width: 100%; font-size: 12px; border-collapse: collapse; margin-top: 10px; }
        .c04-ag-table th { background: #eee; text-align: left; padding: 8px; border-bottom: 2px solid #ccc; }
        .c04-ag-table td { padding: 8px; border-bottom: 1px solid #eee; }
        .c04-stat-box { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .c04-stat-item { background: #eff6ff; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #bfdbfe; }
        .c04-stat-val { display: block; font-size: 18px; font-weight: bold; color: #1e40af; }
        .c04-stat-lbl { font-size: 10px; text-transform: uppercase; color: #60a5fa; }
    `;

    // --- VARIÁVEIS DE ESTADO ---
    let dadosHistoricos = JSON.parse(localStorage.getItem('c04_agenda_cache_v16')) || {};
    let isRunning = false;

    // --- INTERFACE GRÁFICA ---
    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    function initModule() {
        if (document.getElementById("c04-painel-agenda")) {
            document.getElementById("c04-painel-agenda").style.display = 'flex';
            return;
        }

        addStyle(STYLES_CSS);

        const mainDiv = document.createElement("div");
        mainDiv.id = "c04-painel-agenda";
        mainDiv.innerHTML = `
            <div id="c04-ag-header"><span>📅 Análise de Agenda</span><span id="c04-ag-close" style="cursor:pointer;">×</span></div>
            <div id="c04-ag-body">
                <div class="c04-ag-section">
                    <div class="c04-ag-label">1. Configuração de Período</div>
                    <div class="c04-ag-row">
                        <div class="c04-ag-col"><label class="c04-ag-label">Início Histórico</label><input type="date" id="ag-ini" class="c04-ag-input"></div>
                        <div class="c04-ag-col"><label class="c04-ag-label">Fim Histórico</label><input type="date" id="ag-fim" class="c04-ag-input"></div>
                    </div>
                    <div class="c04-ag-row">
                        <div class="c04-ag-col"><label class="c04-ag-label">Hoje (Referência)</label><input type="date" id="ag-vigente" class="c04-ag-input"></div>
                        <div class="c04-ag-col"><label class="c04-ag-label">Meta (%)</label><input type="number" id="ag-meta" class="c04-ag-input" value="65"></div>
                    </div>
                    <div id="c04-ag-status">Aguardando...</div>
                    <button id="ag-btn-run" class="c04-ag-btn btn-primary">ANALISAR E PROJETAR</button>
                    <div style="text-align:right; margin-top:5px; font-size:10px; color:#999;">Dias em cache: <span id="lbl-cache">0</span></div>
                </div>

                <div id="ag-result" style="display:none;">
                    <div class="c04-ag-section">
                        <div class="c04-ag-label">Resumo Histórico</div>
                        <div class="c04-stat-box" id="ag-stats-hist"></div>
                    </div>
                    <div class="c04-ag-section">
                        <div class="c04-ag-label">Projeção Mensal</div>
                        <div id="ag-projecao-content"></div>
                    </div>
                </div>

                <button id="ag-btn-clear" class="c04-ag-btn btn-danger">Limpar Memória</button>
            </div>
        `;
        document.body.appendChild(mainDiv);

        setupDrag(mainDiv, document.getElementById("c04-ag-header"));
        document.getElementById("c04-ag-close").onclick = () => mainDiv.style.display = 'none';

        // Preencher Datas
        const hoje = new Date();
        const iniMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        
        document.getElementById("ag-vigente").value = hoje.toISOString().split('T')[0];
        document.getElementById("ag-ini").value = iniMes.toISOString().split('T')[0];
        document.getElementById("ag-fim").value = fimMes.toISOString().split('T')[0];
        updateCacheLabel();

        document.getElementById("ag-btn-run").onclick = runAnalysis;
        document.getElementById("ag-btn-clear").onclick = () => {
            if(confirm("Limpar todo o histórico salvo?")) {
                dadosHistoricos = {};
                localStorage.setItem('c04_agenda_cache_v16', JSON.stringify(dadosHistoricos));
                updateCacheLabel();
                setStatus("Memória limpa.");
            }
        };
    }

    function setupDrag(element, handle) {
        let startX, startY;
        handle.onmousedown = (e) => {
            e.preventDefault(); startX = e.clientX; startY = e.clientY; 
            let iL = element.offsetLeft, iT = element.offsetTop;
            const move = (evt) => {
                element.style.left = `${iL + evt.clientX - startX}px`; 
                element.style.top = `${iT + evt.clientY - startY}px`; 
            };
            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
        };
    }

    function setStatus(msg, loading = false) {
        document.getElementById("c04-ag-status").innerHTML = loading ? `⏳ ${msg}` : msg;
    }

    function updateCacheLabel() {
        document.getElementById("lbl-cache").innerText = Object.keys(dadosHistoricos).length;
    }

    // --- LÓGICA PRINCIPAL ---

    async function runAnalysis() {
        if (isRunning) return;
        isRunning = true;
        const btn = document.getElementById("ag-btn-run");
        btn.disabled = true;
        document.getElementById("ag-result").style.display = "none";

        try {
            const dtIni = document.getElementById("ag-ini").value;
            const dtFim = document.getElementById("ag-fim").value;
            const dtVigente = document.getElementById("ag-vigente").value;
            const metaPct = parseFloat(document.getElementById("ag-meta").value) / 100;

            // 1. Calcular quais dias precisamos buscar (Histórico + Futuro do Mês)
            const diasParaProcessar = new Set();
            
            // Intervalo Histórico Selecionado
            let dLoop = new Date(dtIni);
            while(dLoop <= new Date(dtFim)) {
                diasParaProcessar.add(dLoop.toISOString().split('T')[0]);
                dLoop.setDate(dLoop.getDate() + 1);
            }
            
            // Intervalo do Mês Vigente Completo (para projeção)
            const mesVigenteIni = new Date(new Date(dtVigente).getFullYear(), new Date(dtVigente).getMonth(), 1);
            const mesVigenteFim = new Date(new Date(dtVigente).getFullYear(), new Date(dtVigente).getMonth() + 1, 0);
            
            dLoop = new Date(mesVigenteIni);
            while(dLoop <= mesVigenteFim) {
                const s = dLoop.toISOString().split('T')[0];
                // Se o dia é hoje ou futuro, removemos do cache para garantir dados frescos
                if (s >= dtVigente) delete dadosHistoricos[s]; 
                diasParaProcessar.add(s);
                dLoop.setDate(dLoop.getDate() + 1);
            }

            const listaDatas = Array.from(diasParaProcessar).sort();
            const faltantes = listaDatas.filter(d => !dadosHistoricos[d] && !CONFIG.DIAS_NAO_TRABALHADOS.includes(new Date(d + "T12:00:00").getDay()));

            // 2. Coletar dados usando Iframe Oculto (Ajax Hooks)
            if (faltantes.length > 0) {
                setStatus(`Iniciando leitura de ${faltantes.length} dias...`, true);
                const ifr = await createIfr(URL_AGENDA);
                try {
                    for (let i = 0; i < faltantes.length; i++) {
                        const dia = faltantes[i];
                        setStatus(`Lendo agenda: ${dia} (${i+1}/${faltantes.length})`, true);
                        await fetchAndParseDay(ifr, dia);
                        
                        localStorage.setItem('c04_agenda_cache_v16', JSON.stringify(dadosHistoricos));
                        updateCacheLabel();
                    }
                } catch (e) {
                    throw new Error("Erro na coleta: " + e.message);
                } finally {
                    ifr.remove();
                }
            }

            // 3. Cálculos e Exibição
            setStatus("Processando...", true);
            
            const analise = calcularAnaliseHistorica(listaDatas.filter(d => d >= dtIni && d <= dtFim));
            renderHistorico(analise);

            const projecao = calcularMetas(analise, metaPct, new Date(dtVigente + "T12:00:00"));
            renderProjecao(projecao);

            document.getElementById("ag-result").style.display = "block";
            setStatus("✅ Análise Concluída!");

        } catch (err) {
            setStatus("❌ Erro: " + err.message);
            console.error(err);
        } finally {
            isRunning = false;
            btn.disabled = false;
        }
    }

    // --- MANIPULAÇÃO DO IFRAME (AJAX HOOKS) ---

    async function createIfr(u) {
        const f = document.createElement("iframe");
        f.style.display = "none";
        f.src = u;
        document.body.appendChild(f);
        await new Promise(r => f.onload = r);
        return f;
    }

    function fetchAndParseDay(ifr, dataIso) {
        return new Promise((resolve, reject) => {
            const doc = ifr.contentDocument;
            const win = ifr.contentWindow;

            if (!win.$) return reject(new Error("jQuery não detectado na agenda"));

            // Elementos baseados no agenda.txt 
            const inputData = doc.getElementById('dataAgendaBusca');
            if (!inputData) return reject(new Error("Input de data não encontrado"));

            const timeout = setTimeout(() => reject(new Error("Timeout Ajax")), 8000);
            
            const hook = (event, xhr, settings) => {
                if (settings) {
                    win.$(doc).off("ajaxComplete", hook);
                    clearTimeout(timeout);
                    setTimeout(() => {
                        const dados = parseTable(doc, dataIso);
                        // Salva apenas se houver dados válidos (evita salvar feriados 100% fechados como 0)
                        if (dados.totalSlots > 0) {
                             dadosHistoricos[dataIso] = dados.stats;
                        }
                        resolve();
                    }, 200);
                }
            };

            win.$(doc).on("ajaxComplete", hook);
            
            // Dispara mudança de data
            inputData.value = dataIso;
            inputData.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Força o clique na aba se necessário (baseado no agenda.txt )
            const aba = doc.querySelector('a[href="#idAbaTabela"]');
            if (aba) aba.click();
        });
    }

    function parseTable(doc, dataIso) {
        // ID confirmado no agenda.txt 
        const tabela = doc.querySelector('#idTabelaAgendamentos2'); 
        if (!tabela) return { totalSlots: 0, stats: null };

        const statsDia = { servicos: [], disponivel: 0, bloqueado: 0 };
        const mapaDeServicos = new Map();
        
        // Regex para capturar ID do serviço no onclick="modalAgendaEditar('1087591')" 
        const regexId = /modalAgendaEditar\('(\d+)'\)/;

        let totalSlotsProfissional = 0;
        
        tabela.querySelectorAll('tbody tr').forEach(linha => {
            const celulas = linha.querySelectorAll('td');
            // Ignora primeira coluna (Horário) e última
            for (let i = 1; i < celulas.length - 1; i++) {
                totalSlotsProfissional++;
                const celula = celulas[i];
                const cor = celula.style.backgroundColor || ''; // Ex: #CCFFCC
                
                // Mapeia RGB/Hex para tipo (baseado no CONFIG)
                let tipoStatus = 'disponivel';
                for (let [rgb, tipo] of Object.entries(CONFIG.CORES_SERVICOS)) {
                    if (cor.includes(rgb) || cor.toLowerCase() === rgb) tipoStatus = tipo;
                    // Conversão manual rápida de Hex comuns se o browser converter
                    if (cor === 'rgb(204, 255, 204)') tipoStatus = 'banho';
                    if (cor === 'rgb(255, 204, 204)') tipoStatus = 'bloqueado';
                }

                const onclickAttr = celula.getAttribute('onclick');
                const match = onclickAttr ? onclickAttr.match(regexId) : null;
                const idServico = match ? match[1] : null;

                if (idServico) {
                    if (mapaDeServicos.has(idServico)) {
                        mapaDeServicos.get(idServico).duracao++;
                    } else {
                        mapaDeServicos.set(idServico, { tipo: tipoStatus, duracao: 1 });
                    }
                } else if (tipoStatus === 'bloqueado') {
                    statsDia.bloqueado++;
                } else {
                    statsDia.disponivel++;
                }
            }
        });

        statsDia.servicos = Array.from(mapaDeServicos.values());

        // Se tudo estiver bloqueado, consideramos Feriado/Fechado
        if (totalSlotsProfissional > 0 && statsDia.bloqueado >= totalSlotsProfissional) {
            return { totalSlots: 0, stats: null };
        }

        return { totalSlots: totalSlotsProfissional, stats: statsDia };
    }

    // --- CÁLCULOS MATEMÁTICOS ---

    function calcularAnaliseHistorica(datas) {
        const analise = { servicos: [], diasDaSemana: {} };
        for (let i = 0; i < 7; i++) if (!CONFIG.DIAS_NAO_TRABALHADOS.includes(i)) analise.diasDaSemana[i] = { servicos: 0, slotsOcupados: 0, slotsAgendaveis: 0, ocorrencias: 0 };

        datas.forEach(d => {
            const dadosDia = dadosHistoricos[d]; 
            if (!dadosDia) return;
            
            const diaSemana = new Date(d + 'T12:00:00').getDay();
            const sumarioDia = analise.diasDaSemana[diaSemana];
            
            if (sumarioDia) {
                analise.servicos.push(...dadosDia.servicos);
                const slotsOcupadosDia = dadosDia.servicos.reduce((sum, s) => sum + s.duracao, 0);
                const slotsAgendaveisDia = slotsOcupadosDia + dadosDia.disponivel;
                
                if (slotsAgendaveisDia > 0) {
                    sumarioDia.servicos += dadosDia.servicos.length;
                    sumarioDia.slotsOcupados += slotsOcupadosDia;
                    sumarioDia.slotsAgendaveis += slotsAgendaveisDia;
                    sumarioDia.ocorrencias++;
                }
            }
        });

        const totalSlotsOcupados = analise.servicos.reduce((s, serv) => s + serv.duracao, 0);
        const totalSlotsAgendaveis = Object.values(analise.diasDaSemana).reduce((s, d) => s + d.slotsAgendaveis, 0);

        return {
            ocupacaoMediaPeriodo: totalSlotsAgendaveis > 0 ? totalSlotsOcupados / totalSlotsAgendaveis : 0,
            qtdeServicos: analise.servicos.length,
            tempoMedioGeral: analise.servicos.length > 0 ? totalSlotsOcupados / analise.servicos.length : 2
        };
    }

    function calcularMetas(analiseHistorica, metaOcupacaoGeral, dataVigente) {
        const mesIni = new Date(dataVigente.getFullYear(), dataVigente.getMonth(), 1);
        const mesFim = new Date(dataVigente.getFullYear(), dataVigente.getMonth() + 1, 0);
        
        let stats = {
            parcial: { slotsOcupados: 0, slotsAgendaveis: 0, servicos: 0 },
            futuro: { slotsOcupados: 0, slotsAgendaveis: 0, servicos: 0 },
            totalSlotsMes: 0
        };

        const tempoMedio = analiseHistorica.tempoMedioGeral || 2;
        let dLoop = new Date(mesIni);

        while(dLoop <= mesFim) {
            const dataStr = dLoop.toISOString().split('T')[0];
            const diaSemana = dLoop.getDay();
            
            if (!CONFIG.DIAS_NAO_TRABALHADOS.includes(diaSemana)) {
                const historico = dadosHistoricos[dataStr];
                
                let slotsCapacidade = 0;
                let slotsOcupados = 0;
                let servicosFeitos = 0;

                if (historico) {
                    slotsOcupados = historico.servicos.reduce((a,b)=>a+b.duracao,0);
                    slotsCapacidade = slotsOcupados + historico.disponivel;
                    servicosFeitos = historico.servicos.length;
                } else {
                    // Estimativa conservadora baseada em média histórica se não tiver dados
                    const mediaDia = analiseHistorica.diasDaSemana[diaSemana];
                    if (mediaDia && mediaDia.ocorrencias > 0) {
                         slotsCapacidade = mediaDia.slotsAgendaveis / mediaDia.ocorrencias;
                    }
                }

                stats.totalSlotsMes += slotsCapacidade;
                const isPassado = dLoop < dataVigente;
                
                if (isPassado) {
                    stats.parcial.slotsOcupados += slotsOcupados;
                    stats.parcial.slotsAgendaveis += slotsCapacidade;
                    stats.parcial.servicos += servicosFeitos;
                } else {
                    stats.futuro.slotsOcupados += slotsOcupados;
                    stats.futuro.slotsAgendaveis += slotsCapacidade;
                    stats.futuro.servicos += servicosFeitos;
                }
            }
            dLoop.setDate(dLoop.getDate() + 1);
        }

        const slotsMetaTotal = stats.totalSlotsMes * metaOcupacaoGeral;
        const slotsJaOcupados = stats.parcial.slotsOcupados + stats.futuro.slotsOcupados;
        const slotsFaltantes = slotsMetaTotal - slotsJaOcupados;
        const servicosFaltantes = slotsFaltantes > 0 ? slotsFaltantes / tempoMedio : 0;
        const ocupacaoAtualGlobal = (stats.parcial.slotsOcupados + stats.futuro.slotsOcupados) / (stats.parcial.slotsAgendaveis + stats.futuro.slotsAgendaveis || 1);

        return {
            ocupacaoAtual: ocupacaoAtualGlobal,
            servicosRealizados: stats.parcial.servicos,
            servicosAgendadosFuturo: stats.futuro.servicos,
            servicosFaltantes: Math.ceil(servicosFaltantes),
            tempoMedio: tempoMedio
        };
    }

    // --- RENDERIZAÇÃO ---
    function renderHistorico(a) {
        document.getElementById("ag-stats-hist").innerHTML = `
            <div class="c04-stat-item">
                <span class="c04-stat-val">${(a.ocupacaoMediaPeriodo * 100).toFixed(1)}%</span>
                <span class="c04-stat-lbl">Ocupação Histórica</span>
            </div>
            <div class="c04-stat-item">
                <span class="c04-stat-val">${a.qtdeServicos}</span>
                <span class="c04-stat-lbl">Serviços Analisados</span>
            </div>
        `;
    }

    function renderProjecao(p) {
        document.getElementById("ag-projecao-content").innerHTML = `
            <div class="c04-stat-box" style="margin-bottom:15px;">
                <div class="c04-stat-item" style="background:#ecfdf5; border-color:#86efac;">
                    <span class="c04-stat-val" style="color:#166534">${(p.ocupacaoAtual * 100).toFixed(1)}%</span>
                    <span class="c04-stat-lbl">Ocupação Projetada (Mês)</span>
                </div>
                <div class="c04-stat-item" style="background:#fff7ed; border-color:#fdba74;">
                    <span class="c04-stat-val" style="color:#9a3412">${p.servicosFaltantes}</span>
                    <span class="c04-stat-lbl">Faltam para Meta</span>
                </div>
            </div>
            <table class="c04-ag-table">
                <tr><td>Já realizados:</td><td><strong>${p.servicosRealizados}</strong></td></tr>
                <tr><td>Agendados Futuro:</td><td><strong>${p.servicosAgendadosFuturo}</strong></td></tr>
                <tr><td>Tempo Médio/Serviço:</td><td>${(p.tempoMedio).toFixed(2)} slots</td></tr>
            </table>
        `;
    }

    // --- INICIALIZAÇÃO VIA SUITE ---
    window.addEventListener('c04_open_agenda', function () {
        initModule();
    });

})();
