(function() {
    'use strict';
    // Bloco de segurança
    if (document.getElementById('painel-analise-agenda')) {
        if (window.automacaoAgenda && window.automacaoAgenda.isRunning) window.automacaoAgenda.parar();
        try { document.getElementById('painel-analise-agenda').remove(); document.getElementById('fab-container').remove(); } catch (e) {}
    }
    console.log("Analisador de Agenda v15.0 (Final Completo): Script iniciado...");

    // ===================================================================
    //  1. CONFIGURAÇÕES E ESTADO
    // ===================================================================
    const CONFIG = {
        META_OCUPACAO_PADRAO: 65, DIAS_NAO_TRABALHADOS: [0], // Domingo
        FREELANCER_ALERT_THRESHOLD: 0.90, TIMEOUT_POR_DATA: 15000, INTERVALO_VERIFICACAO: 250,
        CORES: { LARANJA_PRINCIPAL: '#FF6600', LARANJA_SECUNDARIA: '#FFA500' },
        CORES_SERVICOS: {
            'rgb(204, 255, 204)': 'banho', 'rgb(204, 255, 221)': 'banho', 'rgb(204, 238, 255)': 'tosa',
            'rgb(173, 216, 230)': 'tosa', 'rgb(0, 0, 255)': 'tosa', 'rgb(65, 105, 225)': 'tosa',
            'rgb(230, 230, 230)': 'disponivel', 'rgb(255, 204, 204)': 'bloqueado'
        }
    };
    window.automacaoAgenda = { isRunning: false };
    let dadosHistoricos = JSON.parse(localStorage.getItem('analiseAgendaDados_v15')) || {};

    // ===================================================================
    //  2. FUNÇÕES UTILITÁRIAS E DE UI
    // ===================================================================
    function log(m, t = 'n') { const l = document.getElementById('log-automacao'); if (l) { l.innerHTML += `<div class="log-${t}">[${new Date().toLocaleTimeString('pt-BR')}] ${m}</div>`; l.scrollTop = l.scrollHeight; } }
    function configurarBotoes(r) { const b = document.getElementById('btn-gerar-relatorio'); if (b) { b.disabled = r; b.innerText = r ? "Processando..." : "Gerar Plano"; } }
    function atualizarProgresso() { const e = document.getElementById('progresso-coleta'); if (e) e.innerText = Object.keys(dadosHistoricos).length; }
    function formatarSlotsParaHHMM(s) { if (isNaN(s) || s <= 0) return "00:00"; const t = s * 30, h = Math.floor(t / 60), m = Math.round(t % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    function getWeekOfMonth(date) { const d = date.getDate(), day = date.getDay(); return Math.ceil((d - 1 + (day === 0 ? 1 : 8 - day)) / 7); }

    // ===================================================================
    //  3. LÓGICA DE COLETA E ANÁLISE DE DADOS
    // ===================================================================
    function analisarTabelaAtual(dataAnalisada) {
        const tabela = document.querySelector('#idTabelaAgendamentos2'); if (!tabela) return { totalSlots: 0 };
        const statsDia = { servicos: [], disponivel: 0, bloqueado: 0 };
        const mapaDeServicos = new Map(); const regexId = /modalAgendaEditar\('(\d+)'\)/;
        const linhas = tabela.querySelectorAll('tbody tr'); let totalSlotsProfissional = 0;
        linhas.forEach(linha => {
            const celulas = linha.querySelectorAll('td');
            for (let i = 1; i < celulas.length - 1; i++) {
                totalSlotsProfissional++;
                const celula = celulas[i]; const cor = celula.style.backgroundColor; const tipoStatus = CONFIG.CORES_SERVICOS[cor] || 'disponivel';
                const onclickAttr = celula.getAttribute('onclick'); const match = onclickAttr ? onclickAttr.match(regexId) : null;
                const idServico = match ? match[1] : null;
                if (idServico && (tipoStatus === 'banho' || tipoStatus === 'tosa')) {
                    if (mapaDeServicos.has(idServico)) { mapaDeServicos.get(idServico).duracao++; } else { mapaDeServicos.set(idServico, { tipo: tipoStatus, duracao: 1 }); }
                } else if (tipoStatus === 'bloqueado') { statsDia.bloqueado++; } else { statsDia.disponivel++; }
            }
        });
        statsDia.servicos = Array.from(mapaDeServicos.values());
        dadosHistoricos[dataAnalisada] = statsDia;
        localStorage.setItem('analiseAgendaDados_v15', JSON.stringify(dadosHistoricos));
        atualizarProgresso();
        return { totalSlots: totalSlotsProfissional };
    }

    function processarUmaData(dataString) {
        return new Promise((resolve, reject) => {
            log(`- Processando ${dataString}...`, 'info');
            const dataInput = document.getElementById('dataAgendaBusca'); const tabela = document.querySelector('#idTabelaAgendamentos2');
            if (!dataInput || !tabela) return reject(new Error("Elementos da agenda não encontrados."));
            const snapshotInicial = tabela.innerHTML; let tempoDecorrido = 0;
            const pollingId = setInterval(() => {
                tempoDecorrido += CONFIG.INTERVALO_VERIFICACAO;
                const tabelaAtual = document.querySelector('#idTabelaAgendamentos2');
                if (tabelaAtual && tabelaAtual.innerHTML !== snapshotInicial) { clearInterval(pollingId); setTimeout(resolve, 300); } else if (tempoDecorrido >= CONFIG.TIMEOUT_POR_DATA) { clearInterval(pollingId); reject(new Error(`Timeout para ${dataString}.`)); }
            }, CONFIG.INTERVALO_VERIFICACAO);
            dataInput.value = dataString; dataInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof recarregarAbas === 'function') { recarregarAbas(); } else if (document.querySelector('a[href="#idAbaTabela"]')) { document.querySelector('a[href="#idAbaTabela"]').click(); } else { reject(new Error("Não foi possível encontrar o gatilho para recarregar a tabela.")); }
        });
    }

    async function iniciarColetaAutomatica(datasParaProcessar) {
        if (window.automacaoAgenda.isRunning) return;
        window.automacaoAgenda.isRunning = true; configurarBotoes(true);
        log(`Iniciando coleta de ${datasParaProcessar.length} dias necessários...`, 'info');
        for (const data of datasParaProcessar) {
            if (!window.automacaoAgenda.isRunning) { log('Coleta interrompida.', 'info'); break; }
            const dataObj = new Date(data + 'T12:00:00');
            if (CONFIG.DIAS_NAO_TRABALHADOS.includes(dataObj.getDay())) { continue; }
            try {
                await processarUmaData(data);
                const resultadoAnalise = analisarTabelaAtual(data);
                const diaColetado = dadosHistoricos[data];
                if (diaColetado && resultadoAnalise.totalSlots > 0 && diaColetado.bloqueado >= resultadoAnalise.totalSlots) {
                    log(`- ${data} detectado como feriado (100% bloqueado) e será ignorado.`, 'info');
                    delete dadosHistoricos[data];
                }
            } catch (error) { log(`❌ Falha ao coletar ${data}: ${error.message}`, 'error'); }
        }
        pararColeta();
    }
    function pararColeta() { window.automacaoAgenda.isRunning = false; configurarBotoes(false); }

    // ===================================================================
    //  4. CÁLCULO E LÓGICA DE NEGÓCIO
    // ===================================================================
    function calcularAnaliseHistorica(datas) {
        const analise = { servicos: [], diasDaSemana: {} };
        for (let i = 0; i < 7; i++) if (!CONFIG.DIAS_NAO_TRABALHADOS.includes(i)) analise.diasDaSemana[i] = { servicos: 0, slotsOcupados: 0, slotsAgendaveis: 0, ocorrencias: 0 };
        if (!datas || datas.length === 0) return analise;
        datas.forEach(d => {
            const dadosDia = dadosHistoricos[d]; if (!dadosDia) return;
            const diaSemana = new Date(d + 'T12:00:00').getDay(); const sumarioDia = analise.diasDaSemana[diaSemana];
            if (sumarioDia) {
                analise.servicos.push(...dadosDia.servicos); const slotsOcupadosDia = dadosDia.servicos.reduce((sum, s) => sum + s.duracao, 0);
                const slotsAgendaveisDia = slotsOcupadosDia + dadosDia.disponivel;
                if (slotsAgendaveisDia > 0) {
                    sumarioDia.servicos += dadosDia.servicos.length; sumarioDia.slotsOcupados += slotsOcupadosDia; sumarioDia.slotsAgendaveis += slotsAgendaveisDia; sumarioDia.ocorrencias++;
                }
            }
        });
        const banhos = analise.servicos.filter(s => s.tipo === 'banho'); const tosas = analise.servicos.filter(s => s.tipo === 'tosa');
        const totalSlotsOcupados = analise.servicos.reduce((s, serv) => s + serv.duracao, 0);
        const totalSlotsAgendaveis = Object.values(analise.diasDaSemana).reduce((s, d) => s + d.slotsAgendaveis, 0);
        return {
            ocupacaoMediaPeriodo: totalSlotsAgendaveis > 0 ? totalSlotsOcupados / totalSlotsAgendaveis : 0, qtdeServicos: analise.servicos.length, qtdeBanhos: banhos.length, qtdeTosas: tosas.length,
            tempoMedioBanho: banhos.length > 0 ? banhos.reduce((s, b) => s + b.duracao, 0) / banhos.length : 0,
            tempoMedioTosa: tosas.length > 0 ? tosas.reduce((s, t) => s + t.duracao, 0) / tosas.length : 0,
            tempoMedioGeral: analise.servicos.length > 0 ? totalSlotsOcupados / analise.servicos.length : 0,
            diasDaSemana: Object.fromEntries(Object.entries(analise.diasDaSemana).map(([diaIdx, dados]) => [diaIdx, { ...dados, taxaOcupacao: dados.slotsAgendaveis > 0 ? dados.slotsOcupados / dados.slotsAgendaveis : 0 }]))
        };
    }

    function calcularMetas(analiseHistorica, metaOcupacaoGeral, dataVigente) {
        const hoje = new Date(dataVigente); hoje.setHours(0, 0, 0, 0);
        const diaDaSemanaVigente = hoje.getDay();
        const inicioSemanaAtual = new Date(hoje);
        inicioSemanaAtual.setDate(hoje.getDate() - diaDaSemanaVigente + (diaDaSemanaVigente === 0 ? -6 : 1));
        const sabadoSemanaAnterior = new Date(inicioSemanaAtual); sabadoSemanaAnterior.setDate(inicioSemanaAtual.getDate() - 1);
        let ocupadosX = 0, agendaveisX = 0;
        let dLoop = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        while (dLoop <= sabadoSemanaAnterior) {
            const dadosDia = dadosHistoricos[dLoop.toISOString().split('T')[0]];
            if (dadosDia) {
                const slotsOcupados = dadosDia.servicos.reduce((s, serv) => s + serv.duracao, 0);
                ocupadosX += slotsOcupados;
                agendaveisX += slotsOcupados + dadosDia.disponivel;
            }
            dLoop.setDate(dLoop.getDate() + 1);
        }
        const x = agendaveisX > 0 ? ocupadosX / agendaveisX : 0;
        log(`Ocupação do início do mês até a semana passada (x): ${(x * 100).toFixed(1)}%`, 'info');

        let y = (metaOcupacaoGeral * 2) - x;
        if (y > 1) y = 1.0;
        if (y < metaOcupacaoGeral) y = metaOcupacaoGeral;
        log(`Meta de ocupação ajustada para a Semana Atual (y): ${(y * 100).toFixed(1)}%`, 'info');

        const fimSemanaAtual = new Date(inicioSemanaAtual); fimSemanaAtual.setDate(inicioSemanaAtual.getDate() + 6);
        const inicioProximaSemana = new Date(fimSemanaAtual); inicioProximaSemana.setDate(fimSemanaAtual.getDate() + 1);
        const fimProximaSemana = new Date(inicioProximaSemana); fimProximaSemana.setDate(inicioProximaSemana.getDate() + 6);

        return {
            mensal: calcularMetasPeriodo(new Date(hoje.getFullYear(), hoje.getMonth(), 1), new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0), hoje, analiseHistorica, metaOcupacaoGeral),
            semanaAtual: calcularMetasPeriodo(inicioSemanaAtual, fimSemanaAtual, hoje, analiseHistorica, y, true),
            proximaSemana: calcularMetasPeriodo(inicioProximaSemana, fimProximaSemana, hoje, analiseHistorica, metaOcupacaoGeral, false)
        };
    }

    function calcularMetasPeriodo(dataInicio, dataFim, dataVigente, analiseHistorica, metaOcupacaoPeriodo, aplicarDeficitIntraSemana = false) {
        let stats = {
            parcial: { ocupacao: 0, servicos: 0, slotsOcupados: 0, slotsAgendaveis: 0 },
            futuro: { servicos: 0, slotsOcupados: 0, slotsAgendaveis: 0 },
            projecao: { servicos: 0, slots: 0 }, metasDiarias: []
        };
        const tempoMedioGeral = analiseHistorica.tempoMedioGeral || 2;
        const fimMesVigente = new Date(dataVigente.getFullYear(), dataVigente.getMonth() + 1, 0);
        let dLoop = new Date(dataInicio);
        while (dLoop <= dataFim && dLoop <= fimMesVigente) {
            const dataStr = dLoop.toISOString().split('T')[0];
            if (!CONFIG.DIAS_NAO_TRABALHADOS.includes(dLoop.getDay())) {
                const dadosDoDia = dadosHistoricos[dataStr];
                if (dadosDoDia) {
                    const slotsOcupados = dadosDoDia.servicos.reduce((s, serv) => s + serv.duracao, 0);
                    const capacidadeDia = slotsOcupados + dadosDoDia.disponivel;
                    stats.projecao.slots += capacidadeDia;
                    if (dLoop < dataVigente) {
                        stats.parcial.servicos += dadosDoDia.servicos.length;
                        stats.parcial.slotsOcupados += slotsOcupados;
                        stats.parcial.slotsAgendaveis += capacidadeDia;
                    } else {
                        stats.futuro.servicos += dadosDoDia.servicos.length;
                        stats.futuro.slotsOcupados += slotsOcupados;
                        stats.futuro.slotsAgendaveis += capacidadeDia;
                    }
                }
            }
            dLoop.setDate(dLoop.getDate() + 1);
        }

        stats.parcial.ocupacao = stats.parcial.slotsAgendaveis > 0 ? stats.parcial.slotsOcupados / stats.parcial.slotsAgendaveis : 0;
        stats.especulativa = {
            ocupacao: (stats.parcial.slotsAgendaveis + stats.futuro.slotsAgendaveis) > 0 ? (stats.parcial.slotsOcupados + stats.futuro.slotsOcupados) / (stats.parcial.slotsAgendaveis + stats.futuro.slotsAgendaveis) : 0,
            servicos: stats.parcial.servicos + stats.futuro.servicos
        };
        stats.projecao.servicos = tempoMedioGeral > 0 ? (stats.projecao.slots * metaOcupacaoPeriodo) / tempoMedioGeral : 0;
        stats.faltam = stats.projecao.servicos - stats.especulativa.servicos;
        
        let deficitServicos = 0;
        if (aplicarDeficitIntraSemana) {
            const metaSlotsParcial = stats.parcial.slotsAgendaveis * metaOcupacaoPeriodo;
            const deficitSlots = metaSlotsParcial - stats.parcial.slotsOcupados;
            if (deficitSlots > 0) deficitServicos = deficitSlots / tempoMedioGeral;
        }

        let servicosAFazerNoPeriodo = (stats.faltam > 0 ? stats.faltam : 0) + deficitServicos;
        const pesosDias = {}; let pesoTotalRestante = 0; const diasRestantes = [];
        dLoop = new Date(dataVigente > dataInicio ? dataVigente : dataInicio);
        while(dLoop <= dataFim && dLoop <= fimMesVigente) {
            const diaSemana = dLoop.getDay();
            if (!CONFIG.DIAS_NAO_TRABALHADOS.includes(diaSemana)) {
                const histDia = analiseHistorica.diasDaSemana[diaSemana];
                const peso = (histDia && histDia.ocorrencias > 0) ? histDia.servicos / histDia.ocorrencias : 1;
                const dataStr = dLoop.toISOString().split('T')[0];
                pesosDias[dataStr] = peso; pesoTotalRestante += peso; diasRestantes.push(dataStr);
            }
            dLoop.setDate(dLoop.getDate() + 1);
        }

        if (pesoTotalRestante > 0) {
            for(let i=0; i < diasRestantes.length; i++){
                const dataStr = diasRestantes[i];
                const dataDia = new Date(dataStr + "T12:00:00");
                const pesoDia = pesosDias[dataStr];
                let metaServicosDia = (pesoDia / pesoTotalRestante) * servicosAFazerNoPeriodo;
                const dadosDoDiaFuturo = dadosHistoricos[dataStr];
                const agendamentosFeitos = dadosDoDiaFuturo?.servicos.length || 0;
                const slotsOcupadosFuturo = dadosDoDiaFuturo?.servicos.reduce((s, serv) => s + serv.duracao, 0) || 0;
                const capacidadeSlotsDia = slotsOcupadosFuturo + (dadosDoDiaFuturo?.disponivel || 0);
                const capacidadeServicosDia = tempoMedioGeral > 0 ? capacidadeSlotsDia / tempoMedioGeral : 0;
                let faltamDia = metaServicosDia;
                let superlotado = false;
                
                if((faltamDia + agendamentosFeitos) > capacidadeServicosDia) {
                    superlotado = true;
                    const deficitDoDia = faltamDia - (capacidadeServicosDia - agendamentosFeitos);
                    faltamDia = capacidadeServicosDia - agendamentosFeitos;
                    if(i + 1 < diasRestantes.length) {
                        servicosAFazerNoPeriodo += deficitDoDia; // Devolve ao bolo para ser redistribuído
                    }
                }
                
                stats.metasDiarias.push({
                    data: dataDia, meta: faltamDia + agendamentosFeitos, agendado: agendamentosFeitos,
                    faltam: Math.max(0, faltamDia),
                    superlotado: superlotado,
                    freelancer: capacidadeSlotsDia > 0 && ((slotsOcupadosFuturo / capacidadeSlotsDia) > CONFIG.FREELANCER_ALERT_THRESHOLD)
                });
            }
        }
        return stats;
    }
    
    // ===================================================================
    //  5. FUNÇÕES DE RENDERIZAÇÃO
    // ===================================================================
    function renderizarAnaliseHistorica(analise) {
        if (!analise || analise.qtdeServicos === 0) {
            document.getElementById('resultado-historico').innerHTML = `<div class="report-section"><h4>Análise do Período Selecionado</h4><p class="log-info">Nenhum serviço encontrado no período histórico para gerar a análise.</p></div>`;
            return;
        }
        const diasMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        document.getElementById('resultado-historico').innerHTML = `
            <div class="report-section"><h4>Análise do Período Selecionado</h4>
                <div class="stats-grid">
                    <div><strong>Ocup. Média:</strong> ${(analise.ocupacaoMediaPeriodo * 100).toFixed(1)}%</div>
                    <div><strong>Serviços Executados:</strong> ${analise.qtdeServicos}</div>
                    <div><strong>Banhos:</strong> ${analise.qtdeBanhos}</div>
                    <div><strong>Tosas:</strong> ${analise.qtdeTosas}</div>
                    <div><strong>Tempo Médio/Banho:</strong> ${formatarSlotsParaHHMM(analise.tempoMedioBanho)}</div>
                    <div><strong>Tempo Médio/Tosa:</strong> ${formatarSlotsParaHHMM(analise.tempoMedioTosa)}</div>
                    <div class="stat-geral"><strong>Tempo Médio Geral:</strong> ${formatarSlotsParaHHMM(analise.tempoMedioGeral)}</div>
                </div>
                <h5>Ocupação Histórica por Dia</h5>
                <table class="report-table"><thead><tr>${Object.keys(analise.diasDaSemana).filter(d=>analise.diasDaSemana[d].ocorrencias > 0).map(d=>`<th>${diasMap[d]}</th>`).join('')}</tr></thead>
                <tbody><tr>${Object.values(analise.diasDaSemana).filter(d=>d.ocorrencias > 0).map(d=>`<td>${(d.taxaOcupacao * 100).toFixed(1)}%</td>`).join('')}</tr></tbody></table>
            </div>`;
    }
    
    function renderizarProjecao(projecoes) {
        const { mensal, semanaAtual, proximaSemana, metaOcupacao, analiseHistorica, dataVigente } = projecoes;
        let html = `<div class="report-section">`;
        html += criarPainelMetaHTML(`Meta Mensal (${dataVigente.toLocaleDateString('pt-BR', {month: 'long'})})`, mensal, metaOcupacao);
        html += criarPainelMetaHTML(`Meta da Semana Atual (Semana ${getWeekOfMonth(dataVigente)})`, semanaAtual, metaOcupacao, true, analiseHistorica, dataVigente);
        html += criarPainelMetaHTML(`Meta da Próxima Semana`, proximaSemana, metaOcupacao, true, analiseHistorica, dataVigente);
        html += `</div>`;
        document.getElementById('resultado-projecao').innerHTML = html;
    }
    
    function criarPainelMetaHTML(titulo, dados, metaOcupacao, mostrarTabelaDiaria = false, analiseHistorica = null, dataVigente = null) {
        if (!dados || !dados.parcial) return `<h4>${titulo}</h4><p class="log-info">Não há dias úteis para projetar neste período.</p>`;
        let html = `<h4>${titulo}</h4>`;
        const faltamServicos = Math.ceil(dados.faltam > 0 ? dados.faltam : 0);

        if (faltamServicos === 0 && dados.parcial.servicos > 0 && dados.especulativa.ocupacao >= metaOcupacao) {
            return html + `<div class="stats-grid-success">Parabéns! A meta para este período foi batida!</div>`;
        }
        
        html += `
            <table class="projection-summary-table">
                <tr><th>Contexto</th><th>Ocupação</th><th>Serviços</th></tr>
                <tr><td><strong>Parcial</strong> (já passou)</td><td>${(dados.parcial.ocupacao * 100).toFixed(1)}%</td><td>${dados.parcial.servicos}</td></tr>
                <tr><td><strong>Especulativa</strong> (passado + agendado)</td><td>${(dados.especulativa.ocupacao * 100).toFixed(1)}%</td><td>${dados.especulativa.servicos}</td></tr>
                <tr><td><strong>Projeção</strong> (meta de ${ (metaOcupacao * 100).toFixed(1) }%)</td><td>${(metaOcupacao * 100).toFixed(1)}%</td><td>${dados.projecao.servicos.toFixed(0)}</td></tr>
                <tr class="meta-row"><td colspan="2">Faltam Agendar para a Meta</td><td>${faltamServicos}</td></tr>
            </table>`;
            
        if (mostrarTabelaDiaria && dados.metasDiarias && dados.metasDiarias.length > 0) {
             html += `<h5>Detalhamento Diário da Meta</h5>
                      <table class="report-table"><thead><tr><th>Data</th><th>Dia</th><th>Média Hist.</th><th>Meta</th><th>Feito</th><th>Faltam</th></tr></thead><tbody>`;
            dados.metasDiarias.forEach(dia => {
                const hojeClass = dia.data.getTime() === dataVigente.getTime() ? 'row-today' : '';
                const alertaCapacidade = dia.superlotado ? ' <span title="Meta ajustada à capacidade real do dia.">⚠️</span>' : '';
                const alertaFreela = dia.freelancer ? ' <span title="Ocupação alta! Oportunidade para freelancer.">💡</span>' : '';
                const histDia = analiseHistorica.diasDaSemana[dia.data.getDay()];
                const mediaHistServicos = (histDia && histDia.ocorrencias > 0) ? histDia.servicos / histDia.ocorrencias : 0;
                html += `<tr class="${hojeClass}">
                            <td>${dia.data.getDate()}/${String(dia.data.getMonth()+1).padStart(2,'0')}</td>
                            <td>${dia.data.toLocaleDateString('pt-BR', {weekday: 'short'})}${alertaCapacidade}${alertaFreela}</td>
                            <td>${mediaHistServicos.toFixed(1)}</td>
                            <td>${Math.ceil(dia.meta)}</td>
                            <td>${dia.agendado}</td>
                            <td class="meta-faltam">${Math.ceil(dia.faltam)}</td>
                         </tr>`;
            });
            html += `</tbody></table>`;
        }
        return html;
    }
    
    // ===================================================================
    //  6. ORQUESTRADOR E INICIALIZAÇÃO
    // ===================================================================
    async function handleGerarRelatorio() {
        if (window.automacaoAgenda.isRunning) return;
        configurarBotoes(true);
        document.getElementById('log-automacao').innerHTML = '';
        document.getElementById('resultado-historico').innerHTML = '';
        document.getElementById('resultado-projecao').innerHTML = '';
        log('Iniciando geração de relatório...', 'info');

        try {
            const dataInicioStr = document.getElementById('data-inicio-analise').value;
            const dataFimStr = document.getElementById('data-fim-analise').value;
            const dataVigenteStr = document.getElementById('data-vigente-input').value;
            const dataVigente = new Date(dataVigenteStr + 'T12:00:00');
            const metaOcupacao = parseFloat(document.getElementById('meta-ocupacao-input').value) / 100;
            if (!dataInicioStr || !dataFimStr || !dataVigenteStr || isNaN(metaOcupacao)) throw new Error("Preencha todos os campos.");
            log(`Filtros: Histórico (${dataInicioStr} a ${dataFimStr}), Projeção a partir de ${dataVigenteStr}, Meta ${metaOcupacao*100}%.`);

            const datasParaGarantir = new Set();
            let dLoop = new Date(dataInicioStr);
            while(dLoop <= new Date(dataFimStr)) { datasParaGarantir.add(dLoop.toISOString().split('T')[0]); dLoop.setDate(dLoop.getDate() + 1); }
            
            const inicioMesProjecao = new Date(dataVigente.getFullYear(), dataVigente.getMonth(), 1);
            const fimMesProjecao = new Date(dataVigente.getFullYear(), dataVigente.getMonth() + 1, 0);
            dLoop = new Date(inicioMesProjecao);
            while(dLoop <= fimMesProjecao) {
                const dStr = dLoop.toISOString().split('T')[0];
                if (dLoop >= dataVigente) delete dadosHistoricos[dStr];
                datasParaGarantir.add(dStr);
                dLoop.setDate(dLoop.getDate() + 1);
            }
            
            const naoColetado = Array.from(datasParaGarantir).filter(d => !dadosHistoricos[d]);
            if(naoColetado.length > 0) await iniciarColetaAutomatica(naoColetado);
            
            log('Iniciando cálculos...', 'info');
            const datasNoPeriodo = Object.keys(dadosHistoricos).filter(d => d >= dataInicioStr && d <= dataFimStr);
            if (datasNoPeriodo.length === 0) throw new Error("Nenhum dado encontrado para o período histórico.");
            
            const analise = calcularAnaliseHistorica(datasNoPeriodo);
            renderizarAnaliseHistorica(analise);

            const projecoes = calcularMetas(analise, metaOcupacao, dataVigente);
            projecoes.metaOcupacao = metaOcupacao; // Adiciona para passar para renderização
            projecoes.analiseHistorica = analise;
            projecoes.dataVigente = dataVigente;
            renderizarProjecao(projecoes);

            log('Relatório gerado com sucesso!', 'success');
        } catch (error) {
            console.error("ERRO DETALHADO:", error);
            log(`ERRO CRÍTICO: ${error.message}.`, 'error');
        } finally {
            configurarBotoes(false);
        }
    }
    
    function injetarInterface() {
        console.log("Analisador de Agenda v14.0: Injetando HTML e CSS...");
        const hoje = new Date();
        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const dataInicioPadrao = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1);
        const dataFimPadrao = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, 0);
        const hojeFormatado = hoje.toISOString().split('T')[0];
        const html = `
            <div id="fab-container"><button id="btn-flutuante-analise" title="Análise de Metas">🚀</button><button id="fechar-fab" title="Esconder Ícone">X</button></div>
            <div id="painel-analise-agenda" style="display: none;">
                <div class="header"><h2>Painel de Controle de Metas</h2><button id="fechar-painel-analise">X</button></div>
                <div class="conteudo">
                    <div class="secao"><h3>1. Configurações</h3>
                        <div class="form-grid">
                            <label>Período Histórico:</label><div><input type="date" id="data-inicio-analise" value="${dataInicioPadrao.toISOString().split('T')[0]}"> até <input type="date" id="data-fim-analise" value="${dataFimPadrao.toISOString().split('T')[0]}"></div>
                            <label for="data-vigente-input">Projetar a partir de:</label><input type="date" id="data-vigente-input" value="${hojeFormatado}">
                            <label for="meta-ocupacao-input">Meta Ocup. Mês (%):</label><input type="number" id="meta-ocupacao-input" value="${CONFIG.META_OCUPACAO_PADRAO}" min="1" max="100">
                        </div>
                    </div>
                    <div class="secao"><h3>2. Análise e Projeção</h3>
                        <p>Dados salvos: <strong id="progresso-coleta">0</strong> dias. A coleta é feita sob demanda.</p>
                        <button id="btn-gerar-relatorio" class="btn-acao">Gerar Plano</button><div id="log-automacao"></div>
                    </div>
                    <div id="resultado-historico"></div><div id="resultado-projecao"></div>
                    <hr><button id="btn-limpar-dados" class="btn-perigo-outline">Limpar Todos os Dados Salvos</button>
                </div>
            </div>`;
        const css = `
            #fab-container { position: fixed; bottom: 25px; right: 25px; z-index: 9998; display: flex; align-items: center; gap: 5px; }
            #btn-flutuante-analise { width: 60px; height: 60px; background-color: ${CONFIG.CORES.LARANJA_PRINCIPAL}; color: white; border-radius: 50%; border: none; box-shadow: 0 4px 8px rgba(0,0,0,0.3); font-size: 28px; cursor: pointer; }
            #fechar-fab { width: 20px; height: 20px; background-color: #c0392b; color: white; border-radius: 50%; border: none; font-size: 12px; font-weight: bold; cursor: pointer; line-height: 20px; text-align: center; }
            #painel-analise-agenda { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 900px; height: 90vh; background-color: #333; color: #f1f1f1; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 9999; border-radius: 10px; flex-direction: column; }
            #painel-analise-agenda .header { background-color: ${CONFIG.CORES.LARANJA_PRINCIPAL}; padding: 15px; display: flex; justify-content: space-between; align-items: center; color: white; border-top-left-radius: 10px; border-top-right-radius: 10px; }
            #painel-analise-agenda .header h2 { margin: 0; } #fechar-painel-analise { background: none; border: none; color: white; font-size: 1.8em; cursor: pointer; }
            #painel-analise-agenda .conteudo { padding: 20px; overflow-y: auto; flex-grow: 1; } #painel-analise-agenda .secao { padding-bottom: 15px; margin-bottom: 15px; border-bottom: 1px solid #555; }
            #painel-analise-agenda h3 { color: ${CONFIG.CORES.LARANJA_SECUNDARIA}; margin:0 0 15px 0; } .form-grid { display: grid; grid-template-columns: auto 1fr; gap: 10px 15px; align-items: center; }
            .form-grid input { background-color: #555; border: 1px solid #777; color: white; padding: 8px; border-radius: 4px; }
            .btn-acao, .btn-perigo-outline { display: block; width: 100%; padding: 12px; margin-top: 10px; border: none; border-radius: 5px; color: white; font-size: 1em; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
            .btn-acao { background-color: ${CONFIG.CORES.LARANJA_SECUNDARIA}; } .btn-acao[disabled] { background-color: #999; cursor: not-allowed; }
            .btn-perigo-outline { background-color: transparent; border: 1px solid #c0392b; color: #c0392b; }
            #log-automacao { margin-top: 15px; padding: 10px; background-color: #2a2a2a; border-radius: 5px; max-height: 120px; overflow-y: scroll; font-size: 0.8em; line-height: 1.6; }
            .log-success { color: #2ecc71; } .log-error { color: #e74c3c; font-weight: bold; } .log-info { color: #3498db; }
            .report-section { margin-top: 20px; } .report-section h4 { text-transform: capitalize; color: #f1f1f1; border-bottom: 2px solid ${CONFIG.CORES.LARANJA_SECUNDARIA}; padding-bottom: 5px; margin-top: 25px; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; background-color: #444; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .stats-grid .stat-geral { grid-column: 1 / -1; text-align: center; font-weight: bold; font-size: 1.1em; }
            .stats-grid-success { font-weight: bold; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center; background-color: #27ae60; color: white; }
            .report-table { width: 100%; margin-top: 10px; border-collapse: collapse; } .report-table th, .report-table td { border: 1px solid #777; padding: 8px; text-align: center; }
            .report-table th { background-color: #555; } .report-table .meta-faltam { font-weight: bold; color: #ffdddd; font-size: 1.1em; }
            .report-table .row-today { background-color: rgba(255, 165, 0, 0.2); }
            .projection-summary-table { width: 100%; margin: 15px 0; border-collapse: collapse; background-color: #444; border-radius: 5px; overflow: hidden; }
            .projection-summary-table th, .projection-summary-table td { padding: 10px; text-align: left; border-bottom: 1px solid #555; }
            .projection-summary-table th { background-color: #555; font-size: 0.9em; }
            .projection-summary-table td:nth-child(2), .projection-summary-table td:nth-child(3) { text-align: center; font-weight: bold; }
            .projection-summary-table .meta-row td { background-color: rgba(255, 165, 0, 0.2); font-weight: bold; font-size: 1.1em; }
            .projection-summary-table .meta-row td:nth-child(3) { color: #ffdddd; }`;
        const styleTag = document.createElement('style'); styleTag.innerHTML = css; document.head.appendChild(styleTag);
        const div = document.createElement('div'); div.innerHTML = html; document.body.appendChild(div);
    }
    
    function iniciar() {
        injetarInterface();
        atualizarProgresso();
        const safeAddListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if(element) element.addEventListener(event, handler);
            else console.error(`Falha ao adicionar listener: elemento com ID '${id}' não foi encontrado.`);
        };
        safeAddListener('btn-flutuante-analise', 'click', () => { document.getElementById('painel-analise-agenda').style.display = 'flex'; });
        safeAddListener('fechar-painel-analise', 'click', () => { document.getElementById('painel-analise-agenda').style.display = 'none'; });
        safeAddListener('fechar-fab', 'click', (e) => { e.stopPropagation(); document.getElementById('fab-container').style.display = 'none'; });
        safeAddListener('btn-gerar-relatorio', 'click', handleGerarRelatorio);
        safeAddListener('btn-limpar-dados', 'click', () => {
            if (window.automacaoAgenda.isRunning) { log("Pare a coleta antes de limpar.", "error"); return; }
            if (confirm("Apagar todos os dados salvos?")) {
                dadosHistoricos = {}; localStorage.setItem('analiseAgendaDados_v14', JSON.stringify(dadosHistoricos));
                atualizarProgresso(); document.getElementById('resultado-historico').innerHTML = ''; document.getElementById('resultado-projecao').innerHTML = '';
            }
        });
        console.log("Analisador de Agenda v14.0: Pronto para uso.");
    }

    iniciar();
    
})();
