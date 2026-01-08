/**
 * CLUBE04 HUB - SUITE CENTRAL
 * Versão: 8.0.0 (Architecture: Full Teardown)
 */
(function () {
    "use strict";

    const ENV_CONFIG = {
        LOCAL_ROOT: 'http://127.0.0.1:8080/',
        PROD_ROOT:  'https://cdn.jsdelivr.net/gh/cauenvieira/clube04@main/',
        TIMEOUT_MS: 100
    };

    const LAYOUT_CONFIG = { mainColor: '#000000', accentColor: '#ff6600', suiteName: 'SUITE • CB04 • MOGI •' };

    const tools = [
        { id: 'metas',    icon: '🚀', color: '#2563eb', tooltip: 'Metas',    script: 'c04-metas.js' },
        { id: 'ponto',    icon: '🕒', color: '#10b981', tooltip: 'Ponto',    script: 'c04-ponto.js' },
        // { id: 'agenda',   icon: '📅', color: '#f59e0b', tooltip: 'Agenda',   script: 'c04-agenda.js' },
        // { id: 'ocupacao', icon: '📊', color: '#8b5cf6', tooltip: 'Ocupação', script: 'c04-ocupacao.js' },
        // { id: 'monitor',  icon: '👁️', color: '#dc2626', tooltip: 'Monitor 360º', script: 'c04-monitor.js' }
    ];

    let ACTIVE_BASE_URL = null;

    async function initEnvironment() {
        if (ACTIVE_BASE_URL) return ACTIVE_BASE_URL;
        const checkLocal = new Promise((resolve, reject) => {
            fetch(ENV_CONFIG.LOCAL_ROOT + 'clube04-suite.js', { method: 'HEAD', mode: 'no-cors' })
                .then(() => resolve(true)).catch(() => reject());
        });
        const timeout = new Promise((_, reject) => setTimeout(() => reject('timeout'), ENV_CONFIG.TIMEOUT_MS));
        try {
            await Promise.race([checkLocal, timeout]);
            console.log("⚡ [SUITE] Modo LOCAL.");
            ACTIVE_BASE_URL = ENV_CONFIG.LOCAL_ROOT;
        } catch (e) {
            console.log("☁️ [SUITE] Modo PROD.");
            ACTIVE_BASE_URL = ENV_CONFIG.PROD_ROOT;
        }
        return ACTIVE_BASE_URL;
    }

    // --- LIMPEZA PROFUNDA ---
    window.killAllModules = function() {
        // 1. Emite ordem de destruição para os scripts (para removerem listeners de document)
        window.dispatchEvent(new Event('c04_global_teardown'));
        
        // 2. Remove fisicamente os elementos do DOM
        const ids = ['c04-painel', 'c04-monitor-painel', 'c04-ponto-painel', 'c04-painel-agenda', 'c04-painel-ocup'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove(); // Deleta o elemento, não apenas esconde
        });
        
        // 3. Reset de cursor caso algo tenha travado
        document.body.style.cursor = 'default';
    };

    async function loadModule(tool) {
        // 1. Limpa tudo o que existia antes (ZERA O AMBIENTE)
        window.killAllModules();
        toggleMenu(false);

        if (!ACTIVE_BASE_URL) await initEnvironment();

        // 2. Se o script já foi injetado antes, apenas dispara o evento de abertura
        // (O módulo deve ser inteligente para recriar a janela ao receber esse evento)
        if (document.getElementById(`script-${tool.id}`)) {
            window.dispatchEvent(new Event(`c04_open_${tool.id}`));
            return;
        }

        // 3. Carrega script pela primeira vez
        const script = document.createElement('script');
        script.id = `script-${tool.id}`;
        script.src = `${ACTIVE_BASE_URL}${tool.script}?t=${new Date().getTime()}`;
        script.onload = () => { window.dispatchEvent(new Event(`c04_open_${tool.id}`)); };
        script.onerror = () => {
            console.error(`Erro modulo: ${tool.id}`);
            if (ACTIVE_BASE_URL === ENV_CONFIG.LOCAL_ROOT) {
                ACTIVE_BASE_URL = ENV_CONFIG.PROD_ROOT;
                loadModule(tool);
            }
        };
        document.body.appendChild(script);
    }

    function resetSuiteAndClear() {
        window.killAllModules(); // Mata tudo
        localStorage.clear(); sessionStorage.clear();
        document.cookie.split(";").forEach((c) => { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        const container = document.getElementById('c04-fab-container');
        if (container) container.remove();
        console.log("🧹 [SUITE] Limpeza completa.");
    }

    // --- UI MENU ---
    function initMenu() {
        if (document.getElementById('c04-fab-container')) return;
        initEnvironment();

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
            .c04-badge { position: absolute; top: 0; left: 0; background-color: #ff0000; color: white; border-radius: 50%; width: 22px; height: 22px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white; z-index: 101; transform: translate(-20%, -20%); box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'c04-fab-container';
        const mainBtn = document.createElement('button');
        mainBtn.className = 'c04-fab-main';
        mainBtn.innerHTML = `<div class="c04-reset-btn" title="Encerrar">×</div><div id="c04-main-badge" class="c04-badge">0</div><svg class="c04-text-ring" viewBox="0 0 100 100"><path id="c04-curve" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="transparent"/><text width="500"><textPath xlink:href="#c04-curve">${LAYOUT_CONFIG.suiteName}</textPath></text></svg><div class="c04-icon-center">🧩</div>`;
        
        mainBtn.querySelector('.c04-reset-btn').onclick = (e) => { e.stopPropagation(); resetSuiteAndClear(); };
        container.appendChild(mainBtn);

        const listContainer = document.createElement('div');
        listContainer.id = 'c04-fab-list';
        listContainer.className = 'direction-up';
        tools.forEach((t) => {
            const btn = document.createElement('button'); btn.className = `c04-fab-sub`; btn.style.background = t.color; btn.innerHTML = t.icon; btn.setAttribute('data-tooltip', t.tooltip); btn.onclick = () => loadModule(t); listContainer.appendChild(btn);
        });
        container.appendChild(listContainer);
        document.body.appendChild(container);

        window.c04UpdateBadge = function(count) {
            const b = document.getElementById('c04-main-badge'); if(b) { b.innerText = count > 9 ? '9+' : count; b.style.display = count > 0 ? 'flex' : 'none'; }
        };

        // DRAG LOGIC
        let isDragging = false;
        function makeDraggable(element) {
            mainBtn.addEventListener('mousedown', (e) => {
                if(e.target.classList.contains('c04-reset-btn') || e.button !== 0) return;
                e.preventDefault();
                let startX = e.clientX, startY = e.clientY, initialLeft = element.offsetLeft, initialTop = element.offsetTop, hasMoved = false;
                const onMove = (evt) => {
                    const dx = evt.clientX - startX, dy = evt.clientY - startY;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { hasMoved = true; isDragging = true; }
                    element.style.left = (initialLeft + dx) + "px"; element.style.top = (initialTop + dy) + "px";
                    element.style.bottom = 'auto'; element.style.right = 'auto';
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
                    if (!hasMoved) toggleMenu();
                    setTimeout(() => { isDragging = false; }, 50);
                };
                document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
            });
        }
        makeDraggable(container);

        let isOpen = false;
        window.toggleMenu = function(forceState) {
            if (isDragging) return;
            const newState = forceState !== undefined ? forceState : !isOpen;
            // Se fechou via clique, mata os módulos
            if (isOpen && !newState && forceState === undefined) window.killAllModules();
            isOpen = newState;
            mainBtn.classList.toggle('active', isOpen);
            const subBtns = listContainer.querySelectorAll('.c04-fab-sub');
            if (isOpen) {
                const rect = container.getBoundingClientRect(); listContainer.className = (rect.top < (window.innerHeight / 2)) ? 'direction-down' : 'direction-up';
                subBtns.forEach((btn, index) => { setTimeout(() => btn.classList.add('visible'), index * 50); });
            } else {
                subBtns.forEach(btn => btn.classList.remove('visible'));
            }
        };
    }
    initMenu();
})();
