/**
 * CLUBE04 - MÓDULO PONTO (Suite Central)
 * Versão: 10.0.0 (Drag Fix + Total Reset + Stable)
 */
(function () {
    "use strict";

    // --- CONFIGURAÇÕES ---
    const CONFIG = {
        domain: 'clube04.com.br',
        urlAlvo: 'https://clube04.com.br/digital/gerenciarponto.php',
        urlInserir: './GerenciarPonto/GerenciarPontoI001.php',
        urlExcluir: './GerenciarPonto/GerenciarPontoE001.php',
        targetRequest: 'GerenciarPontoN002.php',
        urlJSZip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    };

    // --- ESTADO ---
    const State = {
        iframe: null,
        processando: false,
        dadosCache: [],
        editandoAgora: null,
        currentIndex: -1
    };

    // --- UTILS ---
    const Utils = {
        toast: (msg, tipo = 'info') => {
            const t = document.getElementById('c04-toast');
            if (t) {
                t.innerText = msg;
                t.style.background = tipo === 'error' ? '#ef4444' : (tipo === 'success' ? '#10b981' : '#334155');
                t.classList.add('show');
                setTimeout(() => t.classList.remove('show'), 2000);
            }
        },
        createIframe: (url) => {
            return new Promise((resolve) => {
                const ifr = document.createElement('iframe');
                // Estilos para evitar erros de renderização visual no sistema legado
                ifr.style.width = '1024px'; ifr.style.height = '768px';
                ifr.style.position = 'fixed'; ifr.style.top = '-9999px'; ifr.style.left = '-9999px';
                ifr.style.visibility = 'visible';
                ifr.src = url;
                ifr.onload = () => resolve(ifr);
                document.body.appendChild(ifr);
            });
        },
        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
        waitForSpecificUrl: (win, partialUrl) => {
            return new Promise((resolve) => {
                if (!win.$) { setTimeout(resolve, 1500); return; }
                let resolved = false;
                const timeout = setTimeout(() => { if(!resolved) { resolved=true; resolve(); } }, 15000);
                const handler = (event, xhr, settings) => {
                    if (settings && settings.url && settings.url.includes(partialUrl)) {
                        clearTimeout(timeout);
                        win.$(win.document).off("ajaxComplete", handler);
                        resolved = true;
                        setTimeout(resolve, 300);
                    }
                };
                win.$(win.document).on("ajaxComplete", handler);
            });
        },
        timeToMin: (t) => { if (!t || !t.includes(':')) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; },
        getDataInfo: (str) => {
            if (!str) return { data: "-", dia: "-", iso: "" };
            const cleanStr = str.replace(/(\r\n|\n|\r)/gm, "").trim();
            const match = cleanStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (!match) return { data: cleanStr, dia: "-", iso: "" };
            const [_, d, m, y] = match;
            const dateObj = new Date(`${y}-${m}-${d}T12:00:00`);
            const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            return { data: `${d}/${m}/${y}`, dia: dias[dateObj.getDay()], iso: `${y}-${m}-${d}`, obj: dateObj };
        },
        copyText: (text) => { navigator.clipboard.writeText(text).then(() => Utils.toast("Copiado!", "success")); }
    };

    // --- CSS ---
    const STYLES_CSS = `
        #c04-ponto-painel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 500px; max-height: 90vh; background: #fff; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); z-index: 999999; display: flex; flex-direction: column; font-family: 'Segoe UI', sans-serif; border: 1px solid #ccc; overflow: hidden; transition: width 0.3s ease; }
        #c04-ponto-painel.expanded { width: 1000px; max-width: 95vw; }
        #c04-header { background: #064e3b; color: #fff; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; cursor: grab; }
        #c04-header:active { cursor: grabbing; }
        #c04-header h3 { margin: 0; font-size: 15px; font-weight: 600; text-transform: uppercase; }
        #c04-close { cursor: pointer; font-size: 20px; font-weight: bold; opacity: 0.8; }
        #c04-body { padding: 15px; overflow-y: auto; background: #f8f9fa; display: flex; flex-direction: column; gap: 15px; position: relative; }
        .c04-row { display: flex; gap: 10px; } .c04-col { flex: 1; }
        .c04-label { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; margin-bottom: 5px; display: block; }
        .c04-input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 13px; }
        .c04-list-container { border: 1px solid #ddd; background: #fff; border-radius: 4px; overflow: hidden; }
        .c04-search-box { padding: 8px; border-bottom: 1px solid #eee; background: #f1f1f1; display:flex; align-items:center; gap:10px; }
        .c04-search-input { width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; flex:1; }
        .c04-scroll-area { max-height: 120px; overflow-y: auto; padding: 5px; outline: none; }
        .c04-check-item { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 6px; cursor: pointer; border: 1px solid transparent; }
        .c04-check-item:hover { background: #e9ecef; }
        .c04-check-item:focus { background: #e0f2fe; border-color: #3b82f6; outline: none; }
        .c04-btn { padding: 10px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 13px; color: white; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; }
        .c04-btn-primary { background: #10b981; } .c04-btn-primary:hover { background: #059669; }
        .c04-btn-success { background: #2563eb; display: none; }
        .c04-btn-danger { background: #ef4444; color:white; width: auto; font-size: 10px; padding: 2px 8px; height: 24px; margin-top:2px; }
        .c04-btn-edit { background: #f39c12; width: 24px; height: 24px; padding: 0; border-radius: 4px; font-size: 14px; }
        .c04-btn-del-mini { background: #e74c3c; width: 24px; height: 24px; padding: 0; border-radius: 4px; font-size: 14px; color:white; border:none; cursor:pointer; }
        .c04-btn-copy-mini { background: #f59e0b; border:none; border-radius:3px; cursor:pointer; font-size:10px; padding: 4px 10px; color:white; display:block; margin: 0 auto; }
        #c04-results-wrapper { display: none; margin-top: 15px; border-top: 2px solid #ddd; padding-top: 15px; }
        .c04-card-res { background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; margin-bottom: 15px; }
        .c04-res-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; border-bottom: 1px solid #f0f0f0; padding-bottom: 5px; }
        .c04-table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; }
        .c04-table th { background: #f8f9fa; padding: 6px; border: 1px solid #eee; color: #666; white-space: nowrap; vertical-align: middle; }
        .c04-table td { padding: 5px; border: 1px solid #eee; color: #333; }
        .c04-error-row { background: #fff5f5; }
        .c04-time-entry { color: #16a34a; font-weight: bold; }
        .c04-time-exit { color: #dc2626; font-weight: bold; }
        .c04-tag { background: #e74c3c; color: white; padding: 1px 4px; border-radius: 3px; font-size: 9px; margin: 1px; display:inline-block;}
        #c04-editor-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.95); z-index: 100; display: none; flex-direction: column; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; backdrop-filter: blur(2px); }
        .c04-editor-box { width: 100%; max-width: 420px; background: #fff; border: 1px solid #ccc; box-shadow: 0 10px 30px rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh; }
        .c04-editor-header { background: #f39c12; color: white; padding: 10px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
        .c04-editor-nav { display: flex; gap: 5px; }
        .c04-nav-btn { background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
        .c04-nav-btn:hover { background: rgba(255,255,255,0.4); }
        .c04-editor-body { padding: 15px; overflow-y: auto; }
        .c04-time-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #eee; }
        .c04-time-input { flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-weight: bold; font-family: monospace; }
        .c04-btn-del { background: #e74c3c; color: white; border: none; width: 30px; height: 30px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .c04-add-area { background: #f0fdf4; border: 1px dashed #16a34a; padding: 10px; border-radius: 6px; margin-top: 15px; }
        .c04-add-row { display: flex; gap: 5px; margin-top: 5px; }
        .c04-select-type { padding: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; }
        #c04-toast { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); padding: 8px 16px; border-radius: 20px; color: #fff; font-size: 12px; opacity: 0; pointer-events: none; transition: 0.3s; z-index: 1000000; }
        #c04-toast.show { opacity: 1; bottom: 40px; }
    `;

    // --- INICIALIZAÇÃO ---
    function initModule() {
        if (document.getElementById('c04-ponto-painel')) { document.getElementById('c04-ponto-painel').style.display = 'flex'; return; }
        if (!window.location.hostname.includes(CONFIG.domain)) return alert("Use no sistema Clube04.");

        const style = document.createElement('style'); style.textContent = STYLES_CSS; document.head.appendChild(style);
        const div = document.createElement('div'); div.id = 'c04-ponto-painel';
        
        div.innerHTML = `
            <div id="c04-header"><h3>🕒 Auditoria & Edição (v10.0)</h3><span id="c04-close">×</span></div>
            <div id="c04-body">
                <div class="c04-row">
                    <div class="c04-col"><label class="c04-label">Mês Início</label><input type="month" id="c04-ini" class="c04-input"></div>
                    <div class="c04-col"><label class="c04-label">Mês Fim</label><input type="month" id="c04-fim" class="c04-input"></div>
                </div>
                <div>
                    <label class="c04-label">Colaboradores</label>
                    <div class="c04-list-container">
                        <div class="c04-search-box">
                            <input type="text" id="c04-search-list" class="c04-search-input" placeholder="🔍 Filtrar ou Enter para selecionar...">
                            <button class="c04-btn c04-btn-danger" id="c04-clear-list">Limpar</button>
                        </div>
                        <div class="c04-scroll-area" id="c04-list-items" tabindex="0"><div style="padding:10px;color:#999;">Carregando...</div></div>
                    </div>
                </div>
                <div id="c04-status-text">Pronto.</div>
                <button id="c04-btn-run" class="c04-btn c04-btn-primary">BUSCAR DADOS</button>
                <button id="c04-btn-zip" class="c04-btn c04-btn-success">💾 BAIXAR ZIP</button>
                <div id="c04-results-wrapper"></div>
                
                <div id="c04-editor-overlay">
                    <div class="c04-editor-box">
                        <div class="c04-editor-header">
                            <div class="c04-editor-nav">
                                <button class="c04-nav-btn" id="c04-prev-day" title="Anterior (Shift+<)"> &lt; </button>
                                <span id="c04-ed-title">Editar</span>
                                <button class="c04-nav-btn" id="c04-next-day" title="Próximo (Shift+>)"> &gt; </button>
                            </div>
                            <span style="cursor:pointer; margin-left:10px;" id="c04-ed-close" title="Fechar (Esc)">×</span>
                        </div>
                        <div class="c04-editor-body" id="c04-ed-content"></div>
                    </div>
                </div>
            </div>
            <div id="c04-toast"></div>
        `;
        document.body.appendChild(div);

        setupEvents(div);
        carregarColaboradores();
        
        const m = new Date(); m.setMonth(m.getMonth()-1); 
        const iso = m.toISOString().slice(0,7);
        document.getElementById('c04-ini').value = iso; document.getElementById('c04-fim').value = iso;
    }

    // --- CARGA DE COLABORADORES ---
    async function carregarColaboradores() {
        const listArea = document.getElementById('c04-list-items');
        let options = [];
        const localSel = document.getElementById('idColaboradorBusca');
        
        if (localSel) {
            options = Array.from(localSel.querySelectorAll('option')).filter(o=>o.value).map(o=>({id:o.value, nome:o.textContent.trim()}));
        } else {
            try {
                const ifr = await Utils.createIframe(CONFIG.urlAlvo);
                const doc = ifr.contentDocument;
                const rSel = doc.getElementById('idColaboradorBusca');
                if(rSel) options = Array.from(rSel.querySelectorAll('option')).filter(o=>o.value).map(o=>({id:o.value, nome:o.textContent.trim()}));
                ifr.remove();
            } catch(e) {}
        }

        if(options.length === 0) { listArea.innerHTML = "Erro: Lista vazia."; return; }

        listArea.innerHTML = `<div class="c04-check-item" style="font-weight:bold; border-bottom:1px solid #eee;"><input type="checkbox" id="c04-check-all"> Selecionar Visíveis</div>`;
        
        options.forEach(opt => {
            const item = document.createElement('div'); 
            item.className = `c04-check-item c04-colab-row`;
            item.tabIndex = -1;
            item.innerHTML = `<input type="checkbox" class="c04-cb-colab" value="${opt.id}" data-nome="${opt.nome}"> <span>${opt.nome}</span>`;
            item.onclick = (e) => { 
                if(e.target.tagName !== 'INPUT') { const cb=item.querySelector('input'); cb.checked=!cb.checked; }
                document.getElementById('c04-search-list').value = '';
                document.getElementById('c04-search-list').dispatchEvent(new Event('input'));
                document.getElementById('c04-search-list').focus();
            };
            item.onkeydown = (e) => {
                if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } 
                else if(e.key === 'ArrowDown') { e.preventDefault(); if(item.nextElementSibling) item.nextElementSibling.focus(); } 
                else if(e.key === 'ArrowUp') { e.preventDefault(); if(item.previousElementSibling && item.previousElementSibling.className.includes('c04-check-item')) item.previousElementSibling.focus(); else document.getElementById('c04-search-list').focus(); }
            };
            listArea.appendChild(item);
        });

        document.getElementById('c04-check-all').onchange = (e) => {
             document.querySelectorAll('.c04-colab-row').forEach(r => { if(r.style.display!=='none') r.querySelector('input').checked = e.target.checked; });
        };
    }

    function setupEvents(painel) {
        document.getElementById('c04-close').onclick = () => painel.style.display = 'none';
        document.getElementById('c04-ed-close').onclick = fecharEditor;
        
        const searchInput = document.getElementById('c04-search-list');
        const listArea = document.getElementById('c04-list-items');

        searchInput.oninput = (e) => {
            const t = e.target.value.toLowerCase();
            document.querySelectorAll('.c04-colab-row').forEach(r => {
                const span = r.querySelector('span');
                r.style.display = span.innerText.toLowerCase().includes(t) ? 'flex' : 'none';
            });
        };

        searchInput.onkeydown = (e) => {
            if(e.key === 'ArrowDown') {
                e.preventDefault();
                const first = listArea.querySelector('.c04-colab-row:not([style*="none"])');
                if(first) first.focus();
            } else if(e.key === 'Enter') {
                e.preventDefault();
                if(searchInput.value.trim() === '') document.getElementById('c04-btn-run').click();
                else {
                    const first = listArea.querySelector('.c04-colab-row:not([style*="none"])');
                    if(first) first.click();
                }
            }
        };

        // --- RESET COMPLETO (Correção) ---
        document.getElementById('c04-clear-list').onclick = () => {
            document.querySelectorAll('.c04-cb-colab').forEach(cb => cb.checked = false);
            document.getElementById('c04-check-all').checked = false;
            document.getElementById('c04-search-list').value = '';
            document.getElementById('c04-search-list').dispatchEvent(new Event('input'));
            
            // Limpa Resultados e Reseta Tamanho
            document.getElementById('c04-results-wrapper').style.display = 'none';
            document.getElementById('c04-results-wrapper').innerHTML = '';
            painel.classList.remove('expanded');
            State.dadosCache = [];
            document.getElementById('c04-btn-zip').style.display = 'none';
            document.getElementById('c04-status-text').innerText = "Pronto.";
            
            Utils.toast("Reset completo");
        };

        // --- ARRASTAR (Correção) ---
        const header = document.getElementById('c04-header');
        let isDragging = false;
        let dragOffset = [0, 0];

        header.onmousedown = (e) => {
            e.preventDefault();
            isDragging = true;
            // IMPORTANTE: Remove o transform centralizado e fixa a posição absoluta atual
            const rect = painel.getBoundingClientRect();
            painel.style.transform = 'none';
            painel.style.left = rect.left + 'px';
            painel.style.top = rect.top + 'px';
            
            // Calcula o offset do mouse em relação ao canto do painel
            dragOffset = [
                e.clientX - rect.left,
                e.clientY - rect.top
            ];
        };

        document.onmouseup = () => isDragging = false;
        document.onmousemove = (e) => {
            if (isDragging) {
                e.preventDefault();
                painel.style.left = (e.clientX - dragOffset[0]) + 'px';
                painel.style.top = (e.clientY - dragOffset[1]) + 'px';
            }
        };

        // Atalhos do Modal
        document.getElementById('c04-prev-day').onclick = () => navegarDia(-1);
        document.getElementById('c04-next-day').onclick = () => navegarDia(1);
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('c04-editor-overlay').style.display === 'flex') {
                if (e.key === 'Escape') { e.preventDefault(); fecharEditor(); } 
                else if (e.shiftKey) {
                    if (e.key === 'ArrowLeft' || e.key === ',') { e.preventDefault(); navegarDia(-1); }
                    if (e.key === 'ArrowRight' || e.key === '.') { e.preventDefault(); navegarDia(1); }
                }
            }
        });

        document.getElementById('c04-btn-run').onclick = runProcess;
    }

    // --- PROCESSAMENTO ---
    async function runProcess() {
        const cbs = Array.from(document.querySelectorAll('.c04-cb-colab:checked'));
        if(cbs.length===0) return Utils.toast("Selecione um colaborador.", "error");

        const painel = document.getElementById('c04-ponto-painel');
        const resWrapper = document.getElementById('c04-results-wrapper');
        painel.classList.add('expanded');
        resWrapper.style.display = 'block';
        resWrapper.innerHTML = '';
        document.getElementById('c04-btn-zip').style.display = 'none';
        
        State.processando = true;
        State.dadosCache = [];
        
        try {
            if(State.iframe) State.iframe.remove();
            State.iframe = await Utils.createIframe(CONFIG.urlAlvo);
            const win = State.iframe.contentWindow; const doc = State.iframe.contentDocument;

            const meses = gerarMeses(document.getElementById('c04-ini').value, document.getElementById('c04-fim').value);
            
            for(const mes of meses) {
                for(const cb of cbs) {
                    if(!State.processando) break;
                    document.getElementById('c04-status-text').innerText = `Lendo: ${cb.dataset.nome} (${mes})`;
                    
                    if(doc.getElementById('mesBusca')) doc.getElementById('mesBusca').value = mes;
                    const selectEl = doc.getElementById('idColaboradorBusca');
                    if(selectEl) {
                        selectEl.value = cb.value;
                        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                        try { if(win.$ && win.$.fn.selectpicker) { win.$(selectEl).selectpicker('refresh'); } } catch(e) {}
                    }
                    await Utils.sleep(100);
                    const promiseRede = Utils.waitForSpecificUrl(win, CONFIG.targetRequest);
                    const btn = doc.getElementById('buttonbuscarPontos');
                    
                    if(btn) {
                        btn.click();
                        await promiseRede;
                        const idUnidade = doc.getElementById('idUnidadeBuscaImprimir') ? doc.getElementById('idUnidadeBuscaImprimir').value : '26';
                        const resultados = extrairDados(doc, {id: cb.value, nome: cb.dataset.nome}, mes, idUnidade);
                        
                        if(resultados.length) {
                            State.dadosCache.push(...resultados);
                            renderCard({id: cb.value, nome: cb.dataset.nome}, mes, resultados, resWrapper);
                        }
                    }
                }
            }
            document.getElementById('c04-status-text').innerText = "Concluído.";
            if(State.dadosCache.length) {
                document.getElementById('c04-btn-zip').style.display = 'flex';
                document.getElementById('c04-btn-zip').onclick = () => gerarZip(State.dadosCache);
            } else {
                resWrapper.innerHTML = '<div style="padding:20px; text-align:center;">Nenhum dado encontrado.</div>';
            }
        } catch(e) { console.error(e); Utils.toast("Erro: " + e.message, "error"); } finally { State.processando = false; }
    }

    function extrairDados(doc, colab, mesRef, idUnidade) {
        const tabela = doc.getElementById('idTabelaPontos');
        if(!tabela) return [];
        const dados = [];
        const linhas = tabela.querySelectorAll('tbody tr');
        linhas.forEach((tr) => {
            const dataTxt = tr.cells[0].innerText;
            const {data, dia, iso} = Utils.getDataInfo(dataTxt);
            if(data==='-' || !iso) return;
            
            const inputs = Array.from(tr.cells[1].querySelectorAll('input[type="time"]'));
            const horariosFull = inputs.map(i => ({ id: i.id.replace('horarioPonto_', ''), val: i.value })).filter(h => h.val);
            const total = tr.cells[2].innerText.match(/Horas Trabalhadas:\s*([\d:]+)/)?.[1] || "00:00";
            const validacoes = validar(horariosFull.map(h=>h.val), total, dia);
            
            dados.push({ colabId: colab.id, colabNome: colab.nome, idUnidade, data, dia, iso, horariosFull, total, validacoes, mesRef });
        });
        return dados;
    }

    function validar(horarios, total, dia) {
        const erros = [];
        if(horarios.length===0) return [];
        if(horarios.length%2!==0) erros.push("Ímpar");
        for(let i=1;i<horarios.length;i++) if(Utils.timeToMin(horarios[i])-Utils.timeToMin(horarios[i-1])<15) erros.push("Interv < 15m");
        const m = Utils.timeToMin(total);
        if(dia!=='Domingo' && m>0) {
            if(m<360) erros.push("< 6 Horas");
            if(m>(dia==='Sábado'?540:570)) erros.push("Hora Extra++");
        }
        return erros;
    }

    // --- RENDERIZADOR ---
    function renderCard(colab, mes, dados, container) {
        let maxB = 0; dados.forEach(d=> maxB = Math.max(maxB, d.horariosFull.length));
        if(maxB<2) maxB=2; if(maxB%2!==0) maxB++;
        
        let headersTop = `<th colspan="3"></th>`;
        let headersBot = `<th width="60">Ações</th><th>Data</th><th>Dia</th>`;
        
        for(let i=1; i<=maxB; i++) {
            headersTop += `<th></th>`;
            headersBot += `<th>H${i}</th>`;
        }
        headersTop += `<th style="text-align:center"><button class="c04-btn-copy-mini" title="Copiar Coluna">📋 Copiar</button></th><th></th>`;
        headersBot += `<th>Total</th><th>Status</th>`;

        const cardId = `card-${colab.id}-${mes}`;
        const existing = document.getElementById(cardId);
        if(existing) existing.remove();

        const html = `
            <div class="c04-card-res" id="${cardId}">
                <div class="c04-res-header">
                    <div><b>${colab.nome}</b> (${mes})</div>
                </div>
                <div style="overflow-x:auto;">
                    <table class="c04-table" data-maxb="${maxB}">
                        <thead><tr style="height:10px;">${headersTop}</tr><tr>${headersBot}</tr></thead>
                        <tbody>${dados.map((d, index) => buildRowHTML(d, maxB, index)).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = html;
        const finalCard = tempDiv.firstElementChild;
        container.appendChild(finalCard);
        
        // Binds
        finalCard.querySelectorAll('.c04-btn-edit').forEach(btn => {
            btn.onclick = () => {
                const obj = JSON.parse(decodeURIComponent(btn.dataset.json));
                const realIndex = State.dadosCache.findIndex(x => x.colabId == obj.colabId && x.iso == obj.iso);
                abrirEditor(obj, realIndex);
            };
        });
        
        finalCard.querySelectorAll('.c04-btn-del-mini').forEach(btn => {
            btn.onclick = () => {
                const obj = JSON.parse(decodeURIComponent(btn.dataset.json));
                excluirDiaInteiro(obj);
            };
        });

        finalCard.querySelector('.c04-btn-copy-mini').onclick = () => {
            const vals = Array.from(finalCard.querySelectorAll(`tbody tr td:nth-last-child(2) b`)).map(e => e.innerText).join('\n');
            Utils.copyText(vals);
        };
    }

    function buildRowHTML(d, maxB, idx) {
        let tds = '';
        for(let i=0; i<maxB; i++) {
            const h = d.horariosFull[i];
            const cls = i%2===0 ? 'c04-time-entry' : 'c04-time-exit';
            tds += `<td>${h ? `<span class="${cls}">${h.val}</span>` : '-'}</td>`;
        }
        const tags = d.validacoes.map(v=>`<span class="c04-tag">${v}</span>`).join('');
        const rowClass = d.validacoes.length ? 'c04-error-row' : '';
        const dataJson = encodeURIComponent(JSON.stringify(d));
        
        return `<tr class="${rowClass}" id="row-${d.colabId}-${d.iso}">
            <td style="display:flex; gap:5px; justify-content:center;">
                <button class="c04-btn-edit" data-json="${dataJson}" title="Editar">✏️</button>
                <button class="c04-btn-del-mini" data-json="${dataJson}" title="Apagar Dia">🗑️</button>
            </td>
            <td>${d.data}</td><td>${d.dia.substring(0,3)}</td>
            ${tds}<td><b>${d.total}</b></td><td style="text-align:left">${tags}</td>
        </tr>`;
    }

    // --- EDITOR LOGIC ---
    function abrirEditor(dado, index) {
        State.editandoAgora = dado;
        State.currentIndex = index;
        const overlay = document.getElementById('c04-editor-overlay');
        const content = document.getElementById('c04-ed-content');
        
        document.getElementById('c04-ed-title').innerText = `${dado.data} (${dado.dia})`;
        renderConteudoEditor(content, dado);
        overlay.style.display = 'flex';
        
        setTimeout(() => document.getElementById('new-time')?.focus(), 100);
    }
    
    function fecharEditor() { document.getElementById('c04-editor-overlay').style.display = 'none'; }
    
    function navegarDia(dir) {
        const newIdx = State.currentIndex + dir;
        if(newIdx >= 0 && newIdx < State.dadosCache.length) {
            const novoDado = State.dadosCache[newIdx];
            if(novoDado.colabId === State.editandoAgora.colabId) {
                abrirEditor(novoDado, newIdx);
            } else {
                Utils.toast("Fim da lista do colaborador.");
            }
        }
    }

    function renderConteudoEditor(container, dado) {
        container.innerHTML = '';
        
        if(dado.horariosFull.length > 0) {
            const btnClear = document.createElement('button');
            btnClear.className = 'c04-btn c04-btn-danger';
            btnClear.innerText = '🗑️ Limpar Dia Inteiro';
            btnClear.style.width = '100%';
            btnClear.style.marginBottom = '10px';
            btnClear.onclick = () => excluirDiaInteiro(dado);
            container.appendChild(btnClear);
        } else {
            container.innerHTML += '<p style="color:#999;font-size:12px;text-align:center;">Sem batidas.</p>';
        }
        
        dado.horariosFull.forEach((h, i) => {
            const row = document.createElement('div'); row.className = 'c04-time-row';
            const color = i%2===0 ? 'green' : 'red';
            row.innerHTML = `
                <span style="font-size:11px; width:50px; color:${color}; font-weight:bold;">${i%2===0?'Ent':'Sai'}</span>
                <input type="time" class="c04-time-input" value="${h.val}">
                <button class="c04-btn-del" title="Excluir">🗑️</button>
            `;
            const input = row.querySelector('input');
            input.onblur = async () => { if(input.value !== h.val) { await execIframeFunc('alterarHorarioPonto', h.id, input.value); Utils.toast("Salvo"); atualizarLinhaDados(); } };
            
            const btnDel = row.querySelector('button');
            btnDel.onclick = async () => { await excluirPontoViaAjax(h.id); Utils.toast("Removido"); atualizarLinhaDados(); };
            container.appendChild(row);
        });

        const nextType = (dado.horariosFull.length % 2 === 0) ? '1' : '2'; 
        
        const addDiv = document.createElement('div'); addDiv.className = 'c04-add-area';
        addDiv.innerHTML = `
            <div class="c04-add-row">
                <select class="c04-select-type" id="new-type"><option value="1">Entrada</option><option value="2">Saída</option></select>
                <input type="time" class="c04-time-input" id="new-time">
                <button class="c04-btn c04-btn-primary" style="width:auto;" id="btn-add-ok">+</button>
            </div>`;
        container.appendChild(addDiv);
        
        document.getElementById('new-type').value = nextType;
        const inputTime = document.getElementById('new-time');
        const btnAdd = document.getElementById('btn-add-ok');

        inputTime.onkeydown = (e) => {
            if(e.key === 'Enter') { e.preventDefault(); btnAdd.click(); }
        };

        btnAdd.onclick = async () => {
            const timeVal = inputTime.value;
            const typeVal = document.getElementById('new-type').value;
            if(!timeVal) return;
            
            inputTime.disabled = true;
            await inserirPontoViaAjax(dado.colabId, dado.idUnidade, dado.iso, timeVal, typeVal);
            await atualizarLinhaDados(); 
        };
    }

    async function excluirDiaInteiro(dado) {
        // Sem Confirm = Ação Direta
        Utils.toast("Limpando...", "info");
        const promises = dado.horariosFull.map(h => excluirPontoViaAjax(h.id));
        await Promise.all(promises);
        Utils.toast("Dia limpo!", "success");
        atualizarLinhaDados();
    }

    async function atualizarLinhaDados() {
        const doc = State.iframe.contentDocument;
        const win = State.iframe.contentWindow;
        const promiseRede = Utils.waitForSpecificUrl(win, CONFIG.targetRequest);
        doc.getElementById('buttonbuscarPontos').click();
        await promiseRede;

        const novosDados = extrairDados(doc, {id: State.editandoAgora.colabId, colabNome: State.editandoAgora.colabNome}, State.editandoAgora.mesRef, State.editandoAgora.idUnidade);
        const dadoAtualizado = novosDados.find(d => d.iso === State.editandoAgora.iso);
        
        if(dadoAtualizado) {
            State.dadosCache[State.currentIndex] = dadoAtualizado;
            State.editandoAgora = dadoAtualizado;
            
            if(document.getElementById('c04-editor-overlay').style.display !== 'none') {
                renderConteudoEditor(document.getElementById('c04-ed-content'), dadoAtualizado);
                setTimeout(() => document.getElementById('new-time')?.focus(), 100);
            }
            
            const row = document.getElementById(`row-${dadoAtualizado.colabId}-${dadoAtualizado.iso}`);
            if(row) {
                const table = row.closest('table');
                let maxB = parseInt(table.getAttribute('data-maxb')) || 8;
                if (dadoAtualizado.horariosFull.length > maxB) {
                    const thisMonthData = State.dadosCache.filter(x => x.colabId == dadoAtualizado.colabId && x.mesRef == dadoAtualizado.mesRef);
                    renderCard({id: dadoAtualizado.colabId, nome: dadoAtualizado.colabNome}, dadoAtualizado.mesRef, thisMonthData, document.getElementById('c04-results-wrapper'));
                } else {
                    const newHTML = buildRowHTML(dadoAtualizado, maxB);
                    const temp = document.createElement('tbody'); temp.innerHTML = newHTML;
                    row.innerHTML = temp.firstElementChild.innerHTML;
                    row.className = temp.firstElementChild.className;
                    
                    const newBtn = row.querySelector('.c04-btn-edit');
                    newBtn.onclick = () => {
                        const obj = JSON.parse(decodeURIComponent(newBtn.dataset.json));
                        const idx = State.dadosCache.findIndex(x => x.colabId == obj.colabId && x.iso == obj.iso);
                        abrirEditor(obj, idx);
                    };
                    row.querySelector('.c04-btn-del-mini').onclick = () => excluirDiaInteiro(dadoAtualizado);
                }
            }
        }
    }

    // --- AJAX CALLS ---
    function execIframeFunc(funcName, ...args) {
        return new Promise(resolve => {
            const win = State.iframe.contentWindow;
            if(win && win[funcName]) { win[funcName](...args); setTimeout(resolve, 800); } 
            else { resolve(); }
        });
    }

    async function inserirPontoViaAjax(idPessoa, idUnidade, dataIso, hora, tipo) {
        const win = State.iframe.contentWindow;
        if (!win.$) return;
        return new Promise(resolve => {
            win.$.ajax({
                type: "POST", url: CONFIG.urlInserir,
                data: { tipoPonto: tipo, dataDataPonto: dataIso, timeDataPonto: hora, idPessoa: idPessoa, idUnidade: idUnidade },
                success: function() { resolve(); },
                error: function() { Utils.toast("Erro insert", "error"); resolve(); }
            });
        });
    }

    async function excluirPontoViaAjax(idPonto) {
        const win = State.iframe.contentWindow;
        if (!win.$) return;
        return new Promise(resolve => {
            win.$.ajax({
                type: "POST", url: CONFIG.urlExcluir, data: { idPonto: idPonto },
                success: function() { resolve(); },
                error: function() { win.$.ajax({ type: "GET", url: CONFIG.urlExcluir + "?idPonto=" + idPonto, success: resolve, error: resolve }); }
            });
        });
    }

    async function gerarZip(dados) {
        if (!window.JSZip) await new Promise(r=>{const s=document.createElement('script');s.src=CONFIG.urlJSZip;s.onload=r;document.head.appendChild(s);});
        const zip = new JSZip(); const groups = {};
        dados.forEach(d=>{ const k=`${d.colabNome}_${d.mesRef}`; if(!groups[k]) groups[k]=[]; groups[k].push(d); });
        for(const [k, linhas] of Object.entries(groups)) {
            let maxB=0; linhas.forEach(l=>{if(l.horariosFull.length>maxB) maxB=l.horariosFull.length;});
            let h="Data;Dia;"; for(let i=1;i<=maxB;i++) h+=`Batida ${i};`; h+="Total;Obs\n";
            let csv='\uFEFF'+h;
            linhas.forEach(l=>{
                const hs=l.horariosFull.map(x=>x.val); while(hs.length<maxB) hs.push("");
                csv+=`"${l.data}";"${l.dia}";`+hs.map(x=>`"${x}"`).join(';')+`;"${l.total}";"${l.validacoes.join('|')}"\n`;
            });
            zip.file(`Ponto_${k}.csv`, csv);
        }
        const b=await zip.generateAsync({type:"blob"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`Auditoria_${Date.now()}.zip`; document.body.appendChild(a); a.click(); a.remove();
    }
    
    function gerarMeses(i,f){let c=new Date(i+'-02'),e=new Date(f+'-02'),l=[];while(c<=e){l.push(c.toISOString().slice(0,7));c.setMonth(c.getMonth()+1);}return l;}
    window.addEventListener('c04_open_ponto', initModule);
})();
