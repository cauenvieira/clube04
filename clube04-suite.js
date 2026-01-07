/**
 * CLUBE04 SUITE - HUB CENTRAL
 * Versão: 5.1.0
 * Descrição: Gerencia o menu flutuante e carrega os módulos sob demanda.
 */

(function () {
    "use strict";

    // CONFIGURAÇÃO DOS MÓDULOS (URLs do GitHub)
    // DICA: Use cdn.jsdelivr.net para servir os arquivos com a tipagem correta
    const BASE_URL = 'https://cdn.jsdelivr.net/gh/cauenvieira/clube04@main/';
    
    const tools = [
        { 
            id: 'ocupacao', 
            icon: '📊', 
            class: 'btn-ocupacao', 
            tooltip: 'Análise de Ocupação', 
            script: 'c04-ocupacao.js' 
        },
        { 
            id: 'agenda', 
            icon: '📅', 
            class: 'btn-agenda', 
            tooltip: 'Projeção de Agenda', 
            script: 'c04-agenda.js' 
        },
        { 
            id: 'ponto', 
            icon: '🕒', 
            class: 'btn-ponto', 
            tooltip: 'Relatório de Ponto', 
            script: 'c04-ponto.js' 
        },
        { 
            id: 'metas', 
            icon: '🚀', 
            class: 'btn-metas', 
            tooltip: 'Dashboard Metas', 
            script: 'c04-metas.js' 
        }
    ];

    // =========================================================================
    // CARREGADOR DE SCRIPTS
    // =========================================================================
    function loadModule(tool) {
        // Se já foi carregado, não carrega de novo, apenas notifica ou executa função de toggle se existir
        if (document.getElementById(`script-${tool.id}`)) {
            console.log(`Módulo ${tool.tooltip} já está carregado.`);
            // Tenta reabrir se tiver função global padrão
            const eventName = `c04_open_${tool.id}`;
            window.dispatchEvent(new Event(eventName));
            return;
        }

        const script = document.createElement('script');
        script.id = `script-${tool.id}`;
        script.src = `${BASE_URL}${tool.script}?t=${new Date().getTime()}`; // Cache bust
        script.type = 'text/javascript';
        script.onload = () => {
            console.log(`✅ Módulo ${tool.tooltip} carregado.`);
            // Dispara evento para abrir imediatamente após carregar
            window.dispatchEvent(new Event(`c04_open_${tool.id}`));
        };
        script.onerror = () => alert(`Erro ao carregar o módulo: ${tool.tooltip}`);
        document.body.appendChild(script);
    }

    // =========================================================================
    // INTERFACE (MENU FLUTUANTE)
    // =========================================================================
    function initMenu() {
        if (document.getElementById('c04-fab-container')) return;

        const style = document.createElement('style');
        style.innerHTML = `
            #c04-fab-container { position: fixed; bottom: 25px; right: 25px; z-index: 99999; display: flex; flex-direction: column-reverse; align-items: center; gap: 12px; }
            .c04-fab-btn { width: 48px; height: 48px; border-radius: 50%; border: none; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: flex; align-items: center; justify-content: center; font-size: 20px; opacity: 0; transform: translateY(20px) scale(0.8); pointer-events: none; position: relative; }
            .c04-fab-btn.visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
            .c04-fab-main { width: 60px; height: 60px; background: #0f172a; font-size: 28px; opacity: 1; transform: translateY(0); pointer-events: auto; z-index: 100000; }
            .c04-fab-main:hover { transform: scale(1.05); }
            .c04-fab-main.active { transform: rotate(45deg); background: #ef4444; }
            .c04-fab-btn::before { content: attr(data-tooltip); position: absolute; right: 60px; background: rgba(15, 23, 42, 0.9); color: white; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-family: sans-serif; white-space: nowrap; opacity: 0; transition: opacity 0.2s; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
            .c04-fab-btn:hover::before { opacity: 1; }
            .btn-metas { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
            .btn-ponto { background: linear-gradient(135deg, #10b981, #059669); }
            .btn-agenda { background: linear-gradient(135deg, #f59e0b, #d97706); }
            .btn-ocupacao { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'c04-fab-container';
        
        tools.forEach((t, index) => {
            const btn = document.createElement('button');
            btn.className = `c04-fab-btn ${t.class}`;
            btn.innerHTML = t.icon;
            btn.setAttribute('data-tooltip', t.tooltip);
            btn.onclick = (e) => {
                e.stopPropagation();
                loadModule(t);
                toggleMenu(false);
            };
            container.appendChild(btn);
        });

        const mainBtn = document.createElement('button');
        mainBtn.className = 'c04-fab-btn c04-fab-main';
        mainBtn.innerHTML = '+';
        mainBtn.onclick = () => toggleMenu();
        container.appendChild(mainBtn);

        document.body.appendChild(container);

        let isOpen = false;
        function toggleMenu(forceState) {
            isOpen = forceState !== undefined ? forceState : !isOpen;
            mainBtn.classList.toggle('active', isOpen);
            const subBtns = document.querySelectorAll('.c04-fab-btn:not(.c04-fab-main)');
            subBtns.forEach((btn, index) => {
                if (isOpen) {
                    setTimeout(() => btn.classList.add('visible'), index * 60);
                } else {
                    btn.classList.remove('visible');
                }
            });
        }
    }

    initMenu();
    console.log("Clube04 Suite Hub Loaded");
})();
