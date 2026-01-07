(function () {
    "use strict";

    window.addEventListener('c04_open_ocupacao', () => {
        const p = document.getElementById('analise-ocupacao-painel');
        if(p) p.style.display = 'flex';
        else initOcupacao();
    });

    function initOcupacao() {
        if(document.getElementById('analise-ocupacao-painel')) return;

        const URLS = {
            OCUPACAO: 'https://clube04.com.br/digital/Dashboard/DashboardN010.php',
            SERVICOS: 'https://clube04.com.br/digital/Dashboard/DashboardN008.php',
            FATURAMENTO: 'https://clube04.com.br/digital/Dashboard/DashboardN003.php'
        };

        const style = document.createElement('style');
        style.innerHTML = `
            #analise-ocupacao-painel { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 850px; max-width: 95vw; max-height: 90vh; background: #fff; border-radius: 8px; box-shadow: 0 8px 25px rgba(0,0,0,0.3); z-index: 10000; flex-direction: column; font-family: sans-serif; }
            #analise-ocupacao-painel .painel-header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 15px 25px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
            #analise-ocupacao-painel .painel-body { padding: 25px; overflow-y: auto; }
            .controles { display: flex; gap: 15px; align-items: flex-end; margin-bottom: 20px; }
            .controles button { background: #8b5cf6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
            .resumo-tabela { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            .resumo-tabela th, .resumo-tabela td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        `;
        document.head.appendChild(style);

        const d = new Date(); d.setMonth(d.getMonth()-1);
        const ini = d.toISOString().split('T')[0];
        
        const html = `
            <div id="analise-ocupacao-painel">
                <div class="painel-header"><h2>Análise de Ocupação</h2><span style="cursor:pointer;font-size:24px;" id="fechar-ocupacao">&times;</span></div>
                <div class="painel-body">
                    <div class="controles">
                        <div><label>Início</label><br><input type="date" id="ocup-ini" value="${ini}"></div>
                        <div><label>Fim</label><br><input type="date" id="ocup-fim" value="${new Date().toISOString().split('T')[0]}"></div>
                        <button id="btn-ocup-analisar">Analisar</button>
                    </div>
                    <div id="ocup-resultado"></div>
                </div>
            </div>
        `;
        const div = document.createElement('div'); div.innerHTML = html; document.body.appendChild(div);

        document.getElementById('fechar-ocupacao').onclick = () => document.getElementById('analise-ocupacao-painel').style.display='none';
        
        document.getElementById('btn-ocup-analisar').onclick = async () => {
            const res = document.getElementById('ocup-resultado');
            res.innerHTML = "Analisando dados (extração diária)... Aguarde.";
            
            // AQUI ENTRA A LÓGICA DE LOOP DO SEU SCRIPT ANALISEOCUPACAO.JS
            // Copie a lógica de loop (fetch URL_DASHBOARD...) e renderização de tabela
            // e cole aqui.
            alert("Copiar lógica do analiseocupacao.js para dentro do evento de clique.");
        };

        document.getElementById('analise-ocupacao-painel').style.display = 'flex';
    }

    if(!document.getElementById('analise-ocupacao-painel')) initOcupacao();
})();
