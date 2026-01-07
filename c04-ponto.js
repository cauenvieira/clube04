(function () {
    'use strict';

    // Se o painel já existir, apenas mostra
    if (document.getElementById('dr-painel')) {
        document.getElementById('dr-painel').style.display = 'block';
        return;
    }

    // LISTENER DO HUB: Abre o painel quando solicitado pelo menu principal
    window.addEventListener('c04_open_ponto', () => {
        const p = document.getElementById('dr-painel');
        if(p) p.style.display = 'block';
        else initPonto();
    });
    
    // --- CONFIGURAÇÕES ---
    const UNIDADE_ALVO = "São Paulo - Mogi das Cruzes";
    // Lista de cargos para pré-selecionar (Opcional, mas ajuda a filtrar a lista visualmente)
    const CARGOS_INTERESSE = ["Cuidador", "Tosador", "Consultor", "Gerente", "Veterinário", "Estagiário"];
    
    let listaColaboradoresCache = [];

    // --- FUNÇÕES DE BUSCA E PARSE (CRAWLER) ---

    // Função para buscar texto HTML de uma URL (GET ou POST)
    async function fetchTexto(url, formData = null) {
        const options = formData ? { method: 'POST', body: formData } : { method: 'GET' };
        try {
            const resp = await fetch(url, options);
            const buffer = await resp.arrayBuffer();
            return new TextDecoder("iso-8859-1").decode(buffer); // Decodifica acentos corretamente
        } catch (e) {
            console.error("Erro no fetch:", url, e);
            return "";
        }
    }

    // 1. Busca lista inicial de pessoas
    async function carregarListaColaboradores() {
        const areaStatus = document.getElementById('dr-status-loading');
        areaStatus.innerHTML = '⏳ 1/2: Buscando lista de colaboradores...';
        areaStatus.style.display = 'block';
        document.getElementById('dr-colaboradores-lista').innerHTML = ''; // Limpa lista

        // Passo 1: Obter a lista bruta (simulando uma busca ou pegando a página inicial)
        [cite_start]// Tentamos pegar a página pessoa.php onde a tabela reside [cite: 61]
        const htmlPessoa = await fetchTexto('pessoa.php');
        const doc = new DOMParser().parseFromString(htmlPessoa, 'text/html');
        
        [cite_start]// Seleciona as linhas da tabela conforme estrutura fornecida [cite: 61, 64]
        const linhas = doc.querySelectorAll('#idTabelaPessoa tbody tr');

        let candidatos = [];

        linhas.forEach(tr => {
            const cols = tr.querySelectorAll('td');
            if (cols.length < 6) return;

            // Extração baseada nos snippets fornecidos:
            [cite_start]// Nome e ID estão na primeira coluna [cite: 64]
            const colNome = cols[0];
            const nome = colNome.innerText.trim();
            const onclick = colNome.getAttribute('onclick') || "";
            
            // Regex para extrair ID do onclick="redirecionarPessoaEditar('24243', '1')"
            const matchId = onclick.match(/redirecionarPessoaEditar\('(\d+)'/);
            const id = matchId ? matchId[1] : null;

            [cite_start]// Unidade está em outra coluna (geralmente a 6ª, índice 5) [cite: 65, 71]
            // O usuário informou que o onclick da unidade é igual ao do nome.
            // Vamos procurar na linha qual coluna tem o texto da unidade alvo.
            let ehDaUnidade = false;
            cols.forEach(td => {
                if (td.innerText.includes(UNIDADE_ALVO) && !td.innerText.includes('\n')) {
                    // Verifica se é EXATAMENTE a unidade (para evitar quem tem múltiplas unidades listadas com quebra de linha)
                     ehDaUnidade = true;
                }
            });

            if (id && ehDaUnidade) {
                candidatos.push({ id, nome });
            }
        });

        if (candidatos.length === 0) {
            areaStatus.innerHTML = '⚠️ Nenhum colaborador encontrado nesta unidade. Tente visitar a página "Colaboradores" manualmente uma vez.';
            return;
        }

        // 2. Busca detalhes (Cargo e Status) acessando pessoaeditar.php individualmente
        let finais = [];
        let count = 0;
        
        for (const cand of candidatos) {
            count++;
            areaStatus.innerHTML = `⏳ 2/2: Verificando detalhes (${count}/${candidatos.length})...`;
            
            [cite_start]// Simula o POST para abrir a edição [cite: 138]
            const fd = new FormData();
            fd.append('idPessoa', cand.id);
            fd.append('idTipoPessoa', '1'); // 1 = Colaborador

            try {
                const htmlEdit = await fetchTexto('pessoaeditar.php', fd);
                const docEdit = new DOMParser().parseFromString(htmlEdit, 'text/html');
                
                [cite_start]// Extrair STATUS [cite: 146]
                // <button ... data-id="statusPessoa" title="Ativo">
                const btnStatus = docEdit.querySelector('button[data-id="statusPessoa"]');
                const statusTexto = btnStatus ? btnStatus.getAttribute('title') : "Desconhecido";

                [cite_start]// Extrair CARGO [cite: 148-150]
                // <button ... data-id="idCargo" title="Consultor de vendas">
                const btnCargo = docEdit.querySelector('button[data-id="idCargo"]');
                const cargoTexto = btnCargo ? btnCargo.getAttribute('title') : "Sem Cargo";

                // Adiciona à lista final
                finais.push({ 
                    ...cand, 
                    cargo: cargoTexto, 
                    status: statusTexto 
                });

            } catch (e) { 
                console.error(`Erro ao ler ${cand.nome}`, e); 
            }
        }

        listaColaboradoresCache = finais;
        areaStatus.style.display = 'none';
        renderizarListaSelecao();
    }

    function renderizarListaSelecao() {
        const listaDiv = document.getElementById('dr-colaboradores-lista');
        const checkInativos = document.getElementById('dr-toggle-inativos').checked;
        listaDiv.innerHTML = '';

        // Filtra Inativos se o checkbox não estiver marcado
        const filtrados = listaColaboradoresCache.filter(c => checkInativos ? true : c.status === 'Ativo');
        
        // Ordena por nome
        filtrados.sort((a,b) => a.nome.localeCompare(b.nome));

        if(filtrados.length === 0) {
            listaDiv.innerHTML = '<p style="color:#777; font-style:italic; padding:10px;">Nenhum colaborador encontrado com os filtros atuais.</p>';
            return;
        }

        filtrados.forEach(c => {
            const corStatus = c.status === 'Ativo' ? '#28a745' : '#dc3545';
            // Marca checkbox se estiver ativo e cargo for relevante (opcional)
            const checked = c.status === 'Ativo' ? 'checked' : ''; 
            
            listaDiv.innerHTML += `
                <div class="dr-cb-item">
                    <input type="checkbox" id="dr-cb-${c.id}" value="${c.id}" data-nome="${c.nome}" ${checked}>
                    <label for="dr-cb-${c.id}">
                        ${c.nome} <br>
                        <small style="color:#666">
                           ${c.cargo} • <span style="color:${corStatus}; font-weight:bold;">${c.status}</span>
                        </small>
                    </label>
                </div>`;
        });
    }

    // --- LÓGICA DE GERAÇÃO DO RELATÓRIO ---
    async function gerarRelatorio() {
        // Verifica se está na página certa para manipular o DOM de busca de ponto
        if(!window.location.href.includes('gerenciarponto.php')) {
            alert('⚠️ Para gerar o relatório, você precisa estar na página "Gerenciar Ponto".\n\nRedirecionando você agora... Abra o menu novamente quando a página carregar.');
            window.location.href = 'gerenciarponto.php';
            return;
        }

        const checkboxes = document.querySelectorAll('#dr-colaboradores-lista input[type="checkbox"]:checked');
        if (checkboxes.length === 0) return alert('Selecione pelo menos um colaborador.');

        const mesInicio = document.getElementById('dr-mes-inicio').value;
        const mesFim = document.getElementById('dr-mes-fim').value;
        const resultDiv = document.getElementById('dr-resultados');
        
        resultDiv.innerHTML = '<div style="padding:20px; text-align:center;"><div class="loader"></div><p>Processando pontos... Isso pode levar alguns minutos.</p></div>';

        const listaMeses = [];
        let atual = new Date(mesInicio + '-02');
        const fim = new Date(mesFim + '-02');
        while (atual <= fim) {
            listaMeses.push(atual.toISOString().slice(0, 7));
            atual.setMonth(atual.getMonth() + 1);
        }

        let dadosExportacao = []; // Array flat para CSV

        for (const cb of checkboxes) {
            const idColab = cb.value;
            const nomeColab = cb.getAttribute('data-nome');

            for (const mes of listaMeses) {
                // Injeta valores no filtro do sistema 'gerenciarponto.php'
                $('#dataInicioBusca').val(mes + '-01'); 
                const dt = new Date(mes + '-01'); 
                const lastDay = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate();
                $('#dataFimBusca').val(mes + '-' + lastDay);
                
                // Atualiza o selectpicker do sistema
                $('#idColaboradorBusca').val(idColab).selectpicker('refresh');
                
                // Clica no botão nativo de buscar
                document.getElementById('buttonbuscarPontos').click();
                
                // Espera carregamento (Observando o loader do sistema)
                await new Promise(r => {
                    let tentativas = 0;
                    const check = setInterval(() => {
                        tentativas++;
                        const loader = document.querySelector('.page-loader-wrapper');
                        const display = loader ? loader.style.display : 'none';
                        // Espera o loader aparecer e sumir, ou timeout
                        if((display === 'none' && tentativas > 2) || tentativas > 20) { 
                            clearInterval(check); r(); 
                        }
                    }, 300);
                });

                // Extração dos dados da tabela renderizada pelo sistema
                const rows = document.querySelectorAll('#idTabelaPontos tbody tr');
                rows.forEach(r => {
                    const tds = r.querySelectorAll('td');
                    if(tds.length < 3) return;
                    
                    const dataTxt = tds[0].innerText.trim(); // dd/mm/yyyy
                    if(dataTxt.includes("Nenhum")) return;

                    const inputs = r.querySelectorAll('input[type="time"]');
                    const horarios = Array.from(inputs).map(i => i.value).filter(v=>v);
                    
                    [cite_start]// Regex para pegar total de horas [cite: 37]
                    const totalMatch = tds[2].innerText.match(/Horas Trabalhadas: ([\d:]+)/);
                    const total = totalMatch ? totalMatch[1] : '00:00';
                    
                    // Validações Básicas
                    let alertas = [];
                    if(horarios.length % 2 !== 0) alertas.push("Marcação Ímpar");
                    
                    dadosExportacao.push({
                        colaborador: nomeColab,
                        mes: mes,
                        data: dataTxt,
                        e1: horarios[0] || '', s1: horarios[1] || '',
                        e2: horarios[2] || '', s2: horarios[3] || '',
                        e3: horarios[4] || '', s3: horarios[5] || '',
                        total: total,
                        alertas: alertas.join(', ')
                    });
                });
            }
        }
        
        renderizarResultadosFinais(dadosExportacao);
    }

    function renderizarResultadosFinais(dados) {
        const div = document.getElementById('dr-resultados');
        if (dados.length === 0) {
            div.innerHTML = '<p style="text-align:center; color:red;">Nenhum registro de ponto encontrado para o período selecionado.</p>';
            return;
        }

        let csv = "Colaborador;Mes;Data;Entrada 1;Saida 1;Entrada 2;Saida 2;Entrada 3;Saida 3;Total Horas;Alertas\n";
        dados.forEach(d => {
            csv += `${d.colaborador};${d.mes};${d.data};${d.e1};${d.s1};${d.e2};${d.s2};${d.e3};${d.s3};${d.total};${d.alertas}\n`;
        });

        div.innerHTML = `
            <div style="text-align:center; padding:15px; background:#f0fdf4; border:1px solid #10b981; border-radius:8px;">
                <h3 style="color:#065f46; margin:0 0 10px 0;">Relatório Pronto!</h3>
                <p>Foram processados <strong>${dados.length}</strong> registros de ponto.</p>
                <button id="btn-dl-csv" class="dr-btn dr-btn-success" style="font-size:16px;">📥 Baixar Relatório (CSV)</button>
            </div>
        `;

        document.getElementById('btn-dl-csv').onclick = () => {
            const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Relatorio_Ponto_Completo_${new Date().getTime()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }

    // --- INTERFACE (UI) ---
    function initPonto() {
        // CSS do Painel
        const style = `
            #dr-painel { display:block; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:600px; max-width:95vw; max-height:90vh; background:white; border-radius:12px; box-shadow:0 15px 50px rgba(0,0,0,0.4); z-index:100000; font-family:'Segoe UI', sans-serif; display:flex; flex-direction:column; overflow:hidden; border:1px solid #e5e7eb; }
            #dr-header { padding:15px 20px; background:#10b981; color:white; display:flex; justify-content:space-between; align-items:center; font-weight:bold; }
            #dr-close { cursor:pointer; font-size:24px; opacity:0.8; transition:0.2s; } #dr-close:hover { opacity:1; }
            #dr-body { padding:20px; overflow-y:auto; flex:1; background:#f9fafb; }
            .dr-filtros-row { display:flex; gap:15px; margin-bottom:15px; padding:15px; background:white; border-radius:8px; border:1px solid #e5e7eb; align-items:flex-end; }
            .dr-filtros-row label { display:block; font-size:12px; color:#4b5563; margin-bottom:4px; font-weight:600; }
            .dr-filtros-row input[type="month"] { border:1px solid #d1d5db; padding:6px; border-radius:4px; width:100%; }
            .dr-colab-box { max-height:250px; overflow-y:auto; background:white; border:1px solid #d1d5db; border-radius:6px; padding:0; margin-bottom:20px; }
            .dr-cb-item { border-bottom:1px solid #f3f4f6; padding:8px 12px; display:flex; gap:10px; align-items:center; }
            .dr-cb-item:hover { background:#f0fdf4; }
            .dr-cb-item label { font-size:14px; color:#1f2937; cursor:pointer; width:100%; }
            .dr-btn { padding:10px 20px; border:none; border-radius:6px; color:white; cursor:pointer; font-weight:600; transition:0.2s; }
            .dr-btn:hover { filter:brightness(110%); }
            .dr-btn-primary { background:#2563eb; width:100%; }
            .dr-btn-success { background:#10b981; }
            #dr-status-loading { color:#d97706; font-size:13px; font-weight:600; margin-bottom:10px; padding:10px; background:#fffbeb; border-radius:6px; display:none; }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #10b981; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        const styleTag = document.createElement('style'); styleTag.innerHTML = style; document.head.appendChild(styleTag);

        // Datas padrão (Mês anterior)
        const hoje = new Date();
        hoje.setMonth(hoje.getMonth() - 1);
        const mesPadrao = hoje.toISOString().slice(0,7);

        const html = `
            <div id="dr-painel">
                <div id="dr-header"><span>🕒 Relatório de Ponto Inteligente</span><span id="dr-close">&times;</span></div>
                <div id="dr-body">
                    <div class="dr-filtros-row">
                        <div style="flex:1"><label>De:</label><input type="month" id="dr-mes-inicio" value="${mesPadrao}"></div>
                        <div style="flex:1"><label>Até:</label><input type="month" id="dr-mes-fim" value="${mesPadrao}"></div>
                    </div>
                    
                    <div id="dr-status-loading"></div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <label style="font-weight:bold; font-size:13px; color:#374151;">Colaboradores (Mogi das Cruzes)</label>
                        <div style="font-size:12px;">
                            <input type="checkbox" id="dr-toggle-inativos"> <label for="dr-toggle-inativos" style="cursor:pointer">Mostrar Inativos</label>
                        </div>
                    </div>

                    <div class="dr-colab-box">
                        <div id="dr-colaboradores-lista" style="padding:10px; text-align:center; color:#9ca3af;">Clique em "Gerar" para carregar...</div>
                    </div>

                    <button id="dr-gerar" class="dr-btn dr-btn-primary">Gerar Relatório</button>
                    
                    <div id="dr-resultados" style="margin-top:20px;"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Bind Eventos
        document.getElementById('dr-close').onclick = () => document.getElementById('dr-painel').style.display = 'none';
        document.getElementById('dr-toggle-inativos').onchange = renderizarListaSelecao;
        document.getElementById('dr-gerar').onclick = gerarRelatorio;

        // Inicia o Crawler automaticamente ao abrir
        carregarListaColaboradores();
    }

})();
