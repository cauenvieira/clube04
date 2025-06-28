(() => {
    'use strict';

    // --- VERIFICAÇÃO DE SEGURANÇA ---
    const paginaAlvo = 'https://clube04.com.br/digital/gerenciarponto.php';
    if (!window.location.href.startsWith(paginaAlvo)) {
        alert("ERRO: Este script foi feito para rodar apenas na página 'gerenciarponto.php'.\n\nPor favor, navegue para a página correta e execute o script novamente.");
        return;
    }

    const painelExistente = document.getElementById('dr-painel');
    if (painelExistente) { painelExistente.remove(); }

    // --- DADOS E CONFIGURAÇÕES ---
    const colaboradoresBase = [
        { id: '16427', nome: 'Amanda Moraes do Nascimento' },
        { id: '16305', nome: 'Giovana Stuart dos Reis' },
        { id: '16705', nome: 'Michelle Carolina Ladislau de Sousa' }
    ];
    let dadosParaCSV = [];

    // --- FUNÇÕES DE LÓGICA ---
    const esperar = (ms) => new Promise(res => setTimeout(res, ms));
    const obterDiaDaSemana = (dataString) => {
        const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        return dias[new Date(dataString + 'T12:00:00').getDay()];
    };

    function gerarListaDeMeses(inicio, fim) {
        const lista = [];
        let atual = new Date(inicio + '-02T12:00:00');
        const dataFim = new Date(fim + '-02T12:00:00');
        while (atual <= dataFim) {
            lista.push(`${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}`);
            atual.setMonth(atual.getMonth() + 1);
        }
        return lista;
    }

    function calcularMinutos(h) {
        if (!h || !h.includes(':')) return 0;
        const [horas, minutos] = h.split(':').map(Number);
        return horas * 60 + minutos;
    }

    function agruparDados(dados) {
        const agrupado = {};
        dados.forEach(d => {
            const mes = d.data.substring(0, 7);
            if (!agrupado[d.colaborador]) {
                agrupado[d.colaborador] = {};
            }
            if (!agrupado[d.colaborador][mes]) {
                agrupado[d.colaborador][mes] = [];
            }
            agrupado[d.colaborador][mes].push(d);
        });
        return agrupado;
    }

    function formatarMesAno(mesString) {
        const [ano, mesNum] = mesString.split('-');
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${meses[parseInt(mesNum, 10) - 1]} de ${ano}`;
    }

    // --- FUNÇÃO PRINCIPAL DE EXTRAÇÃO ---
    async function gerarRelatorio() {
        const painelResultados = document.getElementById('dr-resultados');
        const mesInicio = document.getElementById('dr-mes-inicio').value;
        const mesFim = document.getElementById('dr-mes-fim').value;
        
        if (!mesInicio || !mesFim || mesFim < mesInicio) {
            painelResultados.innerHTML = '<p style="color:red;">Erro: Período inválido. O mês de fim deve ser igual ou maior que o de início.</p>';
            return;
        }

        const colaboradoresSelecionados = colaboradoresBase.filter(c => document.getElementById(`dr-cb-${c.id}`).checked);
        if (colaboradoresSelecionados.length === 0) {
            painelResultados.innerHTML = '<p style="color:red;">Erro: Selecione ao menos um colaborador.</p>';
            return;
        }

        const listaMeses = gerarListaDeMeses(mesInicio, mesFim);
        let todosOsDados = [];
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const mesAtualString = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

        for (const mesParaBusca of listaMeses) {
            const isMesAtual = mesParaBusca === mesAtualString;
            for (const colaborador of colaboradoresSelecionados) {
                painelResultados.innerHTML = `<p style="color:#007bff;">Buscando: ${colaborador.nome} (${mesParaBusca})...</p>`;
                
                document.getElementById('mesBusca').value = mesParaBusca;
                $('#idColaboradorBusca').selectpicker('val', colaborador.id);
                document.getElementById('buttonbuscarPontos').click();
                await esperar(2000);

                const tabela = document.getElementById('idTabelaPontos');
                if (!tabela) continue;

                const linhas = tabela.querySelectorAll('tbody tr');
                linhas.forEach(linha => {
                    const data = linha.querySelector('td span').innerText.trim();
                    const dataObj = new Date(data + 'T12:00:00');

                    if (isMesAtual && dataObj >= hoje) return;

                    const diaSemana = obterDiaDaSemana(data);
                    const totalHoras = linha.querySelector('td:nth-child(3)').innerText.match(/Horas Trabalhadas: ([\d:]+)/)?.[1] || '00:00';
                    const horariosBatidos = Array.from(linha.querySelectorAll('td:nth-child(2) input[type="time"]')).map(input => input.value);
                    const horariosPadronizados = Array(6).fill('');
                    horariosBatidos.forEach((h, i) => { if (i < 6) horariosPadronizados[i] = h; });
                    
                    todosOsDados.push({
                        colaborador: colaborador.nome, data, diaSemana, horarios: horariosBatidos, horariosPadronizados, totalHoras
                    });
                });
            }
        }
        dadosParaCSV = todosOsDados;
        exibirResultados(todosOsDados, mesInicio, mesFim);
    }

    // --- FUNÇÕES DE VISUALIZAÇÃO (UI) ---
    function exibirResultados(dados, mesInicio, mesFim) {
        const painelResultados = document.getElementById('dr-resultados');
        if (dados.length === 0) {
            painelResultados.innerHTML = '<p>Nenhum dado encontrado para os filtros selecionados.</p>';
            return;
        }
        
        const dadosAgrupados = agruparDados(dados);
        let htmlFinal = `<div style="text-align:center; margin-bottom:15px;"><button id="dr-download-btn" class="dr-btn dr-btn-success">Baixar Relatório Completo (CSV)</button></div>`;

        for (const nomeColaborador in dadosAgrupados) {
            htmlFinal += `<h2 class="dr-colab-header">${nomeColaborador}</h2>`;

            for (const mes in dadosAgrupados[nomeColaborador]) {
                const dadosDoMes = dadosAgrupados[nomeColaborador][mes];
                
                const diasTrabalhados = dadosDoMes.filter(d => d.totalHoras !== '00:00');
                const totalMinutosTrabalhados = diasTrabalhados.reduce((acc, d) => acc + calcularMinutos(d.totalHoras), 0);
                const mediaMinutos = diasTrabalhados.length > 0 ? totalMinutosTrabalhados / diasTrabalhados.length : 0;
                const mediaHoras = `${String(Math.floor(mediaMinutos / 60)).padStart(2, '0')}:${String(Math.round(mediaMinutos % 60)).padStart(2, '0')}`;
                const diasIrregulares = dadosDoMes.filter(d => d.horarios.length % 2 !== 0 && d.horarios.length > 0).length;

                htmlFinal += `
                    <div class="dr-summary-box">
                        <h3 class="dr-month-header">${formatarMesAno(mes)}</h3>
                        <p><strong>Dias com registro:</strong> ${diasTrabalhados.length}</p>
                        <p><strong>Média de horas/dia:</strong> ${mediaHoras}</p>
                        <p style="color:${diasIrregulares > 0 ? '#dc3545' : '#28a745'};"><strong>Dias com batidas ímpares (erros):</strong> ${diasIrregulares}</p>
                    </div>
                `;

                htmlFinal += `
                    <div class="dr-table-wrapper">
                        <table class="dr-table">
                            <thead>
                                <tr><th>Data</th><th>Dia</th><th>E1</th><th>S1</th><th>E2</th><th>S2</th><th>E3</th><th>S3</th><th>Total</th></tr>
                            </thead>
                            <tbody>
                `;
                dadosDoMes.forEach(d => {
                    const temErro = d.horarios.length > 0 && d.horarios.length % 2 !== 0;
                    const horariosColoridos = d.horariosPadronizados.map((h, i) => {
                        const cor = h ? (i % 2 === 0 ? '#28a745' : '#dc3545') : '#ccc';
                        return `<td style="color:${cor}; font-weight:bold;">${h}</td>`;
                    }).join('');
                    htmlFinal += `
                        <tr ${temErro ? 'class="dr-row-error"' : ''}>
                            <td>${d.data.split('-').reverse().join('/')}</td>
                            <td>${d.diaSemana.substring(0,3)}</td>
                            ${horariosColoridos}
                            <td><strong>${d.totalHoras}</strong></td>
                        </tr>
                    `;
                });
                htmlFinal += `</tbody></table></div>`;
            }
        }

        painelResultados.innerHTML = htmlFinal;
        document.getElementById('dr-download-btn').onclick = () => baixarCSV(mesInicio, mesFim);
    }

    function baixarCSV(mesInicio, mesFim) {
        if (dadosParaCSV.length === 0) return;
        const cabecalho = ['Colaborador', 'Data', 'Dia da Semana', 'Entrada 1', 'Saida 1', 'Entrada 2', 'Saida 2', 'Entrada 3', 'Saida 3', 'Total Horas Trabalhadas'];
        const conteudoCsv = dadosParaCSV.map(e => [`"${e.colaborador}"`, `"${e.data}"`, `"${e.diaSemana}"`, ...e.horariosPadronizados.map(h => `"${h}"`), `"${e.totalHoras}"`].join(',')).join('\n');
        const csvFinal = cabecalho.join(',') + '\n' + conteudoCsv;

        const blob = new Blob([csvFinal], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_ponto_${mesInicio}_a_${mesFim}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- CRIAÇÃO DO PAINEL DE CONTROLE E ESTILOS ---
    function criarPainel() {
        const painelHTML = `
            <div id="dr-painel">
                <div id="dr-header">
                    <h3>Gerador de Relatório de Ponto</h3>
                    <span id="dr-close">&times;</span>
                </div>
                <div id="dr-corpo">
                    <div id="dr-filtros">
                        <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                            <div>
                                <label for="dr-mes-inicio">Mês de Início:</label>
                                <input type="month" id="dr-mes-inicio">
                            </div>
                            <div>
                                <label for="dr-mes-fim">Mês de Fim:</label>
                                <input type="month" id="dr-mes-fim">
                            </div>
                        </div>
                        <div id="dr-colaboradores-container">
                            <strong>Colaboradores:</strong>
                            <div id="dr-colaboradores-lista"></div>
                        </div>
                        <button id="dr-gerar-btn" class="dr-btn dr-btn-primary">Gerar Relatório</button>
                    </div>
                    <hr style="margin:20px 0;">
                    <div id="dr-resultados">
                        <p>Selecione o período e os colaboradores, depois clique em "Gerar Relatório".</p>
                    </div>
                </div>
            </div>
        `;

        const estiloCSS = `
            #dr-painel { display:block; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:900px; max-width:95vw; max-height:90vh; background:white; border:1px solid #ccc; box-shadow:0 4px 8px rgba(0,0,0,0.2); z-index:10000; font-family:sans-serif; }
            #dr-header { padding:10px 15px; background:#f7f7f7; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center; cursor:move; }
            #dr-header h3 { margin:0; }
            #dr-close { cursor:pointer; font-size:24px; font-weight:bold; color:#aaa; }
            #dr-corpo { padding:15px; overflow-y:auto; max-height:calc(90vh - 50px); }
            #dr-filtros label { font-weight:bold; display:block; margin-bottom:5px; }
            #dr-filtros input[type="month"] { padding:5px; border:1px solid #ccc; border-radius:4px; }
            #dr-colaboradores-container { margin-top:15px; margin-bottom:15px; }
            #dr-colaboradores-lista { display:flex; flex-direction:column; gap:5px; margin-top:5px; padding-left:10px; }
            .dr-cb-item { display:flex; align-items:center; gap:8px; }
            .dr-btn { padding: 8px 12px; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 14px; transition: background-color 0.2s; }
            .dr-btn-primary { background-color: #007bff; }
            .dr-btn-primary:hover { background-color: #0056b3; }
            .dr-btn-success { background-color: #28a745; }
            .dr-btn-success:hover { background-color: #218838; }
            .dr-colab-header { background-color: #343a40; color: white; padding: 10px; border-radius: 4px; margin-top: 20px; text-align:center; }
            .dr-month-header { margin-top: 15px; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
            .dr-summary-box { margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 4px; }
            .dr-summary-box p { margin: 5px 0; font-size: 14px; }
            .dr-table-wrapper { max-height: 400px; overflow-y: auto; border: 1px solid #ddd; }
            .dr-table { width:100%; border-collapse:collapse; font-size:12px; text-align: center; }
            .dr-table th, .dr-table td { padding:8px; border:1px solid #ddd; }
            .dr-table thead { position: sticky; top: 0; background-color: #f2f2f2; z-index:1; }
            .dr-row-error { background-color: #fff0f0 !important; }
        `;

        document.head.insertAdjacentHTML('beforeend', `<style>${estiloCSS}</style>`);
        document.body.insertAdjacentHTML('beforeend', painelHTML);

        const hoje = new Date();
        const mesSugerido = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('dr-mes-inicio').value = mesSugerido;
        document.getElementById('dr-mes-fim').value = mesSugerido;

        const containerColaboradores = document.getElementById('dr-colaboradores-lista');
        colaboradoresBase.forEach(c => {
            containerColaboradores.innerHTML += `<div class="dr-cb-item"><input type="checkbox" id="dr-cb-${c.id}" checked><label for="dr-cb-${c.id}">${c.nome}</label></div>`;
        });

        document.getElementById('dr-gerar-btn').onclick = gerarRelatorio;
        const painel = document.getElementById('dr-painel');
        document.getElementById('dr-close').onclick = () => { painel.remove(); };

        let isDragging = false, offsetX, offsetY;
        const header = document.getElementById('dr-header');
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - painel.offsetLeft;
            offsetY = e.clientY - painel.offsetTop;
            header.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                painel.style.left = `${e.clientX - offsetX}px`;
                painel.style.top = `${e.clientY - offsetY}px`;
            }
        });
        document.addEventListener('mouseup', () => { isDragging = false; header.style.userSelect = 'auto'; });
    }

    criarPainel();

})();
