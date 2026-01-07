/**
 * CLUBE04 HUB - SUITE CENTRAL
 * Versão: 5.4.0
 * Atualização: Inclusão do módulo de Agenda Inteligente (v16)
 */
(function () {
    "use strict";

    // --- CONFIGURAÇÃO ---
    const BASE_URL = 'https://cdn.jsdelivr.net/gh/cauenvieira/clube04@main/';
    const LAYOUT_CONFIG = {
        mainColor: '#000000',
        accentColor: '#ff6600',
        textColor: '#ffffff',
        suiteName: 'SUITE • CB04 • MOGI •'
    };

    const tools = [
        { id: 'metas',    icon: '🚀', color: '#2563eb', tooltip: 'Metas',    script: 'c04-metas.js' },
        { id: 'ponto',    icon: '🕒', color: '#10b981', tooltip: 'Ponto',    script: 'c04-ponto.js' },
        // NOVO MÓDULO ADICIONADO AQUI:
        { id: 'agenda',   icon: '📅', color: '#f59e0b', tooltip: 'Agenda & Projeção', script: 'c04-agenda.js' },
        { id: 'ocupacao', icon: '📊', color: '#8b5cf6', tooltip: 'Ocupação', script: 'c04-ocupacao.js' }
    ];

    // --- LÓGICA DO SISTEMA ---

    // Fecha painéis abertos (IDs conhecidos das ferramentas)
    window.fecharPaineisSuite = function() {
        // IDs atualizados para incluir o novo painel da agenda
        const ids = ['c04-painel', 'dr-painel', 'painel-analise-agenda', 'c04-painel-agenda', 'analise-ocupacao-painel'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    };

    function loadModule(tool) {
        toggleMenu(false);
        window.fecharPaineisSuite(); 

        if (document.getElementById(`script-${tool.id}`)) {
            window.dispatchEvent(new Event(`c04_open_${tool.id}`));
            return;
        }

        const script = document.createElement('script');
        script.id = `script-${tool.id}`;
        script.src = `${BASE_URL}${tool.script}?t=${new Date().getTime()}`;
        script.onload = () => {
            window.dispatchEvent(new Event(`c04_open_${tool.id}`));
        };
        document.body.appendChild(script);
    }

    // --- INTERFACE (UI) ---
    function initMenu() {
        if (document.getElementById('c04-fab-container')) return;

        const style = document.createElement('style');
        style.innerHTML = `
            #c04-fab-container { position: fixed; bottom: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column-reverse; align-items: center; gap: 12px; }
            .c04-fab-sub { width: 48px; height: 48px; border-radius: 50%; border: none; color: white; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 22px; opacity: 0; transform: translateY(20px) scale(0.8); pointer-events: none; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; }
            .c04-fab-sub.visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
            .c04-fab-sub:hover { transform: scale(1.15); box-shadow: 0 6px 16px rgba(0,0,0,0.4); }
            .c04-fab-sub::after { content: attr(data-tooltip); position: absolute; right: 60px; background: #222; color: #fff; padding: 5px 10px; border-radius: 6px; font-size: 12px; font-family: sans-serif; white-space: nowrap; opacity: 0; transform: translateX(10px); transition: all 0.2s; pointer-events: none; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            .c04-fab-sub:hover::after { opacity: 1; transform: translateX(0); }
            .c04-fab-main { width: 70px; height: 70px; background: ${LAYOUT_CONFIG.mainColor}; border-radius: 50%; border: none; cursor: pointer; position: relative; box-shadow: 0 5px 20px rgba(0,0,0,0.4); transition: transform 0.3s; display: flex; align-items: center; justify-content: center; }
            .c04-fab-main:hover { transform: scale(1.05); }
            .c04-icon-center { font-size: 28px; z-index: 2; transition: transform 0.4s; }
            .c04-fab-main.active .c04-icon-center { transform: rotate(135deg); color: #ff4444; }
            .c04-text-ring { position: absolute; top: 0; left: 0; width: 100%; height: 100%; animation: c04-spin 10s linear infinite; pointer-events: none; opacity: 0.9; }
            .c04-fab-main:hover .c04-text-ring { animation-play-state: paused; opacity: 1; }
            @keyframes c04-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .c04-text-ring text { font-family: 'Courier New', monospace; font-weight: bold; font-size: 13.5px; fill: ${LAYOUT_CONFIG.accentColor}; letter-spacing: 2px; }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'c04-fab-container';

        tools.forEach((t) => {
            const btn = document.createElement('button');
            btn.className = `c04-fab-sub`;
            btn.style.background = t.color;
            btn.innerHTML = t.icon;
            btn.setAttribute('data-tooltip', t.tooltip);
            btn.onclick = () => loadModule(t);
            container.appendChild(btn);
        });

        const mainBtn = document.createElement('button');
        mainBtn.className = 'c04-fab-main';
        const svgContent = `
            <svg class="c04-text-ring" viewBox="0 0 100 100">
                <path id="c04-curve" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="transparent"/>
                <text width="500"><textPath xlink:href="#c04-curve">${LAYOUT_CONFIG.suiteName}</textPath></text>
            </svg>
            <div class="c04-icon-center">🧩</div>
        `;
        mainBtn.innerHTML = svgContent;
        mainBtn.onclick = () => toggleMenu();
        container.appendChild(mainBtn);
        document.body.appendChild(container);

        let isOpen = false;
        window.toggleMenu = function(forceState) {
            isOpen = forceState !== undefined ? forceState : !isOpen;
            mainBtn.classList.toggle('active', isOpen);
            const subBtns = container.querySelectorAll('.c04-fab-sub');
            subBtns.forEach((btn, index) => {
                if (isOpen) {
                    const delay = (subBtns.length - 1 - index) * 60;
                    setTimeout(() => btn.classList.add('visible'), delay);
                } else {
                    btn.classList.remove('visible');
                }
            });
        };
    }
    initMenu();
})();
