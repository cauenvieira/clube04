// Envolve todo o script para evitar conflitos e checa se já foi carregado
if (window.analiseOcupacaoScript) {
    window.analiseOcupacaoScript.uninstall();
    console.log("Versão anterior do script removida. Carregando nova versão...");
}

// Namespace para nosso script
window.analiseOcupacaoScript = {
    // -----------------------------------------------------------------
    // 1. CONFIGURAÇÕES E ESTADO
    // -----------------------------------------------------------------
    URL_PAGINA_DASHBOARD: 'https://clube04.com.br/digital/inicio.php',
    ELEMENTO_CHAVE_ID: 'buttonbuscarDashboards',
    URL_DASHBOARD_OCUPACAO: 'https://clube04.com.br/digital/Dashboard/DashboardN010.php',
    URL_DASHBOARD_SERVICOS: 'https://clube04.com.br/digital/Dashboard/DashboardN008.php',
    URL_DASHBOARD_FATURAMENTO: 'https://clube04.com.br/digital/Dashboard/DashboardN003.php', // ATENÇÃO: Verifique esta URL

    DIAS_DA_SEMANA: ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"],
    MESES: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
    ultimoResultado: null,

    // -----------------------------------------------------------------
    // 2. FUNÇÕES DE EXTRAÇÃO E LÓGICA
    // -----------------------------------------------------------------
    formatarData(d) {
        if (!(d instanceof Date) || isNaN(d)) return '';
        return `${d.getFullYear()}-${('0' + (d.getMonth() + 1)).slice(-2)}-${('0' + d.getDate()).slice(-2)}`;
    },
    extrairTaxaDeHtml(h) {
        try { const s = h.match(/<script[^>]*>([\s\S]*?)<\/script>/); if (!s || !s[1]) return null; const r = /label: "Geral.*?data: \[([\d\.]+)/; const m = s[1].match(r); return (m && m[1]) ? parseFloat(m[1]) : null; } catch (e) { return null; }
    },
    extrairServicosDeHtml(h) {
        try { const s = h.match(/<script[^>]*>([\s\S]*?)<\/script>/); if (!s || !s[1]) return 0; const r = /data: \[([\d.]+)\]/g; let t = 0; let m; while ((m = r.exec(s[1])) !== null) { t += parseFloat(m[1]) || 0; } return t; } catch (e) { return 0; }
    },
    extrairFaturamentoDeHtml(h) {
        try { const s = h.match(/<script[^>]*>([\s\S]*?)<\/script>/); if (!s || !s[1]) return 0; const r = /data: \[([\d.,\s]+)\]/g; const m = s[1].match(r); if (!m) return 0; let f = 0; m.forEach(ds => { const nums = ds.replace(/data: \[|\]/g, '').split(','); nums.forEach(n => f += parseFloat(n.trim()) || 0); }); return f; } catch (e) { return 0; }
    },
    gerarDownload() {
        if (!this.ultimoResultado) return alert("Nenhum dado para baixar.");
        const { dadosDiarios, resumoSemanal, resumoMensal, ...totais } = this.ultimoResultado;
        
        let csv = "Relatorio Detalhado por Dia\nData;DiaDaSemana;TaxaOcupacao;Servicos;Faturamento\n";
        dadosDiarios.forEach(d => { csv += `${d.data};${d.diaSemana};${d.taxa.toFixed(2).replace('.', ',')};${d.servicos};${d.faturamento.toFixed(2).replace('.', ',')}\n`; });
        
        csv += "\n\nResumo por Mes\nMes;MediaOcupacao;TotalServicos;TotalFaturamento\n";
        resumoMensal.forEach(m => { csv += `${m.mes};${m.mediaOcupacao.toFixed(2).replace('.', ',')}%;${m.totalServicos};R$ ${m.totalFaturamento.toFixed(2).replace('.', ',')}\n`; });

        csv += "\n\nResumo por Dia da Semana\nDiaDaSemana;MediaOcupacao;MediaServicos;MediaFaturamento\n";
        resumoSemanal.forEach(r => { csv += `${r.dia};${r.mediaOcupacao.toFixed(2).replace('.', ',')}%;${r.mediaServicos.toFixed(2).replace('.', ',')};R$ ${r.mediaFaturamento.toFixed(2).replace('.', ',')}\n`; });
        
        csv += `\n\nResumo Geral do Periodo\nMetrica;Valor\n`;
        csv += `MediaGeralOcupacao(Seg-Sab);${totais.mediaGeralOcupacao.toFixed(2).replace('.', ',')}%\n`;
        csv += `MediaDiariaServicos(Seg-Sab);${totais.mediaDiariaServicos.toFixed(2).replace('.', ',')}\n`;
        csv += `MediaDiariaFaturamento(Seg-Sab);R$ ${totais.mediaDiariaFaturamento.toFixed(2).replace('.', ',')}\n`;
        csv += `TotalServicosPeriodo;${totais.totalServicos}\n`;
        csv += `TotalFaturamentoPeriodo;R$ ${totais.totalFaturamento.toFixed(2).replace('.', ',')}\n`;

        const nomeArquivo = `relatorio_completo_${this.formatarData(totais.dataInicio)}_a_${this.formatarData(totais.dataFim)}.csv`;
        const b = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const l = document.createElement("a"); const u = URL.createObjectURL(b);
        l.setAttribute("href", u); l.setAttribute("download", nomeArquivo);
        document.body.appendChild(l); l.click(); document.body.removeChild(l);
    },

    // -----------------------------------------------------------------
    // 3. FUNÇÕES DE UI
    // -----------------------------------------------------------------
    togglePainel() {
        const p = document.getElementById('analise-ocupacao-painel');
        if(p) p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
    },

    renderizarResultados(r) {
        const area = document.getElementById('painel-area-resultados');
        if (!area) return;

        // Tabela Mensal
        let tabelaMensalHtml = `<table class="resumo-tabela"><thead><tr><th>Mês</th><th>Média Ocupação</th><th>Total Serviços</th><th>Total Faturamento</th></tr></thead><tbody>`;
        r.resumoMensal.forEach(m => {
            tabelaMensalHtml += `<tr><td>${m.mes}</td><td>${m.mediaOcupacao.toFixed(1).replace('.',',')}%</td><td>${m.totalServicos}</td><td>R$ ${m.totalFaturamento.toFixed(2).replace('.',',')}</td></tr>`;
        });
        tabelaMensalHtml += `</tbody></table>`;
        
        // Tabela Semanal
        let tabelaSemanalHtml = `<table class="resumo-tabela"><thead><tr><th>Métrica</th>`;
        r.resumoSemanal.filter(d=>d.dia !== 'Domingo').forEach(d => { tabelaSemanalHtml += `<th>${d.dia.replace('-Feira','')}</th>`; });
        tabelaSemanalHtml += `</tr></thead><tbody>
            <tr><td>Média Ocupação</td>${r.resumoSemanal.filter(d=>d.dia !== 'Domingo').map(d => `<td>${d.mediaOcupacao.toFixed(1).replace('.',',')}%</td>`).join('')}</tr>
            <tr><td>Média Serviços</td>${r.resumoSemanal.filter(d=>d.dia !== 'Domingo').map(d => `<td>${d.mediaServicos.toFixed(1).replace('.',',')}</td>`).join('')}</tr>
            <tr><td>Média Faturamento</td>${r.resumoSemanal.filter(d=>d.dia !== 'Domingo').map(d => `<td>R$ ${d.mediaFaturamento.toFixed(1).replace('.',',')}</td>`).join('')}</tr>
        </tbody></table>`;
        
        // Gráfico Semanal
        let graficoHtml = '';
        const maxOcupacao = Math.max(...r.resumoSemanal.map(d => d.mediaOcupacao)) || 100;
        const maxServicos = Math.max(...r.resumoSemanal.map(d => d.mediaServicos)) || 1;
        const maxFat = Math.max(...r.resumoSemanal.map(d => d.mediaFaturamento)) || 1;
        r.resumoSemanal.forEach(dia => {
            graficoHtml += `
                <div class="resumo-grafico-grupo">
                    <div class="resumo-grafico-barras">
                        <div class="bar ocup" style="height: ${(dia.mediaOcupacao / maxOcupacao) * 100}%;" title="Ocupação: ${dia.mediaOcupacao.toFixed(1)}%"></div>
                        <div class="bar serv" style="height: ${(dia.mediaServicos / maxServicos) * 100}%;" title="Serviços: ${dia.mediaServicos.toFixed(1)}"></div>
                        <div class="bar fat" style="height: ${(dia.mediaFaturamento / maxFat) * 100}%;" title="Faturamento: R$ ${dia.mediaFaturamento.toFixed(1)}"></div>
                    </div>
                    <div class="resumo-grafico-rotulo">${dia.dia.replace('-Feira','')}</div>
                </div>
            `;
        });

        area.innerHTML = `
            <div class="resumo-info">
                <h3>Resumo do Período (${r.totalDias} dias)</h3>
                <p><strong>Período:</strong> ${this.formatarData(r.dataInicio)} a ${this.formatarData(r.dataFim)}</p>
            </div>
            <h4>Desempenho Mensal</h4>
            ${tabelaMensalHtml}
            <h4>Médias por Dia da Semana</h4>
            ${tabelaSemanalHtml}
            <div class="grafico-wrapper">
                <h4>Visualização Comparativa das Médias Semanais</h4>
                <div class="grafico-legenda">
                    <span class="legenda-item"><span class="cor ocup"></span>Ocupação</span>
                    <span class="legenda-item"><span class="cor serv"></span>Serviços</span>
                    <span class="legenda-item"><span class="cor fat"></span>Faturamento</span>
                </div>
                <div class="resumo-grafico-container">${graficoHtml}</div>
            </div>
        `;
        document.getElementById('painel-btn-baixar').disabled = false;
    },

    // -----------------------------------------------------------------
    // 4. FUNÇÃO DE EXECUÇÃO PRINCIPAL
    // -----------------------------------------------------------------
    async iniciarAnalise() {
        const btnAnalisar = document.getElementById('painel-btn-analisar'), areaResultados = document.getElementById('painel-area-resultados');
        try {
            btnAnalisar.disabled = true;
            document.getElementById('painel-btn-baixar').disabled = true;
            areaResultados.innerHTML = `<div class="loading-spinner"></div><p style="text-align:center;">Analisando dados... Isso pode levar um momento.</p>`;
            
            const dataInicio = new Date(document.getElementById('painel-data-inicio').value + 'T00:00:00');
            const dataFim = new Date(document.getElementById('painel-data-fim').value + 'T00:00:00');
            const totalDias = Math.round((dataFim - dataInicio) / 864e5) + 1;
            console.log(`Período: ${this.formatarData(dataInicio)} a ${this.formatarData(dataFim)} (${totalDias} dias)`);

            const dadosDiarios = [];
            const idUnidade = $('#idUnidade').val();
            
            for (let i = 0; i < totalDias; i++) {
                const dataAtual = new Date(dataInicio); dataAtual.setDate(dataInicio.getDate() + i);
                const dataFmt = this.formatarData(dataAtual), diaIdx = dataAtual.getDay();
                
                console.log(`%cProcessando dia ${i + 1}/${totalDias}: ${dataFmt}`, 'font-weight: bold;');
                if (diaIdx === 0) {
                    dadosDiarios.push({ data: dataFmt, diaSemana: this.DIAS_DA_SEMANA[diaIdx], taxa: 0, servicos: 0, faturamento: 0 }); continue;
                }
                const formData = new FormData(); formData.append('dataInicioBusca', dataFmt); formData.append('dataFimBusca', dataFmt); formData.append('idUnidade', idUnidade);
                
                const [respOcupacao, respServicos, respFaturamento] = await Promise.all([
                    fetch(this.URL_DASHBOARD_OCUPACAO, { method: 'POST', body: formData }),
                    fetch(this.URL_DASHBOARD_SERVICOS, { method: 'POST', body: formData }),
                    fetch(this.URL_DASHBOARD_FATURAMENTO, { method: 'POST', body: formData })
                ]);
                
                const taxa = respOcupacao.ok ? this.extrairTaxaDeHtml(await respOcupacao.text()) : null;
                const servicos = respServicos.ok ? this.extrairServicosDeHtml(await respServicos.text()) : 0;
                const faturamento = respFaturamento.ok ? this.extrairFaturamentoDeHtml(await respFaturamento.text()) : 0;
                
                dadosDiarios.push({ data: dataFmt, diaSemana: this.DIAS_DA_SEMANA[diaIdx], taxa: taxa ?? 0, servicos, faturamento });
                console.log(`   ✅ Ocupação: ${taxa?.toFixed(1) ?? 'N/A'}% | Serviços: ${servicos} | Faturamento: R$ ${faturamento.toFixed(2)}`);
            }

            console.log("📊 Calculando resumos...");
            const diasUteis = dadosDiarios.filter(d => d.diaSemana !== "Domingo");
            // Cálculos gerais
            const mediaGeralOcupacao = diasUteis.length > 0 ? diasUteis.map(d => d.taxa).reduce((a, b) => a + b, 0) / diasUteis.length : 0;
            const totalServicos = dadosDiarios.reduce((a, b) => a + b.servicos, 0);
            const mediaDiariaServicos = diasUteis.length > 0 ? totalServicos / diasUteis.length : 0;
            const totalFaturamento = dadosDiarios.reduce((a, b) => a + b.faturamento, 0);
            const mediaDiariaFaturamento = diasUteis.length > 0 ? totalFaturamento / diasUteis.length : 0;
            
            // Resumo semanal
            const resumoSemanal = this.DIAS_DA_SEMANA.map(nome => {
                if (nome === "Domingo") return { dia: nome, mediaOcupacao: 0, mediaServicos: 0, mediaFaturamento: 0 };
                const dias = diasUteis.filter(d => d.diaSemana === nome);
                const mediaOcupacao = dias.length > 0 ? dias.map(d => d.taxa).reduce((a, b) => a + b, 0) / dias.length : 0;
                const mediaServicos = dias.length > 0 ? dias.map(d => d.servicos).reduce((a, b) => a + b, 0) / dias.length : 0;
                const mediaFaturamento = dias.length > 0 ? dias.map(d => d.faturamento).reduce((a, b) => a + b, 0) / dias.length : 0;
                return { dia: nome, mediaOcupacao, mediaServicos, mediaFaturamento };
            });

            // Resumo mensal
            const resumoMensalObj = {};
            dadosDiarios.forEach(d => {
                const mesAno = d.data.substring(0, 7); // "2025-04"
                if (!resumoMensalObj[mesAno]) resumoMensalObj[mesAno] = { taxas: [], servicos: 0, faturamento: 0 };
                resumoMensalObj[mesAno].servicos += d.servicos;
                resumoMensalObj[mesAno].faturamento += d.faturamento;
                if (d.diaSemana !== 'Domingo') {
                    resumoMensalObj[mesAno].taxas.push(d.taxa);
                }
            });
            const resumoMensal = Object.keys(resumoMensalObj).map(key => {
                const mes = resumoMensalObj[key];
                const [ano, mesNum] = key.split('-');
                return {
                    mes: `${this.MESES[parseInt(mesNum)-1]}/${ano}`,
                    mediaOcupacao: mes.taxas.length > 0 ? mes.taxas.reduce((a,b) => a+b,0) / mes.taxas.length : 0,
                    totalServicos: mes.servicos,
                    totalFaturamento: mes.faturamento
                }
            });

            this.ultimoResultado = { dadosDiarios, resumoSemanal, resumoMensal, mediaGeralOcupacao, mediaDiariaServicos, totalServicos, mediaDiariaFaturamento, totalFaturamento, dataInicio, dataFim, totalDias };
            this.renderizarResultados(this.ultimoResultado);
            
        } catch (error) {
            console.error("🚫 Ocorreu um erro:", error);
        } finally {
            btnAnalisar.disabled = false;
        }
    },

    // -----------------------------------------------------------------
    // 5. FUNÇÃO DE SETUP INICIAL
    // -----------------------------------------------------------------
    uninstall() {
        document.getElementById('analise-ocupacao-btn-container')?.remove();
        document.getElementById('analise-ocupacao-painel')?.remove();
        document.getElementById('analise-ocupacao-styles')?.remove();
        delete window.analiseOcupacaoScript;
    },

    setup() {
        if (!document.getElementById(this.ELEMENTO_CHAVE_ID)) {
            alert("Você não está na página inicial de Dashboards. Estamos te levando para lá agora!\n\nAssim que a nova página carregar, por favor, clique no seu favorito 'Analise de Ocupacao' mais uma vez para ativar a ferramenta.");
            window.location.href = this.URL_PAGINA_DASHBOARD;
            return;
        }

        const estilos = `
            #analise-ocupacao-btn-container { position: fixed; bottom: 20px; right: 20px; z-index: 9997; }
            .analise-btn-flutuante { width: 60px; height: 60px; color: white; border-radius: 50%; border: none; box-shadow: 0 4px 8px rgba(0,0,0,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease-in-out; }
            .analise-btn-flutuante:hover { transform: scale(1.1); }
            #analise-ocupacao-btn { background-color: #ff8400; }
            #analise-ocupacao-btn-fechar { position: absolute; top: -10px; right: -10px; width: 28px; height: 28px; background-color: #dc3545; z-index: 9998; }
            #analise-ocupacao-painel { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 850px; max-width: 95vw; max-height: 90vh; background: #fff; border-radius: 8px; box-shadow: 0 8px 25px rgba(0,0,0,0.3); z-index: 10000; flex-direction: column; }
            #analise-ocupacao-painel .painel-header { padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            #analise-ocupacao-painel .painel-header button.fechar-interno { background: transparent; border: none; font-size: 24px; font-weight: bold; cursor: pointer; color: #888; }
            #analise-ocupacao-painel .painel-body { padding: 25px; overflow-y: auto; font-family: sans-serif;}
            #analise-ocupacao-painel .painel-footer { padding: 15px 25px; border-top: 1px solid #eee; text-align: right; }
            #analise-ocupacao-painel h2, h4 { margin: 0; font-family: sans-serif; color: #333; }
            #analise-ocupacao-painel h4 { margin-top: 20px; margin-bottom: 10px; }
            #analise-ocupacao-painel .controles { display: flex; align-items: flex-end; gap: 20px; }
            #analise-ocupacao-painel button:disabled { background-color: #ccc; cursor: not-allowed; }
            #painel-btn-analisar { background: #007bff; color: white; padding: 10px 20px; border-radius: 5px; font-size: 16px;}
            #painel-btn-baixar { background: #198754; color: white; padding: 10px 20px; border-radius: 5px; font-size: 16px;}
            .resumo-tabela { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; }
            .resumo-tabela th, .resumo-tabela td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            .resumo-tabela th { background-color: #f2f2f2; }
            .grafico-wrapper { margin-top: 25px; }
            .grafico-legenda { display: flex; justify-content: center; gap: 20px; margin-bottom: 10px; font-size: 12px; }
            .legenda-item { display: flex; align-items: center; gap: 5px; }
            .legenda-item .cor { width: 12px; height: 12px; border-radius: 2px; }
            .cor.ocup { background-color: #0d6efd; } .cor.serv { background-color: #198754; } .cor.fat { background-color: #ffc107; }
            .resumo-grafico-container { display: flex; align-items: flex-end; justify-content: space-around; height: 220px; padding: 10px; border-left: 2px solid #eee; border-bottom: 2px solid #eee; }
            .resumo-grafico-grupo { display: flex; flex-direction: column; align-items: center; }
            .resumo-grafico-barras { display: flex; align-items: flex-end; height: 180px; gap: 2px; }
            .resumo-grafico-barras .bar { width: 15px; border-radius: 3px 3px 0 0; }
            .bar.ocup { background-color: #0d6efd; } .bar.serv { background-color: #198754; } .bar.fat { background-color: #ffc107; }
            .resumo-grafico-rotulo { font-size: 12px; margin-top: 5px; font-weight: 500; }
            .loading-spinner { margin: 40px auto; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #0d6efd; border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        const styleTag = document.createElement('style'); styleTag.id = 'analise-ocupacao-styles'; styleTag.innerHTML = estilos;
        document.head.appendChild(styleTag);

        // Lógica do Período Padrão
        const hoje = new Date();
        const dataFimPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        const dataInicioPadrao = new Date(dataFimPadrao);
        dataInicioPadrao.setMonth(dataInicioPadrao.getMonth() - 2);
        dataInicioPadrao.setDate(1);

        const painelHtml = `
            <div id="analise-ocupacao-painel" style="display: none;">
                <div class="painel-header">
                    <h2>Análise de Indicadores</h2>
                    <button id="painel-btn-fechar-interno" class="fechar-interno" title="Fechar Painel">&times;</button>
                </div>
                <div class="painel-body">
                    <div class="controles">
                        <div><label for="painel-data-inicio">Data Início</label><input type="date" id="painel-data-inicio" value="${this.formatarData(dataInicioPadrao)}"></div>
                        <div><label for="painel-data-fim">Data Fim</label><input type="date" id="painel-data-fim" value="${this.formatarData(dataFimPadrao)}"></div>
                        <button id="painel-btn-analisar">Analisar</button>
                    </div>
                    <div id="painel-area-resultados">
                       <p style="text-align:center; margin-top: 50px; color: #777;">Selecione um período e clique em "Analisar" para ver os resultados.</p>
                    </div>
                </div>
                <div class="painel-footer">
                    <button id="painel-btn-baixar" disabled>Baixar Relatório Completo (CSV)</button>
                </div>
            </div>
        `;
        if (!document.getElementById('analise-ocupacao-painel')) document.body.insertAdjacentHTML('beforeend', painelHtml);
        
        const containerBotoesHtml = `
            <div id="analise-ocupacao-btn-container">
                <button id="analise-ocupacao-btn" class="analise-btn-flutuante" title="Abrir/Fechar Painel de Análise"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"></path></svg></button>
                <button id="analise-ocupacao-btn-fechar" class="analise-btn-flutuante" title="Remover Ferramenta de Análise"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></button>
            </div>
        `;
        if (!document.getElementById('analise-ocupacao-btn-container')) document.body.insertAdjacentHTML('beforeend', containerBotoesHtml);
        
        document.getElementById('analise-ocupacao-btn').onclick = this.togglePainel.bind(this);
        document.getElementById('analise-ocupacao-btn-fechar').onclick = this.uninstall.bind(this);
        document.getElementById('painel-btn-analisar').onclick = this.iniciarAnalise.bind(this);
        document.getElementById('painel-btn-baixar').onclick = this.gerarDownload.bind(this);
        document.getElementById('painel-btn-fechar-interno').onclick = this.togglePainel.bind(this);

        console.log("Ferramenta de análise carregada. Clique no botão laranja para começar.");
    }
};

window.analiseOcupacaoScript.setup();
