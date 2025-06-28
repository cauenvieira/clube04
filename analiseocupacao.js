// Envolve todo o script para evitar conflitos e checa se já foi carregado
if (window.analiseOcupacaoScript) {
    // Se o script já existe, remove a versão antiga para carregar a nova e corrigida
    window.analiseOcupacaoScript.uninstall();
    console.log("Versão anterior do script removida. Carregando nova versão...");
}

// Namespace para nosso script, para manter o ambiente global limpo
window.analiseOcupacaoScript = {

    // -----------------------------------------------------------------
    // 1. CONFIGURAÇÕES E ESTADO
    // -----------------------------------------------------------------
    URL_PAGINA_DASHBOARD: 'https://clube04.com.br/digital/inicio.php',
    ELEMENTO_CHAVE_ID: 'buttonbuscarDashboards',
    URL_DASHBOARD_OCUPACAO: 'https://clube04.com.br/digital/Dashboard/DashboardN010.php',
    DIAS_DA_SEMANA: ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"],
    ultimoResultado: null, 

    // -----------------------------------------------------------------
    // 2. FUNÇÕES AUXILIARES E DE LÓGICA
    // -----------------------------------------------------------------
    formatarData(d) {
        if (!(d instanceof Date) || isNaN(d)) return '';
        return `${d.getFullYear()}-${('0'+(d.getMonth()+1)).slice(-2)}-${('0'+d.getDate()).slice(-2)}`;
    },

    extrairTaxaDeHtml(h) {
        try {
            const s = h.match(/<script[^>]*>([\s\S]*?)<\/script>/); if (!s || !s[1]) return null;
            const r = /label: "Geral.*?data: \[([\d\.]+)/; const m = s[1].match(r);
            return (m && m[1]) ? parseFloat(m[1]) : null;
        } catch (e) { return null; }
    },

    gerarDownload() {
        if (!this.ultimoResultado) {
            alert("Nenhum dado para baixar. Por favor, realize uma análise primeiro.");
            return;
        }
        console.log("Gerando relatório CSV com separador ponto e vírgula (;)...");
        const { dadosDiarios, resumoSemanal, mediaGeral, dataInicio, dataFim } = this.ultimoResultado;
        
        let csvContent = "Relatorio Detalhado por Dia\nData;DiaDaSemana;TaxaOcupacao\n";
        dadosDiarios.forEach(d => { csvContent += `${d.data};${d.diaSemana};${d.taxa.toFixed(2).replace('.',',')}\n`; });
        csvContent += "\n\nResumo por Dia da Semana\nDiaDaSemana;MediaOcupacao\n";
        resumoSemanal.forEach(r => { csvContent += `${r.dia};${r.media.toFixed(2).replace('.',',')}\n`; });
        csvContent += "\n\nMedia Geral do Periodo\nMediaGeral(Segunda a Sabado)\n" + `${mediaGeral.toFixed(2).replace('.',',')}\n`;
        
        const nomeArquivo = `relatorio_ocupacao_${this.formatarData(dataInicio)}_a_${this.formatarData(dataFim)}.csv`;
        
        const b = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const l = document.createElement("a"); const u = URL.createObjectURL(b);
        l.setAttribute("href", u); l.setAttribute("download", nomeArquivo);
        document.body.appendChild(l); l.click(); document.body.removeChild(l);
        console.log(`✅ Relatório '${nomeArquivo}' baixado com sucesso!`);
    },

    // -----------------------------------------------------------------
    // 3. FUNÇÕES DE CRIAÇÃO E CONTROLE DA UI
    // -----------------------------------------------------------------
    togglePainel() {
        const painel = document.getElementById('analise-ocupacao-painel');
        if (painel) {
            const isVisible = painel.style.display === 'flex';
            painel.style.display = isVisible ? 'none' : 'flex';
        }
    },
    
    renderizarResultados(resultado) {
        const { resumoSemanal, mediaGeral, dataInicio, dataFim, totalDias } = resultado;
        const areaResultados = document.getElementById('painel-area-resultados');
        const btnDownload = document.getElementById('painel-btn-baixar');

        if (!areaResultados) return;

        let barrasVerticaisHtml = '';
        resumoSemanal.filter(d => d.dia !== "Domingo").forEach(dia => {
            barrasVerticaisHtml += `
                <div class="resumo-vertical-grupo">
                    <div class="resumo-vertical-valor">${dia.media.toFixed(1).replace('.',',')}%</div>
                    <div class="resumo-vertical-barra-fundo">
                        <div class="resumo-vertical-barra-preenchimento" style="height: ${dia.media}%;" title="${dia.dia}: Média de ${dia.media.toFixed(1)}%"></div>
                    </div>
                    <div class="resumo-vertical-rotulo">${dia.dia.replace('-Feira', '')}</div>
                </div>
            `;
        });

        const conteudoResultados = `
            <div class="resumo-info">
                <p><strong>Período Analisado:</strong> ${this.formatarData(dataInicio)} a ${this.formatarData(dataFim)} (${totalDias} dias)</p>
                <p><strong>Média Geral (Seg-Sáb):</strong> ${mediaGeral.toFixed(2).replace('.',',')}%</p>
            </div>
            <div class="resumo-vertical-container">${barrasVerticaisHtml}</div>
        `;
        
        areaResultados.innerHTML = conteudoResultados;
        btnDownload.disabled = false;
    },

    // -----------------------------------------------------------------
    // 4. FUNÇÃO DE EXECUÇÃO PRINCIPAL
    // -----------------------------------------------------------------
    async iniciarAnalise() {
        const btnAnalisar = document.getElementById('painel-btn-analisar');
        const btnDownload = document.getElementById('painel-btn-baixar');
        const areaResultados = document.getElementById('painel-area-resultados');

        try {
            btnAnalisar.disabled = true;
            btnDownload.disabled = true;
            areaResultados.innerHTML = `<div class="loading-spinner"></div><p style="text-align:center;">Analisando dados... Isso pode levar um momento.</p>`;
            
            console.clear();
            console.log("======================================================\n🚀 INICIANDO ANÁLISE DE OCUPAÇÃO 🚀\n======================================================");

            const dataInicioStr = document.getElementById('painel-data-inicio').value;
            const dataFimStr = document.getElementById('painel-data-fim').value;

            const dataInicio = new Date(dataInicioStr + 'T00:00:00');
            const dataFim = new Date(dataFimStr + 'T00:00:00');
            const totalDias = Math.round((dataFim - dataInicio) / (1000 * 60 * 60 * 24)) + 1;
            console.log(`Período selecionado: de ${this.formatarData(dataInicio)} a ${this.formatarData(dataFim)} (${totalDias} dias)`);

            const dadosDiarios = [];
            const idUnidade = $('#idUnidade').val();
            
            for (let i = 0; i < totalDias; i++) {
                const dataAtual = new Date(dataInicio); dataAtual.setDate(dataInicio.getDate() + i);
                const dataAtualFormatada = this.formatarData(dataAtual);
                const diaDaSemanaIndex = dataAtual.getDay();
                
                console.log(`%cProcessando dia ${i + 1}/${totalDias}: ${dataAtualFormatada}`, 'font-weight: bold;');
                if (diaDaSemanaIndex === 0) {
                    console.log("   🔵 Domingo. Taxa = 0.");
                    dadosDiarios.push({ data: dataAtualFormatada, diaSemana: this.DIAS_DA_SEMANA[diaDaSemanaIndex], taxa: 0 }); continue;
                }
                const formData = new FormData(); formData.append('dataInicioBusca', dataAtualFormatada); formData.append('dataFimBusca', dataAtualFormatada); formData.append('idUnidade', idUnidade);
                const response = await fetch(this.URL_DASHBOARD_OCUPACAO, { method: 'POST', body: formData });
                
                const taxaDoDia = response.ok ? this.extrairTaxaDeHtml(await response.text()) : null;
                dadosDiarios.push({ data: dataAtualFormatada, diaSemana: this.DIAS_DA_SEMANA[diaDaSemanaIndex], taxa: taxaDoDia ?? 0 });
                
                if(taxaDoDia === null) console.error(`   ❌ Falha na busca. Status: ${response.status}`);
                else console.log(`   ✅ Taxa: ${taxaDoDia.toFixed(2)}%`);
            }

            console.log("------------------------------------------------------\n📊 Calculando resumo...");
            
            const diasCalculaveis = dadosDiarios.filter(d => d.diaSemana !== "Domingo");
            const mediaGeral = diasCalculaveis.length > 0 ? diasCalculaveis.map(d => d.taxa).reduce((a, b) => a + b, 0) / diasCalculaveis.length : 0;
            
            const resumoSemanal = this.DIAS_DA_SEMANA.map((nome) => {
                if (nome === "Domingo") return { dia: nome, media: 0 };
                const taxasDoDia = dadosDiarios.filter(d => d.diaSemana === nome).map(d => d.taxa);
                return { dia: nome, media: (taxasDoDia.length > 0 ? taxasDoDia.reduce((a, b) => a + b, 0) / taxasDoDia.length : 0) };
            });

            this.ultimoResultado = { dadosDiarios, resumoSemanal, mediaGeral, dataInicio, dataFim, totalDias };
            this.renderizarResultados(this.ultimoResultado);
            
        } catch (error) {
            console.error("🚫 Ocorreu um erro: 🚫", error);
            areaResultados.innerHTML = `<p style="text-align:center; color: red;">Ocorreu um erro. Verifique o console (F12) para detalhes.</p>`;
        } finally {
            btnAnalisar.disabled = false;
        }
    },

    // -----------------------------------------------------------------
    // 5. FUNÇÃO DE SETUP INICIAL (PONTO DE ENTRADA DO SCRIPT)
    // -----------------------------------------------------------------
    uninstall() {
        document.getElementById('analise-ocupacao-btn-container')?.remove();
        document.getElementById('analise-ocupacao-painel')?.remove();
        document.getElementById('analise-ocupacao-styles')?.remove();
        delete window.analiseOcupacaoScript;
        console.log("Ferramenta de análise removida da página.");
    },

    setup() {
        // CORREÇÃO: Validação ocorre ANTES de criar qualquer elemento na tela.
        if (!document.getElementById(this.ELEMENTO_CHAVE_ID)) {
            // CORREÇÃO: Mensagem de alerta atualizada.
            alert("Você não está na página inicial de Dashboards. Estamos te levando para lá agora!\n\nAssim que a nova página carregar, por favor, clique no seu favorito 'Analise de Ocupacao' mais uma vez para ativar a ferramenta.");
            window.location.href = this.URL_PAGINA_DASHBOARD;
            return; // Impede a continuação do setup
        }

        const estilos = `
            /* Botões Flutuantes */
            #analise-ocupacao-btn-container { position: fixed; bottom: 20px; right: 20px; z-index: 9997; }
            .analise-btn-flutuante { width: 60px; height: 60px; color: white; border-radius: 50%; border: none; box-shadow: 0 4px 8px rgba(0,0,0,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease-in-out; }
            .analise-btn-flutuante:hover { transform: scale(1.1); }
            #analise-ocupacao-btn { background-color: #ff8400; /* Laranja */ }
            #analise-ocupacao-btn-fechar { position: absolute; top: -10px; right: -10px; width: 28px; height: 28px; background-color: #dc3545; /* Vermelho */ z-index: 9998; }
            #analise-ocupacao-btn-fechar svg { width: 16px; height: 16px; }
            .analise-btn-flutuante svg { width: 28px; height: 28px; }
            
            /* Painel de Análise */
            #analise-ocupacao-painel { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 750px; max-width: 95vw; max-height: 90vh; background: #fff; border-radius: 8px; box-shadow: 0 8px 25px rgba(0,0,0,0.3); z-index: 10000; flex-direction: column; }
            #analise-ocupacao-painel .painel-header { padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            #analise-ocupacao-painel .painel-header button.fechar-interno { background: transparent; border: none; font-size: 24px; font-weight: bold; cursor: pointer; color: #888; padding: 0 5px; line-height: 1; }
            #analise-ocupacao-painel .painel-header button.fechar-interno:hover { color: #000; }
            #analise-ocupacao-painel .painel-body { padding: 25px; overflow-y: auto; }
            #analise-ocupacao-painel .painel-footer { padding: 15px 25px; border-top: 1px solid #eee; text-align: right; }
            #analise-ocupacao-painel h2 { margin: 0; font-family: sans-serif; font-size: 20px; color: #333; }
            #analise-ocupacao-painel .controles { display: flex; align-items: flex-end; gap: 20px; }
            #analise-ocupacao-painel .controles label { font-family: sans-serif; }
            #analise-ocupacao-painel button { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
            #analise-ocupacao-painel button:disabled { background-color: #ccc; cursor: not-allowed; }
            #painel-btn-analisar { background: #007bff; color: white; }
            #painel-btn-baixar { background: #198754; color: white; }
            
            /* Estilos do Gráfico de Resumo */
            #painel-area-resultados { margin-top: 20px; min-height: 300px; }
            .resumo-info { margin-bottom: 25px; font-size: 14px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 15px; }
            .resumo-info strong { color: #000; }
            .resumo-vertical-container { display: flex; align-items: flex-end; justify-content: space-around; height: 200px; padding: 10px; }
            .resumo-vertical-grupo { display: flex; flex-direction: column; align-items: center; text-align: center; font-size: 12px; width: 80px; }
            .resumo-vertical-valor { color: #333; font-weight: bold; margin-bottom: 5px; }
            .resumo-vertical-barra-fundo { display: flex; align-items: flex-end; width: 35px; height: 150px; background-color: #e9ecef; border-radius: 4px; }
            .resumo-vertical-barra-preenchimento { width: 100%; background-color: #0d6efd; border-radius: 4px; transition: height 0.8s ease-out; }
            .resumo-vertical-rotulo { color: #666; margin-top: 8px; font-weight: 500; }
            .loading-spinner { margin: 40px auto; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #0d6efd; border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        const styleTag = document.createElement('style'); styleTag.id = 'analise-ocupacao-styles'; styleTag.innerHTML = estilos;
        document.head.appendChild(styleTag);

        const hoje = new Date(); const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
        const dataFimPadrao = this.formatarData(ontem); const dataInicioPadrao = this.formatarData(new Date(new Date().setDate(ontem.getDate() - 34)));
        
        const painelHtml = `
            <div id="analise-ocupacao-painel" style="display: none;">
                <div class="painel-header">
                    <h2>Análise de Taxa de Ocupação</h2>
                    <button id="painel-btn-fechar-interno" class="fechar-interno" title="Fechar Painel">&times;</button>
                </div>
                <div class="painel-body">
                    <div class="controles">
                        <div><label for="painel-data-inicio">Data Início</label><input type="date" id="painel-data-inicio" value="${dataInicioPadrao}"></div>
                        <div><label for="painel-data-fim">Data Fim</label><input type="date" id="painel-data-fim" value="${dataFimPadrao}"></div>
                        <button id="painel-btn-analisar">Analisar</button>
                    </div>
                    <div id="painel-area-resultados">
                       <p style="text-align:center; margin-top: 50px; color: #777;">Selecione um período e clique em "Analisar" para ver os resultados.</p>
                    </div>
                </div>
                <div class="painel-footer">
                    <button id="painel-btn-baixar" disabled>Baixar Relatório (CSV)</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', painelHtml);
        
        const containerBotoes = document.createElement('div');
        containerBotoes.id = 'analise-ocupacao-btn-container';
        containerBotoes.innerHTML = `
            <button id="analise-ocupacao-btn" class="analise-btn-flutuante" title="Abrir/Fechar Painel de Análise">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"></path></svg>
            </button>
            <button id="analise-ocupacao-btn-fechar" class="analise-btn-flutuante" title="Remover Ferramenta de Análise">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
            </button>
        `;
        document.body.appendChild(containerBotoes);
        
        document.getElementById('analise-ocupacao-btn').onclick = this.togglePainel.bind(this);
        document.getElementById('analise-ocupacao-btn-fechar').onclick = this.uninstall.bind(this);
        document.getElementById('painel-btn-analisar').onclick = this.iniciarAnalise.bind(this);
        document.getElementById('painel-btn-baixar').onclick = this.gerarDownload.bind(this);
        document.getElementById('painel-btn-fechar-interno').onclick = this.togglePainel.bind(this);

        console.log("Ferramenta de análise carregada. Clique no botão laranja para começar.");
    }
};

// Inicia o setup para criar o botão e o painel na página
window.analiseOcupacaoScript.setup();
