(() => {
    'use strict';

    const paginaAlvo = 'https://clube04.com.br/digital/gerenciarponto.php';
    if (window.location.href.split('?')[0] !== paginaAlvo) {
        alert("Você não está na página do Relatório de Ponto.\n\nEstamos te levando para lá agora!\n\nAssim que a nova página carregar, por favor, clique no seu favorito 'Gerador de Relatório' mais uma vez para ativar a ferramenta.");
        window.location.href = paginaAlvo;
        return;
    }

    function rodarGerador() {
        const painelExistente = document.getElementById('dr-painel');
        if (painelExistente) {
            painelExistente.style.display = 'block';
            return;
        }
        // Adicione o filtro de colaboradores aqui
        const whitelistNomes = [
            'Ana Clara de Olivera Franco',
            'Isabely de Barros Quirino Neves',
            'Michelle Carolina Ladislau de Sousa'
        ];

        const colaboradoresBase = Array.from(document.querySelectorAll('#idColaboradorBusca option'))
            .filter(opt => {
                const nome = opt.textContent.trim();
                return opt.value && opt.value !== '' && whitelistNomes.includes(nome);
            })
            .map(opt => ({
                id: opt.value,
                nome: opt.textContent.trim()
            }));

        let dadosParaCSV = [];

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
                if (!agrupado[d.colaborador]) agrupado[d.colaborador] = {};
                if (!agrupado[d.colaborador][mes]) agrupado[d.colaborador][mes] = [];
                agrupado[d.colaborador][mes].push(d);
            });
            return agrupado;
        }

        function formatarMesAno(mesString) {
            const [ano, mesNum] = mesString.split('-');
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            return `${meses[parseInt(mesNum, 10) - 1]} de ${ano}`;
        }

        // Validações
        function validarBatidas(dia, horarios, totalHoras, diaSemana) {
            const validacoes = [];
            const batidas = horarios.filter(Boolean);
            const totalBatidas = batidas.length;

            // Não gerar validação para dias sem batidas (folga)
            if (totalBatidas === 0) return [];

            // Batidas ímpares
            if (totalBatidas % 2 !== 0) validacoes.push('Qtd ímpar de batidas de ponto');

            // 2 batidas
            if (totalBatidas === 2) validacoes.push('2 batidas registradas');

            // 6 batidas
            if (totalBatidas === 6) validacoes.push('6 batidas registradas');

            // Diferença menor que 15 min
            for (let i = 1; i < batidas.length; i++) {
                if (batidas[i] && batidas[i - 1]) {
                    const diff = Math.abs(calcularMinutos(batidas[i]) - calcularMinutos(batidas[i - 1]));
                    if (diff < 15) {
                        validacoes.push(`Batidas consecutivas com intervalo menor que 15min (${batidas[i - 1]} - ${batidas[i]})`);
                        break;
                    }
                }
            }

            // Horas trabalhadas fora dos padrões
            const minutosTrabalhados = calcularMinutos(totalHoras);

            if (diaSemana === 'Sábado') {
                if (minutosTrabalhados > 0 && minutosTrabalhados < 6 * 60) {
                    validacoes.push('Qtd de horas trabalhadas (<6h)');
                }
                if (minutosTrabalhados > 9 * 60) {
                    validacoes.push('Qtd de horas trabalhadas (>9h)');
                }
            } else if (diaSemana !== 'Domingo') {
                if (minutosTrabalhados > 0 && minutosTrabalhados < 6 * 60) {
                    validacoes.push('Qtd de horas trabalhadas (<6h)');
                }
                if (minutosTrabalhados > 8 * 60) {
                    validacoes.push('Qtd de horas trabalhadas (>8h)');
                }
            }
            // Domingo: nunca valida hora trabalhada

            return validacoes;
        }

        function exibirResultados(dados, mesInicio, mesFim) {
            const painelResultados = document.getElementById('dr-resultados');
            if (dados.length === 0) {
                painelResultados.innerHTML = '<p>Nenhum dado encontrado para os filtros selecionados.</p>';
                return;
            }
            const dadosAgrupados = agruparDados(dados);
            let htmlFinal = `<div style="text-align:center; margin-bottom:15px;"><button id="dr-download-btn" class="dr-btn dr-btn-success">Baixar Arquivos (ZIP/CSV)</button></div>`;
            for (const nomeColaborador in dadosAgrupados) {
                htmlFinal += `<h2 class="dr-colab-header">${nomeColaborador}</h2>`;
                for (const mes in dadosAgrupados[nomeColaborador]) {
                    const dadosDoMes = dadosAgrupados[nomeColaborador][mes];
                    htmlFinal += `<div class="dr-summary-box"><h3 class="dr-month-header">${formatarMesAno(mes)}</h3>`;
                    htmlFinal += `<p><strong>Dias com registro:</strong> ${dadosDoMes.filter(d => d.totalHoras !== '00:00').length}</p>`;
                    const diasComErro = dadosDoMes.filter(d => d.validacoes && d.validacoes.length > 0);
                    htmlFinal += `<p style="color:${diasComErro.length ? '#dc3545' : '#28a745'};"><strong>Dias com ocorrência:</strong> ${diasComErro.length}</p>`;
                    if (diasComErro.length > 0) {
                        htmlFinal += `<ul style="color:#dc3545; margin:0 0 10px 0; font-size:13px;">`;
                        diasComErro.forEach(d => {
                            htmlFinal += `<li>${d.data.split('-').reverse().join('/')} (${d.diaSemana.substring(0,3)}): ${d.validacoes.join('; ')}</li>`;
                        });
                        htmlFinal += `</ul>`;
                    }
                    htmlFinal += `</div>`;
                    htmlFinal += `<div class="dr-table-wrapper"><table class="dr-table"><thead><tr><th>Data</th><th>Dia</th><th>E1</th><th>S1</th><th>E2</th><th>S2</th><th>E3</th><th>S3</th><th>Total</th><th>Validações</th></tr></thead><tbody>`;
                    dadosDoMes.forEach(d => {
                        const horariosColoridos = d.horariosPadronizados.map((h, i) => {
                            const cor = h ? (i % 2 === 0 ? '#28a745' : '#dc3545') : '#ccc';
                            return `<td style="color:${cor}; font-weight:bold;">${h}</td>`;
                        }).join('');
                        htmlFinal += `<tr${d.validacoes && d.validacoes.length ? ' class="dr-row-error"' : ''}><td>${d.data.split('-').reverse().join('/')}</td><td>${d.diaSemana.substring(0,3)}</td>${horariosColoridos}<td><strong>${d.totalHoras}</strong></td><td style="color:#dc3545;">${(d.validacoes || []).join('; ')}</td></tr>`;
                    });
                    htmlFinal += `</tbody></table></div>`;
                }
            }
            painelResultados.innerHTML = htmlFinal;
            document.getElementById('dr-download-btn').onclick = () => baixarArquivos(dadosAgrupados);
        }

        async function baixarArquivos(dadosAgrupados) {
            const arquivos = [];
            for (const colaborador in dadosAgrupados) {
                for (const mes in dadosAgrupados[colaborador]) {
                    const dados = dadosAgrupados[colaborador][mes];
                    const cabecalho = [
                        'Colaborador', 'Data', 'Dia da Semana',
                        'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3',
                        'Total Horas Trabalhadas', 'Validações'
                    ];
                    const linhas = dados.map(e => [
                        `"${e.colaborador}"`, `"${e.data}"`, `"${e.diaSemana}"`,
                        ...e.horariosPadronizados.map(h => `"${h}"`),
                        `"${e.totalHoras}"`, `"${(e.validacoes || []).join('; ')}"`
                    ].join(';')).join('\n');
                    const conteudo = '\uFEFF' + cabecalho.join(';') + '\n' + linhas;
                    arquivos.push({
                        nome: `Ponto_${colaborador.replace(/\s/g, '_')}_${mes}.csv`,
                        conteudo
                    });
                }
            }
            if (arquivos.length === 1) {
                const blob = new Blob([arquivos[0].conteudo], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = arquivos[0].nome;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                if (!window.JSZip) {
                    await new Promise((res) => {
                        const s = document.createElement('script');
                        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                        s.onload = res;
                        document.head.appendChild(s);
                    });
                }
                const zip = new window.JSZip();
                arquivos.forEach(a => zip.file(a.nome, a.conteudo));
                const blobZip = await zip.generateAsync({ type: "blob" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blobZip);
                link.download = `Relatorio_Ponto_${new Date().toISOString().slice(0,7)}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

        async function gerarRelatorio() {
            const painelResultados = document.getElementById('dr-resultados');
            const mesInicio = document.getElementById('dr-mes-inicio').value;
            const mesFim = document.getElementById('dr-mes-fim').value;
            if (!mesInicio || !mesFim || mesFim < mesInicio) {
                painelResultados.innerHTML = '<p style="color:red;">Erro: Período inválido.</p>';
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
                        const validacoes = validarBatidas(data, horariosBatidos, totalHoras, diaSemana);
                        todosOsDados.push({
                            colaborador: colaborador.nome, data, diaSemana,
                            horarios: horariosBatidos, horariosPadronizados, totalHoras,
                            validacoes
                        });
                    });
                }
            }
            dadosParaCSV = todosOsDados;
            exibirResultados(todosOsDados, mesInicio, mesFim);
        }

        // Painel, agora sem colaboradores pré-selecionados e mês sugerido ajustado para mês anterior
        function criarPainel() {
            const estiloCSS = `
#dr-painel { display:block; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:900px; max-width:95vw; max-height:90vh; background:white; border:1px solid #ccc; box-shadow:0 4px 8px rgba(0,0,0,0.2); z-index:100000; font-family:sans-serif; }
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

            const painelHTML = `
<div id="dr-painel">
  <div id="dr-header"><h3>Gerador de Relatório de Ponto</h3><span id="dr-close">&times;</span></div>
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
      <div id="dr-colaboradores-container"><strong>Colaboradores:</strong>
        <div id="dr-colaboradores-lista"></div>
      </div>
      <button id="dr-gerar-btn" class="dr-btn dr-btn-primary">Gerar Relatório</button>
    </div>
    <hr style="margin:20px 0;">
    <div id="dr-resultados"><p>Selecione o período e os colaboradores, depois clique em "Gerar Relatório".</p></div>
  </div>
</div>
            `;
            document.body.insertAdjacentHTML('beforeend', painelHTML);

            // Mês padrão: sempre mês anterior ao mês atual
            const hoje = new Date();
            hoje.setMonth(hoje.getMonth() - 1);
            const mesAnterior = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
            document.getElementById('dr-mes-inicio').value = mesAnterior;
            document.getElementById('dr-mes-fim').value = mesAnterior;

            // Colaboradores SEM pré-seleção
            const containerColaboradores = document.getElementById('dr-colaboradores-lista');
            colaboradoresBase.forEach(c => {
                containerColaboradores.innerHTML += `<div class="dr-cb-item"><input type="checkbox" id="dr-cb-${c.id}"><label for="dr-cb-${c.id}">${c.nome}</label></div>`;
            });

            document.getElementById('dr-gerar-btn').onclick = gerarRelatorio;
            const painel = document.getElementById('dr-painel');
            document.getElementById('dr-close').onclick = () => { painel.style.display = 'none'; };

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
            document.addEventListener('mouseup', () => {
                isDragging = false;
                header.style.userSelect = 'auto';
            });
        }

        criarPainel();
    }

    if (!document.getElementById('dr-container-flutuante')) {
        const container = document.createElement('div');
        container.id = 'dr-container-flutuante';
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '99999',
            width: '60px',
            height: '60px'
        });

        const btnAcesso = document.createElement('button');
        btnAcesso.title = 'Gerar Relatório de Ponto';
        btnAcesso.innerHTML = '🕒';
        Object.assign(btnAcesso.style, {
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#fd7e14',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s ease-out'
        });

        const btnFechar = document.createElement('button');
        btnFechar.innerHTML = '&times;';
        btnFechar.title = 'Fechar botão';
        Object.assign(btnFechar.style, {
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: '#dc3545',
            color: 'white',
            border: '2px solid white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 0 2px 0'
        });

        btnAcesso.onmouseover = () => { btnAcesso.style.transform = 'scale(1.1)'; };
        btnAcesso.onmouseout = () => { btnAcesso.style.transform = 'scale(1)'; };
        btnAcesso.onclick = rodarGerador;
        btnFechar.onclick = () => { container.remove(); };

        container.appendChild(btnAcesso);
        container.appendChild(btnFechar);
        document.body.appendChild(container);
    }
})();
