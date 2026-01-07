(function () {
    "use strict";

    window.addEventListener('c04_open_ponto', () => {
        const painel = document.getElementById("c04-ponto-painel");
        if (painel) painel.style.display = 'flex';
        else initPontoUI();
    });

    [cite_start]const URL_COLABORADOR = "https://clube04.com.br/digital/pessoa.php"; // Página de listagem [cite: 361]
    const URL_EDITAR_PESSOA = "https://clube04.com.br/digital/pessoaeditar.php"; [cite_start]// Edição [cite: 361]
    const URL_PONTO = "https://clube04.com.br/digital/gerenciarponto.php"; // Relatório

    function initPontoUI() {
        // Estilos
        const style = document.createElement('style');
        style.innerHTML = `
            #c04-ponto-painel { font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; }
            .c04-p-btn { width: 100%; padding: 12px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; margin-top: 10px; font-size: 14px; }
            .c04-p-primary { background: #3b82f6; color: white; } .c04-p-primary:hover { background: #2563eb; }
            .c04-p-success { background: #10b981; color: white; } .c04-p-success:hover { background: #059669; }
            .c04-p-list-item { display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
            .c04-p-list-item:hover { background: #f8fafc; }
        `;
        document.head.appendChild(style);

        const painel = document.createElement('div');
        painel.id = 'c04-ponto-painel';
        Object.assign(painel.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '500px', background: 'white', padding: '20px', borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', zIndex: '100002'
        });

        painel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0; color:#1e293b;">🕒 Relatório de Ponto Inteligente</h3>
                <button id="c04-ponto-close" style="background:none; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
            </div>
            
            <div id="c04-ponto-intro" style="background:#eff6ff; padding:12px; border-radius:6px; color:#1e40af; font-size:13px; margin-bottom:15px;">
                Busca automática de colaboradores:<br>• <strong>Ativos</strong><br>• Unidade: <strong>Mogi das Cruzes</strong><br>• Cargos: Cuidador, Tosador, Vendas.
            </div>

            <div id="c04-ponto-loading" style="display:none; text-align:center; padding:20px; color:#64748b;">
                <div style="margin-bottom:8px; font-size:20px;">⏳</div>
                <div id="c04-ponto-msg">Iniciando...</div>
            </div>

            <div id="c04-ponto-config" style="display:none;">
                <div style="max-height:250px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:15px;" id="c04-ponto-list"></div>
                <div style="display:flex; gap:10px;">
                    <div style="flex:1"><label style="font-size:12px; font-weight:bold;">Mês Início</label><input type="month" id="c04-ponto-ini" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px;"></div>
                    <div style="flex:1"><label style="font-size:12px; font-weight:bold;">Mês Fim</label><input type="month" id="c04-ponto-fim" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px;"></div>
                </div>
            </div>

            <button id="c04-ponto-action" class="c04-p-btn c04-p-primary">SINCRONIZAR COLABORADORES</button>
        `;
        document.body.appendChild(painel);

        // Config Data
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        const mesPadrao = d.toISOString().slice(0, 7);
        document.getElementById('c04-ponto-ini').value = mesPadrao;
        document.getElementById('c04-ponto-fim').value = mesPadrao;

        document.getElementById('c04-ponto-close').onclick = () => painel.style.display = 'none';

        const btnAction = document.getElementById('c04-ponto-action');
        const viewIntro = document.getElementById('c04-ponto-intro');
        const viewLoading = document.getElementById('c04-ponto-loading');
        const viewConfig = document.getElementById('c04-ponto-config');
        const msgLoading = document.getElementById('c04-ponto-msg');
        const listContainer = document.getElementById('c04-ponto-list');

        btnAction.onclick = () => {
            if (btnAction.innerText.includes("GERAR")) handleGeracao();
            else handleSincronizacao();
        };

        async function handleSincronizacao() {
            viewIntro.style.display = 'none'; btnAction.style.display = 'none'; viewLoading.style.display = 'block';
            msgLoading.textContent = "Buscando lista geral...";

            try {
                // 1. POST para obter lista filtrada por 'Colaborador' (idTipoPessoa=1)
                const respList = await fetch(URL_COLABORADOR, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'idTipoPessoa=1'
                });
                const txtList = await respList.text();
                const docList = new DOMParser().parseFromString(txtList, 'text/html');
                [cite_start]// Seletor da tabela [cite: 368]
                const rows = Array.from(docList.querySelectorAll('#idTabelaPessoa tbody tr'));

                const preCandidates = [];
                rows.forEach(tr => {
                    const cols = tr.querySelectorAll('td');
                    if (cols.length < 6) return;
                    // Col 0: Nome + onclick ID, Col 4: Status, Col 5: Unidade
                    const nome = cols[0].innerText.trim();
                    [cite_start]const status = cols[4].innerText.trim(); // "Ativa" ou "Inativa" [cite: 372]
                    const unidade = cols[5].innerText.trim(); [cite_start]// "São Paulo - Mogi das Cruzes" [cite: 372]
                    
                    const onClick = cols[0].getAttribute('onclick');
                    const idMatch = onClick ? onClick.match(/'(\d+)'/) : null;

                    if (idMatch && unidade === "São Paulo - Mogi das Cruzes" && status.includes("Ativa")) {
                        preCandidates.push({ id: idMatch[1], nome: nome });
                    }
                });

                // 2. Deep Scan: Verificar Cargo na página de edição
                const validos = [];
                const CARGOS_OK = ["Cuidador", "Tosador", "Consultor", "Venda", "Vendedor"];

                for (let i = 0; i < preCandidates.length; i++) {
                    const c = preCandidates[i];
                    msgLoading.textContent = `Verificando (${i+1}/${preCandidates.length}): ${c.nome.split(' ')[0]}...`;
                    
                    try {
                        const respDet = await fetch(`${URL_EDITAR_PESSOA}?idPessoa=${c.id}&idTipoPessoa=1`); // URL correta para edição
                        const txtDet = await respDet.text();
                        const docDet = new DOMParser().parseFromString(txtDet, 'text/html');
                        
                        [cite_start]// Busca o botão que contém o Cargo selecionado [cite: 456]
                        const btnCargo = docDet.querySelector('button[data-id="idCargo"]');
                        const cargoTitulo = btnCargo ? btnCargo.title : "";
                        
                        if (CARGOS_OK.some(key => cargoTitulo.includes(key))) {
                            validos.push({ ...c, cargo: cargoTitulo });
                        }
                    } catch (e) {}
                }

                // Render
                validos.sort((a,b) => a.nome.localeCompare(b.nome));
                listContainer.innerHTML = "";
                if(validos.length === 0) listContainer.innerHTML = "<div style='padding:10px; color:red'>Nenhum encontrado.</div>";
                else {
                    validos.forEach(v => {
                        listContainer.innerHTML += `
                            <label class="c04-p-list-item">
                                <input type="checkbox" value="${v.id}" data-nome="${v.nome}" checked style="transform:scale(1.2); margin-right:10px;">
                                <div><div style="font-weight:bold; font-size:12px;">${v.nome}</div><div style="font-size:10px; color:#64748b;">${v.cargo}</div></div>
                            </label>`;
                    });
                }

                viewLoading.style.display = 'none'; viewConfig.style.display = 'block';
                btnAction.style.display = 'block'; btnAction.innerText = "GERAR RELATÓRIO (CSV)"; btnAction.className = "c04-p-btn c04-p-success";

            } catch (err) { msgLoading.textContent = "Erro: " + err.message; console.error(err); }
        }

        async function handleGeracao() {
            const checkboxes = Array.from(listContainer.querySelectorAll('input:checked'));
            const ini = document.getElementById('c04-ponto-ini').value;
            const fim = document.getElementById('c04-ponto-fim').value;

            if (checkboxes.length === 0 || !ini || !fim) { alert("Selecione colaboradores e período."); return; }

            viewConfig.style.display = 'none'; viewLoading.style.display = 'block'; btnAction.style.display = 'none';
            msgLoading.innerHTML = "Gerando dados...<br>Isso pode levar alguns minutos.";

            const dadosCSV = [];
            let dt = new Date(ini + "-02"); 
            const dtEnd = new Date(fim + "-02");
            const meses = [];
            while (dt <= dtEnd) { meses.push(dt.toISOString().slice(0, 7)); dt.setMonth(dt.getMonth() + 1); }

            for (const mes of meses) {
                for (let i = 0; i < checkboxes.length; i++) {
                    const idColab = checkboxes[i].value;
                    const nomeColab = checkboxes[i].getAttribute('data-nome');
                    msgLoading.textContent = `Processando ${mes}: ${nomeColab.split(' ')[0]}`;

                    try {
                        // Data Inicio/Fim do Mes
                        const dI = new Date(mes + "-01T12:00:00");
                        const dF = new Date(dI.getFullYear(), dI.getMonth() + 1, 0);
                        const formData = new FormData();
                        formData.append('dataInicioBusca', dI.toISOString().split('T')[0]);
                        formData.append('dataFimBusca', dF.toISOString().split('T')[0]);
                        formData.append('idColaboradorBusca', idColab);

                        const resp = await fetch(URL_PONTO, { method: 'POST', body: formData });
                        const txt = await resp.text();
                        const doc = new DOMParser().parseFromString(txt, 'text/html');
                        
                        const trs = doc.querySelectorAll('#idTabelaPontos tbody tr');
                        trs.forEach(tr => {
                            const cells = tr.querySelectorAll('td');
                            if (cells.length < 3) return;
                            const dataRaw = cells[0].innerText.trim();
                            const inputs = Array.from(cells[1].querySelectorAll('input'));
                            const batidas = inputs.map(inp => inp.value).filter(v => v !== "");
                            const total = cells[2].innerText.match(/Horas Trabalhadas:\s*([\d:]+)/)?.[1] || "00:00";

                            let obs = "";
                            if (batidas.length % 2 !== 0) obs = "Batidas Ímpares";

                            if (batidas.length > 0 || total !== "00:00") {
                                dadosCSV.push(`${nomeColab};${dataRaw};${batidas[0]||""};${batidas[1]||""};${batidas[2]||""};${batidas[3]||""};${batidas[4]||""};${batidas[5]||""};${total};${obs}`);
                            }
                        });
                    } catch (e) {}
                }
            }

            if (dadosCSV.length > 0) {
                const csvContent = "Colaborador;Data;E1;S1;E2;S2;E3;S3;Total;Obs\n" + dadosCSV.join("\n");
                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a"); link.href = url; link.download = `Relatorio_Ponto.csv`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                msgLoading.innerHTML = "✅ Arquivo baixado!";
            } else {
                msgLoading.innerHTML = "⚠️ Nenhum dado encontrado.";
            }
            setTimeout(() => { viewLoading.style.display='none'; viewConfig.style.display='block'; btnAction.style.display='block'; }, 3000);
        }
    }

    // Auto-open se necessário
    if(document.getElementById("c04-ponto-painel")) document.getElementById("c04-ponto-painel").style.display='flex';
    else initPontoUI();
})();
