/**
 * CLUBE04 SUITE - HUB CENTRAL
 * Versão: 5.3.0
 * Gerencia o menu flutuante e carrega os módulos.
 */
(function () {
    "use strict";

    // URL base para os módulos (Ajuste para seu repo)
    const BASE_URL = 'https://cdn.jsdelivr.net/gh/cauenvieira/clube04@main/';

    const tools = [
        { id: 'metas',    icon: '🚀', color: '#2563eb', tooltip: 'Dashboard de Metas', script: 'c04-metas.js' },
        { id: 'ponto',    icon: '🕒', color: '#10b981', tooltip: 'Relatório de Ponto', script: 'c04-ponto.js' },
        { id: 'agenda',   icon: '📅', color: '#f59e0b', tooltip: 'Projeção Agenda',    script: 'c04-agenda.js' },
        { id: 'ocupacao', icon: '📊', color: '#8b5cf6', tooltip: 'Análise Ocupação',   script: 'c04-ocupacao.js' }
    ];

    // Evento global para fechar todos os painéis antes de abrir um novo
    window.fecharPaineisSuite = function() {
        const ids = ['c04-painel', 'dr-painel', 'painel-analise-agenda', 'analise-ocupacao-painel'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    };

    function loadModule(tool) {
        window.fecharPaineisSuite(); // Garante que nenhum outro esteja sobreposto

        // Se já carregou o script, apenas dispara o evento de abertura
        if (document.getElementById(`script-${tool.id}`)) {
            window.dispatchEvent(new Event(`c04_open_${tool.id}`));
            return;
        }

        // Carrega o script sob demanda
        const script = document.createElement('script');
        script.id = `script-${tool.id}`;
        script.src = `${BASE_URL}${tool.script}?t=${new Date().getTime()}`;
        script.onload = () => {
            window.dispatchEvent(new Event(`c04_open_${tool.id}`));
        };
        document.body.appendChild(script);
    }

    function initMenu() {
        if (document.getElementById('c04-fab-container')) return;

        const style = document.createElement('style');
        style.innerHTML = `
            #c04-fab-container { position: fixed; bottom: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column-reverse; align-items: center; gap: 10px; }
            .c04-fab-btn { width: 45px; height: 45px; border-radius: 50%; border: none; color: white; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: all 0.2s; display: flex; align-items: center; justify-content: center; font-size: 20px; opacity: 0; transform: translateY(20px) scale(0.8); pointer-events: none; position: relative; }
            .c04-fab-btn.visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
            .c04-fab-btn:hover { transform: scale(1.1); }
            
            /* Botão Principal */
            .c04-fab-main { width: 65px; height: 65px; background: #000; border: 2px solid #ff6600; opacity: 1; transform: translateY(0); pointer-events: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; z-index: 100000; }
            .c04-fab-main span { color: #ff6600; font-family: sans-serif; font-weight: 800; font-size: 9px; line-height: 1.1; text-transform: uppercase; margin-top: 2px; }
            .c04-fab-main i { color: #fff; font-style: normal; font-size: 24px; line-height: 1; margin-bottom: 2px; transition: transform 0.3s; }
            .c04-fab-main:hover { background: #111; border-color: #ff8533; }
            .c04-fab-main.active i { transform: rotate(45deg); color: #ff4444; }

            /* Tooltips */
            .c04-fab-btn::before { content: attr(data-tooltip); position: absolute; right: 60px; background: rgba(0,0,0,0.8); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
            .c04-fab-btn:hover::before { opacity: 1; }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'c04-fab-container';

        // Botões das Ferramentas
        tools.forEach((t) => {
            const btn = document.createElement('button');
            btn.className = `c04-fab-btn`;
            btn.style.background = t.color;
            btn.innerHTML = t.icon;
            btn.setAttribute('data-tooltip', t.tooltip);
            btn.onclick = () => {
                toggleMenu(false); // Fecha o menu ao selecionar
                loadModule(t);
            };
            container.appendChild(btn);
        });

        // Botão Principal
        const mainBtn = document.createElement('button');
        mainBtn.className = 'c04-fab-btn c04-fab-main';
        mainBtn.innerHTML = `<i>+</i><span>Suite<br>CB04<br>Mogi</span>`;
        mainBtn.onclick = () => toggleMenu();
        container.appendChild(mainBtn);

        document.body.appendChild(container);

        let isOpen = false;
        function toggleMenu(forceState) {
            isOpen = forceState !== undefined ? forceState : !isOpen;
            mainBtn.classList.toggle('active', isOpen);
            
            const subBtns = container.querySelectorAll('.c04-fab-btn:not(.c04-fab-main)');
            subBtns.forEach((btn, index) => {
                if (isOpen) {
                    setTimeout(() => btn.classList.add('visible'), index * 50);
                } else {
                    btn.classList.remove('visible');
                }
            });
        }
    }

    initMenu();
})();
