/**
 * CLUBE04 HUB - SUITE CENTRAL
 * Versão: 5.10.0 (Hybrid Module Loader)
 */
(function () {
    "use strict";

    // --- CONFIGURAÇÃO DE AMBIENTE ---
    // O sistema tentará carregar do LOCAL. Se falhar, busca do PROD.
    const ENV_URLS = {
        LOCAL: 'http://127.0.0.1:8080/',
        PROD:  'https://cdn.jsdelivr.net/gh/cauenvieira/clube04@main/'
    };

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
        { id: 'ocupacao', icon: '📊', color: '#8b5cf6', tooltip: 'Ocupação', script: 'c04-ocupacao.js' },
        { id: 'monitor',  icon: '👁️', color: '#dc2626', tooltip: 'Monitor 360º', script: 'c04-monitor.js' }
    ];

    // --- LÓGICA DO SISTEMA ---

    // Função global para fechar qualquer painel aberto
    window.fecharPaineisSuite = function() {
        const ids = [
            'c04-painel',           // Metas
            'c04-monitor-painel',   // Monitor
            'c04-ponto-painel',     // Ponto
            'c04-painel-agenda',    // Agenda
            'c04-painel-ocup'       // Ocupação
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    };

    function loadModule(tool) {
        // 1. Fecha o menu e outros painéis
        toggleMenu(false); 
        window.fecharPaineisSuite(); 

        // 2. Se o script já existe na página, apenas dispara o evento de abertura
        if (document.getElementById(`script-${tool.id}`)) {
            window.dispatchEvent(new Event(`c04_open_${tool.id}`));
            return;
        }

        // 3. Função auxiliar para injetar o script com Fallback (Híbrido)
        const injectScript = (baseUrl, isRetry = false) => {
            const script = document.createElement('script');
            script.id = `script-${tool.id}`;
            // Adiciona timestamp para evitar cache agressivo
            script.src = `${baseUrl}${tool.script}?t=${new Date().getTime()}`;

            script.onload = () => {
                console.log(`✅ [SUITE] Módulo '${tool.id}' carregado via ${isRetry ? 'PROD (GitHub)' : 'LOCAL'}.`);
                window.dispatchEvent(new Event(`c04_open_${tool.id}`));
            };

            script.onerror = () => {
                // Remove o script falho do DOM
                script.remove();
                
                if (!isRetry) {
                    console.warn(`⚠️ [SUITE] Falha ao carregar '${tool.id}' localmente. Tentando GitHub...`);
                    // Tenta novamente usando a URL de Produção
                    injectScript(ENV_URLS.PROD, true);
                } else {
                    console.error(`❌ [SUITE] Erro Crítico: Não foi possível carregar o módulo '${tool.id}'.`);
                    alert(`Não foi possível carregar a ferramenta ${tool.tooltip}. Verifique sua conexão.`);
                }
            };

            document.body.appendChild(script);
        };

        // Inicia tentando carregar do Local
        injectScript(ENV_URLS.LOCAL);
    }

    function resetSuiteAndClear() {
        if(confirm("Deseja fechar a Suite e limpar o cache do navegador para este site?")) {
            localStorage.clear();
            sessionStorage.clear();
            document.cookie.split(";").forEach((c) => { 
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
            const container = document.getElementById('c04-fab-container');
            if (container) container.remove();
        }
    }

    // --- INTERFACE (UI) ---

    function initMenu() {
        if (document.getElementById('c04-fab-container')) return;

        const style = document.createElement('style');
        style.innerHTML = `
            #c04-fab-container { position: fixed; bottom: 20px; right: 20px; width: 70px; height: 70px; z-index: 99999; touch-action: none; }
            #c04-fab-list { position: absolute; left: 0; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; pointer-events: none; }
            #c04-fab-list.direction-up { bottom: 80px; flex-direction: column-reverse; justify-content: flex-end; }
            #c04-fab-list.direction-down { top: 80px; flex-direction: column; justify-content: flex-start; }
            .c04-fab-sub { width: 48px; height: 48px; border-radius: 50%; border: none; color: white; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 22px; opacity: 0; transform: scale(0.5); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; position: relative; }
            .c04-fab-sub.visible { opacity: 1; transform: scale(1); pointer-events: auto; }
            .c04-fab-sub:hover { transform: scale(1.15); }
            .c04-fab-sub::after { content: attr(data-tooltip); position: absolute; right: 60px; background: #222; color: #fff; padding: 5px 10px; border-radius: 6px; font-size: 12px; white-space: nowrap; opacity: 0; transform: translateX(10px); transition: opacity 0.2s, transform 0.2s; pointer-events: none; }
            .c04-fab-sub:hover::after { opacity: 1; transform: translateX(0); }
            
            .c04-fab-main { width: 70px; height: 70px; background: ${LAYOUT_CONFIG.mainColor}; border-radius: 50%; border: none; cursor: move; position: relative; z-index: 10; box-shadow: 0 5px 20px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
            .c04-icon-center { font-size: 28px; z-index: 2; transition: transform 0.4s; pointer-events: none; }
            .c04-fab-main.active .c04-icon-center { transform: rotate(135deg); color: #ff4444; }
            .c04-text-ring { position: absolute; top: 0; left: 0; width: 100%; height: 100%; animation: c04-spin 10s linear infinite; pointer-events: none; opacity: 0.9; }
            .c04-fab-main:hover .c04-text-ring { animation-play-state: paused; opacity: 1; }
            @keyframes c04-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .c04-text-ring text { font-family: 'Courier New', monospace; font-weight: bold; font-size: 13.5px; fill: ${LAYOUT_CONFIG.accentColor}; letter-spacing: 2px; }
            .c04-reset-btn { position: absolute; top: 0; right: 0; width: 24px; height: 24px; background-color: #ff3333; color: white; border-radius: 50%; border: 2px solid #fff; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 100; transform: translate(30%, -30%); }
            .c04-reset-btn:hover { transform: translate(30%, -30%) scale(1.1); background-color: #ff0000; }

            .c04-badge {
                position: absolute; top: 0; left: 0; 
                background-color: #ff0000; color: white;
                border-radius: 50%; width: 22px; height: 22px;
                display: none; align-items: center; justify-content: center;
                font-size: 11px; font-weight: bold; border: 2px solid white;
                z-index: 101; transform: translate(-20%, -20%);
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'c04-fab-container';

        // Botão Principal com Badge
        const mainBtn = document.createElement('button');
        mainBtn.className = 'c04-fab-main';
        mainBtn.innerHTML = `
            <div class="c04-reset-btn" title="Encerrar Suite">×</div>
            <div id="c04-main-badge" class="c04-badge">0</div> 
            <svg class="c04-text-ring" viewBox="0 0 100 100">
                <path id="c04-curve" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="transparent"/>
                <text width="500"><textPath xlink:href="#c04-curve">${LAYOUT_CONFIG.suiteName}</textPath></text>
            </svg>
            <div class="c04-icon-center">🧩</div>
        `;
        
        mainBtn.querySelector('.c04-reset-btn').onclick = (e) => {
            e.stopPropagation();
            resetSuiteAndClear();
        };
        container.appendChild(mainBtn);

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

        // --- EXPOR FUNÇÃO DE BADGE ---
        window.c04UpdateBadge = function(count) {
            const b = document.getElementById('c04-main-badge');
            if(b) {
                b.innerText = count > 9 ? '9+' : count;
                b.style.display = count > 0 ? 'flex' : 'none';
            }
        };

        // --- LÓGICA DE DRAG & TOGGLE ---
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
                element.style.bottom = 'auto'; element.style.right = 'auto';
            }

            function closeDragElement() {
                document.onmouseup = null; document.onmousemove = null;
                if (!hasMoved) toggleMenu();
                setTimeout(() => { isDragging = false; }, 100);
            }
        }
        makeDraggable(container);

        let isOpen = false;
        window.toggleMenu = function(forceState) {
            if (isDragging) return;
            
            const newState = forceState !== undefined ? forceState : !isOpen;

            // Se for fechar o menu e não foi um drag, fecha também os painéis
            if (isOpen && !newState && forceState === undefined) {
                 window.fecharPaineisSuite();
            }

            isOpen = newState;
            mainBtn.classList.toggle('active', isOpen);
            const subBtns = listContainer.querySelectorAll('.c04-fab-sub');
            
            if (isOpen) {
                const rect = container.getBoundingClientRect();
                if (rect.top < (window.innerHeight / 2)) listContainer.className = 'direction-down';
                else listContainer.className = 'direction-up';
                subBtns.forEach((btn, index) => { setTimeout(() => btn.classList.add('visible'), index * 50); });
            } else {
                subBtns.forEach(btn => btn.classList.remove('visible'));
            }
        };
    }

    initMenu();
})();
