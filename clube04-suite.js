/**
 * CLUBE04 HUB - SUITE CENTRAL
 * Versão: 5.6.0
 * Atualizações: Modo silencioso no botão 'X' (sem popups), Drag & Drop e Smart Direction.
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
        { id: 'agenda',   icon: '📅', color: '#f59e0b', tooltip: 'Agenda',   script: 'c04-agenda.js' },
        { id: 'ocupacao', icon: '📊', color: '#8b5cf6', tooltip: 'Ocupação', script: 'c04-ocupacao.js' }
    ];

    // --- LÓGICA DO SISTEMA ---

    window.fecharPaineisSuite = function() {
        const ids = ['c04-painel', 'dr-painel', 'painel-analise-agenda', 'analise-ocupacao-painel'];
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

    // --- FUNÇÃO DE LIMPEZA SILENCIOSA ---
    function resetSuiteAndClear() {
        // 1. Limpa cache local imediatamente
        localStorage.clear();
        sessionStorage.clear();
        
        // 2. Remove cookies simples (tentativa genérica)
        document.cookie.split(";").forEach((c) => { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });

        // 3. Remove a Suite da tela sem avisos
        const container = document.getElementById('c04-fab-container');
        if (container) container.remove();
    }

    // --- INTERFACE (UI) ---

    function initMenu() {
        if (document.getElementById('c04-fab-container')) return;

        const style = document.createElement('style');
        style.innerHTML = `
            /* Container Fixo */
            #c04-fab-container { 
                position: fixed; 
                bottom: 20px; 
                right: 20px; 
                width: 70px; 
                height: 70px;
                z-index: 99999; 
                touch-action: none;
            }

            /* Lista de Botões (Container Absoluto) */
            #c04-fab-list {
                position: absolute;
                left: 0;
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                pointer-events: none;
            }

            /* Direção: PARA CIMA (Padrão) */
            #c04-fab-list.direction-up {
                bottom: 80px; 
                flex-direction: column-reverse; 
                justify-content: flex-end;
            }

            /* Direção: PARA BAIXO */
            #c04-fab-list.direction-down {
                top: 80px; 
                flex-direction: column;
                justify-content: flex-start;
            }

            /* Botões de Submenu */
            .c04-fab-sub { 
                width: 48px; height: 48px; border-radius: 50%; border: none; color: white; cursor: pointer; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; 
                font-size: 22px; opacity: 0; transform: scale(0.5); 
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                pointer-events: none;
                position: relative;
            }
            .c04-fab-sub.visible { opacity: 1; transform: scale(1); pointer-events: auto; }
            .c04-fab-sub:hover { transform: scale(1.15); }

            /* Tooltip */
            .c04-fab-sub::after { 
                content: attr(data-tooltip); position: absolute; right: 60px; 
                background: #222; color: #fff; padding: 5px 10px; border-radius: 6px; 
                font-size: 12px; white-space: nowrap; opacity: 0; transform: translateX(10px); 
                transition: opacity 0.2s, transform 0.2s; pointer-events: none;
            }
            .c04-fab-sub:hover::after { opacity: 1; transform: translateX(0); }

            /* Botão Principal */
            .c04-fab-main { 
                width: 70px; height: 70px; background: ${LAYOUT_CONFIG.mainColor}; 
                border-radius: 50%; border: none; cursor: move; 
                position: relative; z-index: 10;
                box-shadow: 0 5px 20px rgba(0,0,0,0.4); 
                display: flex; align-items: center; justify-content: center;
            }
            
            .c04-icon-center { font-size: 28px; z-index: 2; transition: transform 0.4s; pointer-events: none; }
            .c04-fab-main.active .c04-icon-center { transform: rotate(135deg); color: #ff4444; }

            /* Texto Circular */
            .c04-text-ring { 
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                animation: c04-spin 10s linear infinite; pointer-events: none; opacity: 0.9;
            }
            .c04-fab-main:hover .c04-text-ring { animation-play-state: paused; opacity: 1; }
            @keyframes c04-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            
            .c04-text-ring text { 
                font-family: 'Courier New', monospace; font-weight: bold; font-size: 13.5px; 
                fill: ${LAYOUT_CONFIG.accentColor}; letter-spacing: 2px;
            }

            /* Botão Reset X */
            .c04-reset-btn {
                position: absolute; top: 0; right: 0; width: 24px; height: 24px;
                background-color: #ff3333; color: white; border-radius: 50%; border: 2px solid #fff;
                font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center;
                cursor: pointer; z-index: 100; transform: translate(30%, -30%);
            }
            .c04-reset-btn:hover { transform: translate(30%, -30%) scale(1.1); background-color: #ff0000; }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'c04-fab-container';

        // 1. Botão Principal e Reset
        const mainBtn = document.createElement('button');
        mainBtn.className = 'c04-fab-main';
        mainBtn.innerHTML = `
            <div class="c04-reset-btn" title="Fechar Suite">×</div>
            <svg class="c04-text-ring" viewBox="0 0 100 100">
                <path id="c04-curve" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="transparent"/>
                <text width="500"><textPath xlink:href="#c04-curve">${LAYOUT_CONFIG.suiteName}</textPath></text>
            </svg>
            <div class="c04-icon-center">🧩</div>
        `;
        
        // Ação direta no clique do X
        mainBtn.querySelector('.c04-reset-btn').onclick = (e) => {
            e.stopPropagation(); // Impede o menu de abrir
            resetSuiteAndClear();
        };
        container.appendChild(mainBtn);

        // 2. Lista de Ferramentas
        const listContainer = document.createElement('div');
        listContainer.id = 'c04-fab-list';
        listContainer.className = 'direction-up';

        tools.forEach((t) => {
            const btn = document.createElement('button');
            btn.className = `c04-fab-sub`;
            btn.style.background = t.color;
            btn.innerHTML = t.icon;
            btn.setAttribute('data-tooltip', t.tooltip);
            btn.onclick = () => loadModule(t);
            listContainer.appendChild(btn);
        });
        container.appendChild(listContainer);

        document.body.appendChild(container);

        // --- LÓGICA DE DRAG ---
        let isDragging = false;
        let hasMoved = false;

        function makeDraggable(element) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            mainBtn.onmousedown = dragMouseDown;

            function dragMouseDown(e) {
                if(e.target.classList.contains('c04-reset-btn')) return;
                e = e || window.event;
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                hasMoved = false;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }

            function elementDrag(e) {
                e = e || window.event;
                e.preventDefault();
                hasMoved = true;
                isDragging = true;
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                
                element.style.top = (element.offsetTop - pos2) + "px";
                element.style.left = (element.offsetLeft - pos1) + "px";
                element.style.bottom = 'auto';
                element.style.right = 'auto';
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
                if (!hasMoved) toggleMenu();
                setTimeout(() => { isDragging = false; }, 100);
            }
        }
        makeDraggable(container);

        // --- LÓGICA DE TOGGLE INTELIGENTE ---
        let isOpen = false;
        
        window.toggleMenu = function(forceState) {
            if (isDragging) return;

            isOpen = forceState !== undefined ? forceState : !isOpen;
            mainBtn.classList.toggle('active', isOpen);
            
            const subBtns = listContainer.querySelectorAll('.c04-fab-sub');

            if (isOpen) {
                const rect = container.getBoundingClientRect();
                const screenHeight = window.innerHeight;
                
                if (rect.top < (screenHeight / 2)) {
                    listContainer.className = 'direction-down';
                } else {
                    listContainer.className = 'direction-up';
                }

                subBtns.forEach((btn, index) => {
                    const delay = index * 50;
                    setTimeout(() => btn.classList.add('visible'), delay);
                });
            } else {
                subBtns.forEach(btn => btn.classList.remove('visible'));
            }
        };
    }

    initMenu();
})();
