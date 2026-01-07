/**
 * CLUBE04 SUITE - MÓDULO PONTO (c04-ponto.js)
 * Versão: 5.2.0
 * * --- LÓGICA DO SCRIPT ---
 * 1. Crawler Inteligente: 
 * - Acessa a listagem geral (pessoa.php) via fetch.
 * - Filtra visualmente quem é de "São Paulo - Mogi das Cruzes" ANTES de abrir detalhes.
 * - Acessa detalhes (pessoaeditar.php) apenas dos filtrados para validar Cargo e Status.
 * * 2. Gerador em Background (Tecnologia v4.30.0):
 * - Ao clicar em "Gerar", cria um IFRAME oculto carregando 'gerenciarponto.php'.
 * - Injeta os filtros (Data, Colaborador) dentro do Iframe.
 * - Dispara o botão de busca e intercepta o retorno do jQuery AJAX.
 * - Extrai os dados da tabela resultante sem que o usuário precise sair da tela atual.
 * * --- CHANGELOG ---
 * [5.2.0] - Implementação de Iframe para geração em background (não precisa estar na pág de ponto).
 * - Filtro de Unidade movido para a etapa inicial (listagem) para performance.
 * - Restrição de cargos para Cuidador, Tosador e Consultor.
 * [5.1.0] - Versão inicial integrada à Suite.
 */

(function () {
    'use strict';

    // Se o painel já existir, apenas mostra
    if (document.getElementById('dr-painel')) {
        document.getElementById('dr-painel').style.display = 'block';
        return;
    }

    // LISTENER DO HUB
    window.addEventListener('c04_open_ponto', () => {
        const p = document.getElementById('dr-painel');
        if(p) p.style.display = 'block';
        else initPonto();
    });
    
    // --- CONFIGURAÇÕES ---
    const UNIDADE_ALVO = "São Paulo - Mogi das Cruzes";
    // Cargos permitidos (Case sensitive parcial, verificamos se contem a string)
    const CARGOS_ALVO = ["Cuidador", "Tosador", "Consultor"]; 
    
    // URLs do sistema
    const URL_LISTAGEM = 'https://clube04.com.br/digital/pessoa.php';
    const URL_DETALHE = 'https://clube04.com.br/digital/pessoaeditar.php';
    const URL_RELATORIO = 'https://clube04.com.br/digital/gerenciarponto.php';

    let listaColaboradoresCache = [];

    // --- HELPER: AJAX & FETCH ---

    async function fetchTexto(url, formData = null) {
        const options = formData ? { method: 'POST', body: formData } : { method: 'GET' };
        try {
            const resp = await fetch(url, options);
            const buffer = await resp.arrayBuffer();
            return new TextDecoder("iso-8859-1").decode(buffer);
        } catch (e) {
            console.error("Erro no fetch:", url, e);
            return "";
        }
    }

    // Cria um Iframe oculto para processamento em background (Técnica do 4.30.0)
    async function createIframe(url) {
        const ifr = document.createElement('iframe');
        ifr.style.display = "none";
        ifr.style.width = "1024px"; 
        ifr.style.height = "768px";
        ifr.src = url;
        document.body.appendChild(ifr);
        
        return new Promise(resolve => {
            ifr.onload = () => resolve(ifr);
        });
    }

    // Hook para esperar o AJAX do jQuery terminar dentro do Iframe
    function searchWithAjaxHook(ifr, btnSelector) {
        return new Promise((resolve, reject) => {
            const win = ifr.contentWindow;
            const doc = ifr.contentDocument;

            if (!win.$) { 
                reject("jQuery não carregado no destino."); 
                return; 
            }

            const timeoutId = setTimeout(() => { 
                // Fallback: se o ajaxComplete não disparar em 10s, tenta resolver mesmo assim (pode ter carregado cache)
                console.warn("Timeout AJAX Hook - Tentando ler tabela mesmo assim...");
                resolve(); 
            }, 10000);

            const hook = (event, xhr, settings) => {
                // Verifica se a requisição AJAX é de busca de pontos
                if (settings && settings.url && settings.url.includes('gerenciarponto')) {
                    win.$(doc).off("ajaxComplete", hook); 
                    clearTimeout(timeoutId);
                    // Pequeno delay para renderização do DOM da tabela
                    setTimeout(resolve, 500);
                }
            };
            
            win.$(doc).on("ajaxComplete", hook);
            
            const btn = doc.querySelector(btnSelector);
            if(btn) btn.click();
            else reject("Botão de busca não encontrado no iframe.");
        });
    }

    // --- ETAPA 1: CRAWLER DE PESSOAS ---

    async function carregarListaColaboradores() {
        const areaStatus = document.getElementById('dr-status-loading');
        areaStatus.innerHTML = '⏳ 1/2: Filtrando Unidade na Listagem Geral...';
        areaStatus.style.display = 'block';
        document.getElementById('dr-colaboradores-lista').innerHTML = '';

        // 1. Busca Listagem Geral
        const htmlPessoa = await fetchTexto(URL_LISTAGEM);
        const doc = new DOMParser().parseFromString(htmlPessoa, 'text/html');
        const linhas = doc.querySelectorAll('#idTabelaPessoa tbody tr');

        let candidatos = [];

        // 2. Filtra Mogi na própria tabela (Coluna 6 / Index 5)
        linhas.forEach(tr => {
            const cols = tr.querySelectorAll('td');
            if (cols.length < 6) return;

            const colNome = cols[0];
            const nome = colNome.innerText.trim();
            [cite_start]const unidadeTexto = cols[5].innerText.trim(); // Coluna da Unidade [cite: 63]

            // Validação de Unidade IMEDIATA
            // Verifica se contém a string exata e ignora se tiver múltiplas linhas (quebra de linha) se não for o desejado
            if (!unidadeTexto.includes(UNIDADE_ALVO)) return;

            // Extrai ID
            const onclick = colNome.getAttribute('onclick') || "";
            const matchId = onclick.match(/redirecionarPessoaEditar\('(\d+)'/);
            const id = matchId ? matchId[1] : null;

            if (id) {
                candidatos.push({ id, nome });
            }
        });

        if (candidatos.length === 0) {
            areaStatus.innerHTML = '⚠️ Ninguém encontrado em Mogi das Cruzes.';
            return;
        }

        // 3. Verifica Detalhes (Cargo e Status)
        let finais = [];
        let count = 0;
        
        for (const cand of candidatos) {
            count++;
            areaStatus.innerHTML = `⏳ 2/2: Validando Cargos (${count}/${candidatos.length})...`;
            
            const fd = new FormData();
            fd.append('idPessoa', cand.id);
            fd.append('idTipoPessoa', '1');

            try {
                const htmlEdit = await fetchTexto(URL_DETALHE, fd);
                const docEdit = new DOMParser().parseFromString(htmlEdit, 'text/html');
                
                [cite_start]// Status [cite: 146]
                const btnStatus = docEdit.querySelector('button[data-id="statusPessoa"]');
                const statusTexto = btnStatus ? btnStatus.getAttribute('title') : "Desconhecido";

                [cite_start]// Cargo [cite: 148-150]
                const btnCargo = docEdit.querySelector('button[data-id="idCargo"]');
                const cargoTexto = btnCargo ? btnCargo.getAttribute('title') : "";

                // Valida Cargo (Contém "Cuidador", "Tosador" ou "Consultor")
                const cargoValido = CARGOS_ALVO.some(alvo => cargoTexto.includes(alvo));

                if (cargoValido) {
                    finais.push({ ...cand, cargo: cargoTexto, status: statusTexto });
                }

            } catch (e) { console.error(e); }
            
            // Pequeno respiro para a CPU
            if(count % 5 === 0) await new Promise(r => setTimeout(r, 20));
        }

        listaColaboradoresCache = finais;
        areaStatus.style.display = 'none';
        renderizarListaSelecao();
    }

    function renderizarListaSelecao() {
        const listaDiv = document.getElementById('dr-colaboradores-lista');
        const checkInativos = document.getElementById('dr-toggle-inativos').checked;
        listaDiv.innerHTML = '';

        const filtrados = listaColaboradoresCache.filter(c => checkInativos ? true : c.status === 'Ativo');
        filtrados.sort((a,b) => a.nome.localeCompare(b.nome));

        if(filtrados.length === 0) {
            listaDiv.innerHTML = '<p style="color:#777; padding:10px;">Nenhum colaborador compatível.</p>';
            return;
        }

        filtrados.forEach(c => {
            const corStatus = c.status === 'Ativo' ? '#28a745' : '#dc3545';
            const checked = c.status === 'Ativo' ? 'checked' : ''; 
            listaDiv.innerHTML += `
                <div class="dr-cb-item">
                    <input type="checkbox" id="dr-cb-${c.id}" value="${c.id}" data-nome="${c.nome}" ${checked}>
                    <label for="dr-cb-${c.id}">
                        ${c.nome}<br>
                        <small style="color:#666">${c.cargo} <span style="color:${corStatus}">●</span></small>
                    </label>
                </div>`;
        });
    }

    // --- ETAPA 2: PROCESSAMENTO EM BACKGROUND (IFRAME) ---

    async function gerarRelatorio() {
        const checkboxes = document.querySelectorAll('#dr-colaboradores-lista input[type="checkbox"]:checked');
        if (checkboxes.length === 0) return alert('Selecione pelo menos um colaborador.');

        const mesInicio = document.getElementById('dr-mes-inicio').value;
        const mesFim = document.getElementById('dr-mes-fim').value;
        const resultDiv = document.getElementById('dr-resultados');
        const btnGerar = document.getElementById('dr-gerar');
        
        // Bloqueia UI
        btnGerar.disabled = true;
        resultDiv.innerHTML = '<div style="padding:20px; text-align:center;"><div class="loader"></div><p>Inicializando Iframe em Background...</p></div>';

        // 1. Cria Iframe Único para a Sessão
        let ifr;
        try {
             ifr = await createIframe(URL_RELATORIO);
        } catch (e) {
            btnGerar.disabled = false;
            resultDiv.innerHTML = '<p style="color:red">Erro ao carregar página de ponto.</p>';
            return;
        }

        const listaMeses = [];
        let atual = new Date(mesInicio + '-02');
        const fim = new Date(mesFim + '-02');
        while (atual <= fim) {
            listaMeses.push(atual.toISOString().slice(0, 7));
            atual.setMonth(atual.getMonth() + 1);
        }

        let dadosExportacao = []; 
        let totalPassos = checkboxes.length * listaMeses.length;
        let passoAtual = 0;

        // Loop de processamento
        for (const cb of checkboxes) {
            const idColab = cb.value;
            const nomeColab = cb.getAttribute('data-nome');

            for (const mes of listaMeses) {
                passoAtual++;
                resultDiv.innerHTML = `<div style="padding:20px; text-align:center;"><div class="loader"></div><p>Processando ${passoAtual}/${totalPassos}<br><b>${nomeColab}</b> (${mes})</p></div>`;

                const doc = ifr.contentDocument;
                const win = ifr.contentWindow;

                // Define Datas
                const dt = new Date(mes + '-01'); 
                const lastDay = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate();
                
                // Injeta Valores no Iframe
                const elIni = doc.getElementById('dataInicioBusca');
                const elFim = doc.getElementById('dataFimBusca');
                
                if(elIni) elIni.value = mes + '-01';
                if(elFim) elFim.value = mes + '-' + lastDay;

                // Seleciona Colaborador (Bootstrap Select do Metronic Theme)
                const select = doc.getElementById('idColaboradorBusca');
                if(win.$ && select) {
                    win.$(select).val(idColab).selectpicker('refresh');
                } else if (select) {
                    select.value = idColab; // Fallback sem jQuery
                }

                // Dispara Busca e Aguarda
                try {
                    await searchWithAjaxHook(ifr, '#buttonbuscarPontos');
                } catch (err) {
                    console.warn("Erro no hook AJAX, tentando continuar:", err);
                }

                // Extrai Dados da Tabela do Iframe
                const rows = doc.querySelectorAll('#idTabelaPontos tbody tr');
                rows.forEach(r => {
                    const tds = r.querySelectorAll('td');
                    if(tds.length < 3) return;
                    
                    const dataTxt = tds[0].innerText.trim();
                    if(!dataTxt || dataTxt.includes("Nenhum")) return;

                    const inputs = r.querySelectorAll('input[type="time"]');
                    const horarios = Array.from(inputs).map(i => i.value).filter(v=>v);
                    
                    const totalMatch = tds[2].innerText.match(/Horas Trabalhadas: ([\d:]+)/);
                    const total = totalMatch ? totalMatch[1] : '00:00';
                    
                    let alertas = [];
                    if(horarios.length % 2 !== 0) alertas.push("Marcação Ímpar");
                    if(horarios.length === 0) alertas.push("Sem Marcação");

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
        
        // Limpeza
        ifr.remove();
        btnGerar.disabled = false;
        renderizarResultadosFinais(dadosExportacao);
    }

    function renderizarResultadosFinais(dados) {
        const div = document.getElementById('dr-resultados');
        if (dados.length === 0) {
            div.innerHTML = '<p style="text-align:center; color:red;">Nenhum registro encontrado.</p>';
            return;
        }

        let csv = "Colaborador;Mes;Data;Entrada 1;Saida 1;Entrada 2;Saida 2;Entrada 3;Saida 3;Total Horas;Alertas\n";
        dados.forEach(d => {
            csv += `${d.colaborador};${d.mes};${d.data};${d.e1};${d.s1};${d.e2};${d.s2};${d.e3};${d.s3};${d.total};${d.alertas}\n`;
        });

        div.innerHTML = `
            <div style="text-align:center; padding:15px; background:#f0fdf4; border:1px solid #10b981; border-radius:8px;">
                <h3 style="color:#065f46; margin:0 0 10px 0;">Sucesso!</h3>
                <p>Processados <strong>${dados.length}</strong> dias de ponto.</p>
                <button id="btn-dl-csv" class="dr-btn dr-btn-success" style="font-size:16px;">📥 Baixar CSV</button>
            </div>
        `;

        document.getElementById('btn-dl-csv').onclick = () => {
            const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Ponto_Mogi_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }

    // --- INTERFACE (UI) ---
    function initPonto() {
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
            .dr-btn:disabled { background:#ccc; cursor:not-allowed; }
            #dr-status-loading { color:#d97706; font-size:13px; font-weight:600; margin-bottom:10px; padding:10px; background:#fffbeb; border-radius:6px; display:none; }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #10b981; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        const styleTag = document.createElement('style'); styleTag.innerHTML = style; document.head.appendChild(styleTag);

        const hoje = new Date();
        hoje.setMonth(hoje.getMonth() - 1);
        const mesPadrao = hoje.toISOString().slice(0,7);

        const html = `
            <div id="dr-painel">
                <div id="dr-header"><span>🕒 Relatório de Ponto v5.2</span><span id="dr-close">&times;</span></div>
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
                        <div id="dr-colaboradores-lista" style="padding:10px; text-align:center; color:#9ca3af;">Inicializando Crawler...</div>
                    </div>

                    <button id="dr-gerar" class="dr-btn dr-btn-primary">Gerar Relatório</button>
                    
                    <div id="dr-resultados" style="margin-top:20px;"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('dr-close').onclick = () => document.getElementById('dr-painel').style.display = 'none';
        document.getElementById('dr-toggle-inativos').onchange = renderizarListaSelecao;
        document.getElementById('dr-gerar').onclick = gerarRelatorio;

        carregarListaColaboradores();
    }
})();
