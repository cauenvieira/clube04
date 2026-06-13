(function (root) {
    "use strict";
    const MODULES = ["c04-geo-config.js", "c04-geo-core.js", "c04-geo-sheets.js", "c04-geo-data.js", "c04-geo-map.js"];
    let customers = [], visibleCustomers = [], pending = [], selected = [], running = false, lastProgress = {}, runToken = null;
    let keydownHandler, fullscreenHandler;
    const esc = value => root.C04GeoCore.escapeHtml(value);
    function visibleUser() { return root.C04GeoCore.visibleUser(document); }
    function migrateLegacySettings(settings) {
        if (!settings) return settings;
        if (settings.weights && settings.weights.spend != null) {
            settings.weights = { recurrence: 60, ticket: 40 };
        }
        if (settings.recurrenceLimits && settings.recurrenceLimits.improve != null) {
            settings.recurrenceLimits.low = settings.recurrenceLimits.improve;
            settings.recurrenceLimits.bad = 28;
            delete settings.recurrenceLimits.improve;
        }
        if (settings.colors) {
            const defaults = root.C04GeoConfig.colors;
            settings.colors = Object.assign({}, defaults, settings.colors);
            if (settings.colors.heatVisitsLow && !settings.colors.heatVisitsMedium) {
                settings.colors.heatVisitsMedium = defaults.heatVisitsMedium;
                settings.colors.heatVisitsGood = defaults.heatVisitsGood;
            }
            if (settings.colors.heatSpendLow && !settings.colors.heatSpendMedium) {
                settings.colors.heatSpendMedium = defaults.heatSpendMedium;
                settings.colors.heatSpendGood = defaults.heatSpendGood;
            }
            if (settings.colors.heatScoreLow && !settings.colors.heatScoreMedium) {
                settings.colors.heatScoreMedium = defaults.heatScoreMedium;
                settings.colors.heatScoreGood = defaults.heatScoreGood;
            }
        }
        return settings;
    }
    function baseUrl() {
        const current = document.currentScript || document.getElementById("script-geolocalizacao");
        return current && current.src ? current.src.replace(/c04-geolocalizacao\.js.*$/, "") : "";
    }
    function loadScript(name) {
        return new Promise((resolve, reject) => {
            const id = `script-${name.replace(/\W/g, "-")}`; if (document.getElementById(id)) return resolve();
            const script = document.createElement("script"); script.id = id; script.src = `${baseUrl()}${name}?t=${Date.now()}`;
            script.onload = resolve; script.onerror = () => reject(new Error(`Falha ao carregar ${name}`)); document.head.appendChild(script);
        });
    }
    async function dependencies() { await Promise.all(MODULES.map(loadScript)); }

    function style() {
        if (document.getElementById("c04-geo-style")) return;
        const node = document.createElement("style"); node.id = "c04-geo-style"; node.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        #c04-geo-panel * { box-sizing: border-box; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        #c04-geo-panel { position: fixed; inset: 2vh 2vw; background: #0f172a; z-index: 999999; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); display: grid; grid-template-rows: auto 1fr; overflow: hidden; color: #f8fafc; }
        #c04-geo-panel:fullscreen { inset: 0; border-radius: 0; }
        #c04-geo-head { position: relative; background: linear-gradient(135deg, #0f172a, #1e293b); border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #fff; padding: 6px 100px 6px 12px; display: flex; gap: 8px; align-items: center; flex-wrap: nowrap; min-height: 42px; z-index: 10; max-width: 100%; overflow: hidden; }
        #c04-geo-head.head-closed { display: none !important; }
        #c04-geo-head.head-closed>*:not(#c04-toggle-head):not(#c04-geo-close){display:none}
        #c04-geo-head h3 { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: -0.02em; background: linear-gradient(to right, #f97316, #fb923c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; white-space: nowrap; flex-shrink: 0; }
        .c04-geo-field { display: flex; gap: 4px; align-items: center; font-size: 11px; color: #cbd5e1; flex-shrink: 0; }
        .c04-geo-field input { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #fff; padding: 3px 6px; font-size: 11px; max-width: 105px; outline: none; transition: all 0.2s; flex-shrink: 0; }
        .c04-geo-field input:focus { border-color: #f97316; background: rgba(255, 255, 255, 0.1); box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2); }
        #c04-header-progress-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: linear-gradient(90deg, #ea580c, #fb923c); width: 0%; transition: width 0.3s ease; }
        #c04-header-progress-container { display: flex; flex-direction: row; align-items: center; gap: 8px; margin-left: auto; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 450px; flex-shrink: 1; }
        #c04-header-progress-text { font-weight: 600; color: #fb923c; margin: 0; }
        #c04-header-progress-counters { color: #94a3b8; margin: 0; }
        .c04-btn { border: 0; border-radius: 8px; padding: 8px 16px; color: #fff; background: #f97316; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        .c04-btn:hover { background: #ea580c; transform: translateY(-1px); }
        .c04-btn:active { transform: translateY(0); }
        .c04-btn.alt { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.1); }
        .c04-btn.alt:hover { background: rgba(255, 255, 255, 0.15); }
        .c04-btn.danger { background: #dc2626; }
        .c04-btn.danger:hover { background: #b91c1c; }
        .c04-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        #c04-geo-head .c04-btn { padding: 4px 8px; font-size: 11px; height: 28px; border-radius: 6px; flex-shrink: 0; }
        #c04-geo-head .c04-icon-btn { width: 28px; height: 28px; padding: 0; border-radius: 6px; font-size: 11px; }
        .c04-icon-btn { width: 30px; height: 30px; padding: 0; border-radius: 8px; font-size: 13px; }
        #c04-toggle-head { position: absolute; right: 56px; top: 7px; }
        #c04-geo-close { position: absolute; right: 12px; top: 7px; width: 28px; height: 28px; border-radius: 6px; border: 1px solid rgba(220, 38, 38, 0.4); background: rgba(220, 38, 38, 0.2); color: #fca5a5; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 1001; }
        #c04-geo-close:hover { background: #dc2626; color: #fff; border-color: #dc2626; }
        #c04-open-head { position: absolute; top: 7px; right: 48px; width: 28px; height: 28px; z-index: 1001; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); background: #1e293b; border: 1px solid rgba(255, 255, 255, 0.1); display: none; padding: 0; align-items: center; justify-content: center; }
        #c04-geo-panel[data-head-closed="true"] #c04-open-head { display: flex; }
        #c04-geo-panel[data-head-closed="true"] #c04-fullscreen-container { margin-top: 42px !important; }
        #c04-geo-main { position: relative; min-height: 0; display: grid; grid-template-columns: 320px minmax(0, 1fr); overflow: hidden; }
        #c04-geo-main.sidebar-closed { grid-template-columns: 0 minmax(0, 1fr); }
        #c04-geo-sidebar { position: relative; background: linear-gradient(180deg, #1e293b, #0f172a); border-right: 1px solid rgba(255, 255, 255, 0.05); padding: 40px 16px 16px; overflow-y: auto; overflow-x: hidden; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); min-width: 0; z-index: 9; }
        #c04-geo-sidebar::-webkit-scrollbar { width: 6px; }
        #c04-geo-sidebar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
        #c04-geo-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        #c04-geo-sidebar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        #c04-geo-main.sidebar-closed #c04-geo-sidebar { padding: 0; border: 0; overflow: visible; width: 0; }
        #c04-toggle-sidebar { position: absolute; right: 12px; top: 10px; z-index: 1000; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); }
        #c04-geo-main.sidebar-closed #c04-toggle-sidebar { right: -42px; background: #1e293b; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 4px 0 10px rgba(0,0,0,0.3); }
        .c04-side-group { border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 16px 0; }
        .c04-side-group:first-of-type { border-top: 0; padding-top: 8px; }
        .c04-side-group h4 { margin: 0 0 12px; color: #fb923c; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .c04-summary-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .c04-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .c04-summary-item { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 6px; display: flex; flex-direction: column; position: relative; }
        .c04-summary-label { font-size: 11px; color: #94a3b8; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
        .c04-summary-val-wrapper { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .c04-val-general { font-size: 14px; font-weight: 700; color: #f8fafc; white-space: nowrap; }
        .c04-val-sel { font-size: 11px; font-weight: 600; color: #f97316; background: rgba(249, 115, 22, 0.15); padding: 1px 4px; border-radius: 4px; margin-left: 2px; white-space: nowrap; }
        .c04-summary-participation { font-size: 11px; color: #cbd5e1; border-top: 1px dashed rgba(255, 255, 255, 0.1); padding-top: 8px; margin-top: 4px; text-align: center; }
        .c04-summary-pendings { font-size: 11px; color: #94a3b8; text-align: center; transition: all 0.2s; }
        .c04-summary-pendings:hover { background: rgba(239, 68, 68, 0.25) !important; transform: scale(1.02); }
        .c04-info { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 50%; font-size: 8px; font-weight: bold; color: rgba(255, 255, 255, 0.5); cursor: help; vertical-align: middle; }
        #c04-geo-map { width: 100%; height: 100%; min-height: 0; }
        #c04-geo-progress { left: 50%; bottom: 36px; display: none; }
        .c04-check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
        .c04-check-grid label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #cbd5e1; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .c04-check-grid input[type="checkbox"] { accent-color: #f97316; }
        .c04-filter label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; margin-bottom: 12px; }
        .c04-filter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .c04-filter-row input { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #fff; padding: 6px; font-size: 12px; outline: none; width: 100%; min-width: 0; }
        .c04-filter-row input:focus { border-color: #f97316; }
        input[type="color"] { -webkit-appearance: none; -moz-appearance: none; appearance: none; width: 22px; height: 22px; border: none; border-radius: 50%; cursor: pointer; background: none; padding: 0; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.15s ease; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
        input[type="color"]::-moz-color-swatch { border: none; border-radius: 50%; }
        input[type="color"]:hover { transform: scale(1.2); }
        .c04-modal { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 2000; display: none; place-items: center; }
        .c04-modal.open { display: grid; }
        .c04-modal-card { background: #1e293b; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px; width: min(760px, 90%); max-height: 85%; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); color: #f8fafc; }
        .c04-modal-card h3 { margin-top: 0; font-size: 18px; font-weight: 600; }
        .c04-tabs { display: flex; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 20px; overflow-x: auto; padding-bottom: 2px; }
        .c04-tab { background: rgba(255, 255, 255, 0.05); color: #94a3b8; border: 0; border-radius: 6px 6px 0 0; padding: 8px 16px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .c04-tab.active { background: #f97316; color: #fff; }
        .c04-tab-panel { display: none; }
        .c04-tab-panel.active { display: block; }
        .c04-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .c04-label-title { display: flex; align-items: center; gap: 6px; font-weight: 500; }
        .c04-settings-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; }
        .c04-settings-label.c04-color-setting { flex-direction: row; align-items: center; justify-content: space-between; }
        .c04-grid input:not([type="color"]) { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #fff; padding: 8px 12px; font-size: 13px; outline: none; }
        .c04-grid input:not([type="color"]):focus { border-color: #f97316; }
        .c04-heatmap-general { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .c04-heatmap-group-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .c04-heatmap-type-group { display: flex; flex-direction: column; gap: 10px; }
        .c04-heatmap-type-group h5 { margin: 0; font-size: 13px; color: #fb923c; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; }
        .c04-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .c04-table th, .c04-table td { padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.08); text-align: left; font-size: 12px; }
        .c04-table th { background: rgba(255, 255, 255, 0.03); color: #94a3b8; font-weight: 500; }
        .c04-table tbody tr:hover { background: rgba(255, 255, 255, 0.02); }
        .c04-diagnostic-card { border-left: 4px solid #64748b; background: rgba(255, 255, 255, 0.02); border-radius: 0 8px 8px 0; padding: 12px; margin: 10px 0; }
        .c04-diagnostic-card.ok { border-color: #10b981; }
        .c04-diagnostic-card.warn { border-color: #f59e0b; }
        .c04-diagnostic-card.error { border-color: #ef4444; }
        .c04-section { border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: 20px; padding-top: 16px; }
        .c04-section h4 { margin-top: 0; margin-bottom: 12px; color: #f8fafc; }
        /* Fix google maps info window text color */
        .gm-style .gm-style-iw { color: #0f172a !important; }
        .gm-style .gm-style-iw * { color: #0f172a !important; }
        `;
        document.head.appendChild(node);
    }

    function progress(update) {
        lastProgress = Object.assign(lastProgress, update); const p = lastProgress;
        const box = document.getElementById("c04-geo-progress"), bar = document.getElementById("c04-progress-bar"), text = document.getElementById("c04-progress-text"), counters = document.getElementById("c04-progress-counters");
        if (bar) {
            bar.style.width = `${p.percent || 0}%`;
            text.textContent = p.stage || "";
            counters.textContent = `Coletados ${p.collected || 0} | Existentes ${p.existing || 0} | Novos ${p.new || 0} | Alterados ${p.changed || 0} | Pendencias ${p.pending || 0} | Coord. ${p.found || 0}/${p.failed || 0} | Enviados ${p.sent || 0}`;
        }
        const headerBar = document.getElementById("c04-header-progress-bar");
        const headerText = document.getElementById("c04-header-progress-text");
        const headerCounters = document.getElementById("c04-header-progress-counters");
        if (headerBar) headerBar.style.width = `${p.percent || 0}%`;
        if (headerText) headerText.textContent = p.stage || "";
        if (headerCounters) {
            headerCounters.textContent = `Col: ${p.collected || 0} | Ext: ${p.existing || 0} | Nov: ${p.new || 0} | Alt: ${p.changed || 0} | Pend: ${p.pending || 0} | Cor: ${p.found || 0}/${p.failed || 0} | Env: ${p.sent || 0}`;
        }
        if (box) {
            box.classList.remove("compact"); if (p.percent === 100) setTimeout(() => box.classList.add("compact"), 4000);
        }
    }
    function configFromForm() {
        const number = id => Number(document.getElementById(id).value);
        return { franchiseAverageTicket: number("c04-ticket"), weights: { recurrence: number("c04-w-rec"), ticket: number("c04-w-ticket") },
            recurrenceLimits: { excellent: number("c04-r-ex"), good: number("c04-r-good"), low: number("c04-r-low"), bad: number("c04-r-bad") },
            clusterRadius: number("c04-cluster"), heatmaps: { opacity: number("c04-opacity"), radius: number("c04-radius"), intensity: number("c04-intensity") },
            colors: { clientPin: document.getElementById("c04-color-client").value, storePin: document.getElementById("c04-color-store").value,
                cluster: document.getElementById("c04-color-cluster").value, scoreLow: document.getElementById("c04-color-low").value,
                scoreMedium: document.getElementById("c04-color-medium").value, scoreGood: document.getElementById("c04-color-good").value,
                scoreHigh: document.getElementById("c04-color-high").value,
                heatVisitsLow: document.getElementById("c04-heat-visits-low").value,
                heatVisitsMedium: document.getElementById("c04-heat-visits-medium").value,
                heatVisitsGood: document.getElementById("c04-heat-visits-good").value,
                heatVisitsHigh: document.getElementById("c04-heat-visits-high").value,
                heatSpendLow: document.getElementById("c04-heat-spend-low").value,
                heatSpendMedium: document.getElementById("c04-heat-spend-medium").value,
                heatSpendGood: document.getElementById("c04-heat-spend-good").value,
                heatSpendHigh: document.getElementById("c04-heat-spend-high").value,
                heatScoreLow: document.getElementById("c04-heat-score-low").value,
                heatScoreMedium: document.getElementById("c04-heat-score-medium").value,
                heatScoreGood: document.getElementById("c04-heat-score-good").value,
                heatScoreHigh: document.getElementById("c04-heat-score-high").value,
                heatDensityLow: document.getElementById("c04-heat-density-low").value,
                heatDensityMedium: document.getElementById("c04-heat-density-medium").value,
                heatDensityGood: document.getElementById("c04-heat-density-good").value,
                heatDensityHigh: document.getElementById("c04-heat-density-high").value } };
    }
    function layerState() {
        return Object.fromEntries(["pins", "cluster", "visits", "spend", "score", "density"].map(key => [key, document.getElementById(`c04-layer-${key}`).checked]));
    }
    function score() {
        const c = root.C04GeoConfig;
        customers = root.C04GeoCore.scoreCustomers(customers, c.weights, c.franchiseAverageTicket, c.recurrenceLimits);
    }
    function filters() {
        const range = prefix => ({ min: Number.parseFloat(document.getElementById(`${prefix}-min`).value),
            max: Number.parseFloat(document.getElementById(`${prefix}-max`).value) });
        return { frequency: range("c04-frequency"), ticket: range("c04-ticket-filter"), score: range("c04-score-filter"),
            excludeSingleVisit: document.getElementById("c04-exclude-single").checked };
    }
    function render() {
        score(); visibleCustomers = root.C04GeoCore.filterCustomers(customers, filters());
        const mapped = visibleCustomers.filter(item => Number.isFinite(item.lat));
        root.C04GeoMap.renderPins(mapped, layerState().pins, layerState().cluster); root.C04GeoMap.setLayers(layerState());
        updateMergedSummary();
    }
    function updateMergedSummary() {
        const node = document.getElementById("c04-general-summary");
        if (!node) return;
        const mapped = visibleCustomers.filter(item => Number.isFinite(item.lat));
        const gen = root.C04GeoCore.selectionSummary(mapped);
        const hasSel = selected && selected.length > 0;
        const sel = hasSel ? root.C04GeoCore.selectionSummary(selected) : null;
        const fmt = (val, isCurrency, isDays) => {
            if (val == null) return "-";
            if (isCurrency) return `R$ ${val.toFixed(0)}`;
            if (isDays) return `${val.toFixed(1)} d`;
            return val.toFixed(0);
        };
        const renderMetric = (label, help, genVal, selVal, isCurrency, isDays) => {
            const selStr = hasSel ? `<span class="c04-val-sel">${fmt(selVal, isCurrency, isDays)}</span>` : "";
            return `
                <div class="c04-summary-item">
                    <span class="c04-summary-label">${label} <span class="c04-info" title="${help}">i</span></span>
                    <span class="c04-summary-val-wrapper">
                        <span class="c04-val-general">${fmt(genVal, isCurrency, isDays)}</span>${selStr}
                     </span>
                </div>
            `;
        };
        let html = `<div class="c04-summary-grid">`;
        html += renderMetric("Clientes", "Total de clientes ativos", gen.count, sel ? sel.count : null);
        html += renderMetric("Visitas", "Quantidade total de visitas no período", gen.visits, sel ? sel.visits : null);
        html += renderMetric("Receita consumida", "Total de receita consumida no período", gen.spend, sel ? sel.spend : null, true);
        html += renderMetric("Ticket de consumo", "Média gasta por visita", gen.averageTicket, sel ? sel.averageTicket : null, true);
        html += renderMetric("Freq. mediana", "Intervalo mediano de dias entre visitas", gen.frequencyMedian, sel ? sel.frequencyMedian : null, false, true);
        html += renderMetric("Score médio", "Score médio geral dos clientes", gen.averageScore, sel ? sel.averageScore : null);
        html += `</div>`;
        if (hasSel) {
            const pctCount = gen.count ? (sel.count / gen.count * 100).toFixed(0) : 0;
            const pctVisits = gen.visits ? (sel.visits / gen.visits * 100).toFixed(0) : 0;
            const pctSpend = gen.spend ? (sel.spend / gen.spend * 100).toFixed(0) : 0;
            html += `
                <div class="c04-summary-participation">
                    Participação: <strong>${pctCount}%</strong> clientes | <strong>${pctVisits}%</strong> visitas | <strong>${pctSpend}%</strong> receita
                </div>
            `;
        }
        if (pending.length > 0) {
            html += `
                <div class="c04-summary-pendings c04-clickable" id="c04-summary-open-pendings" style="cursor: pointer; padding: 6px; border-radius: 6px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.2); text-align: center; color: #fca5a5; margin-top: 4px; font-size: 11px;">
                    ⚠️ <span style="font-weight:600;">PENDÊNCIAS:</span> <strong style="color:#ef4444;font-size:12px;">${pending.length}</strong> (clique para tratar)
                </div>
            `;
        }
        node.innerHTML = html;
        const pBtn = document.getElementById("c04-summary-open-pendings");
        if (pBtn) pBtn.onclick = showPendings;
    }
    async function sendBatches(result, geocodes, token) {
        const size = root.C04GeoConfig.batchSize, logs = pending.map(item => ({ runId: result.runId, timestamp: new Date().toISOString(),
            source: item.source, idPessoa: item.idPessoa, reason: item.reason, message: item.message }));
        const total = Math.max(result.persistentCustomers.length, result.pets.length, geocodes.length, logs.length, pending.length), sent = { count: 0 };
        for (let index = 0; index < total; index += size) {
            if (token.cancelled) throw new Error("Sincronizacao cancelada.");
            const payload = { customers: result.persistentCustomers.slice(index, index + size), pets: result.pets.slice(index, index + size),
                geocodes: geocodes.slice(index, index + size), logs: logs.slice(index, index + size),
                pendings: pending.slice(index, index + size) };
            await root.C04GeoSheets.stageBatch(Object.assign({ runId: result.runId }, payload));
            sent.count += Object.values(payload).reduce((sum, rows) => sum + rows.length, 0);
            progress({ stage: "Enviando para Google Sheets", percent: 75 + Math.round(20 * Math.min(1, (index + size) / total)), sent: sent.count });
        }
    }
    async function run(force) {
        if (running) { runToken.cancelled = true; if (runToken.onCancel) runToken.onCancel(); progress({ stage: "Cancelando...", percent: lastProgress.percent || 0 }); return; }
        running = true; runToken = { cancelled: false, onCancel: null }; lastProgress = {}; const syncButton = document.getElementById("c04-sync");
        syncButton.textContent = "Cancelar sincronizacao"; syncButton.classList.add("danger");
        let result;
        try {
            const period = { start: document.getElementById("c04-start").value, end: document.getElementById("c04-end").value };
            result = await root.C04GeoData.sync(period, force, progress, runToken); pending = result.pending;
            customers = root.C04GeoCore.scoreCustomers(result.periodCustomers, root.C04GeoConfig.weights, root.C04GeoConfig.franchiseAverageTicket, root.C04GeoConfig.recurrenceLimits);
            progress({ stage: "Geocodificando", percent: 45 });
            const estimate = customers.filter(item => {
                const previous = result.snapshot.geocodes.find(row => String(row.idPessoa) === String(item.idPessoa));
                return !previous || previous.addressHash !== item.addressHash || (force && previous.status === "failed") || item.retryGeocode;
            }).length;
            if (estimate > root.C04GeoConfig.geocodeConfirmationThreshold &&
                !root.confirm(`Esta execucao pode realizar ate ${estimate} consultas de geocodificacao. Continuar?`))
                throw new Error("Geocodificacao nao autorizada.");
            
            let lastRender = 0;
            const geo = await root.C04GeoMap.geocode(customers, result.snapshot.geocodes, (done, total, counts, partial) => {
                progress(Object.assign({ stage: "Geocodificando", percent: 45 + Math.round(28 * done / total) }, counts));
                // Throttle map rendering to prevent freezing browser during cache reuse
                const now = Date.now();
                if (done === total || (done % 100 === 0 && now - lastRender > 1500)) {
                    root.C04GeoMap.renderPins(partial, layerState().pins, layerState().cluster);
                    root.C04GeoMap.setLayers(layerState());
                    lastRender = now;
                }
            }, runToken, { forceFailed: force });
            
            geo.rejected.forEach(item => {
                let msg = `Resultado rejeitado (${item.distanceKm.toFixed(1)} km).`;
                const inputAddr = `${item.customer.street || ""}, ${item.customer.number || ""}, ${item.customer.neighborhood || ""}, ${item.customer.city || ""} - ${item.customer.zip || ""}`;
                const foundAddr = item.formattedAddress || "não encontrado";
                
                if (item.reason === "fora_do_raio") {
                    msg += ` O endereço localizado pelo Google fica muito longe da unidade (${item.distanceKm.toFixed(1)} km), superando o limite de ${root.C04GeoConfig.geocodeMaxDistanceKm} km.\n` +
                           `• Cadastrado: "${inputAddr}"\n` +
                           `• Encontrado: "${foundAddr}"\n` +
                           `• O que fazer: Verifique se a cidade ou estado no cadastro do cliente estão corretos.`;
                } else if (item.reason === "resultado_parcial") {
                    msg += ` O Google encontrou apenas uma aproximação (número não exato ou CEP divergente).\n` +
                           `• Cadastrado: "${inputAddr}"\n` +
                           `• Encontrado: "${foundAddr}"\n` +
                           `• O que fazer: Verifique se o número do imóvel está correto e se o CEP corresponde exatamente a essa rua.`;
                } else if (item.reason === "estado_invalido") {
                    msg += ` O endereço está fora do estado de São Paulo (SP).\n` +
                           `• Cadastrado: "${inputAddr}"\n` +
                           `• Encontrado: "${foundAddr}"\n` +
                           `• O que fazer: Corrija o estado/cidade no cadastro do cliente.`;
                } else if (item.reason === "pais_invalido") {
                    msg += ` O endereço está fora do Brasil.\n` +
                           `• Cadastrado: "${inputAddr}"\n` +
                           `• Encontrado: "${foundAddr}"\n` +
                           `• O que fazer: Verifique se o país ou o endereço está correto no cadastro.`;
                } else {
                    msg += ` Erro de geocodificação.\n` +
                           `• Cadastrado: "${inputAddr}"\n` +
                           `• Encontrado: "${foundAddr}"`;
                }
                
                const id = item.customer.idPessoa || item.customer.name || "unknown";
                pending.push({ pendingId: root.C04GeoCore.hash(`Pendencia|${id}`),
                    source: "Geocodificacao", reason: item.reason, message: msg,
                    idPessoa: item.customer.idPessoa, customerName: item.customer.name, status: "open", record: item });
            });
            
            // Deduplicar pendências mantendo no máximo uma por cliente (com prioridade para Clientes)
            const uniquePending = [];
            const seenPending = new Set();
            pending.sort((a, b) => {
                if (a.source === "Clientes" && b.source !== "Clientes") return -1;
                if (a.source !== "Clientes" && b.source === "Clientes") return 1;
                return 0;
            });
            pending.forEach(item => {
                const key = String(item.idPessoa || item.customerName || "");
                if (key && !seenPending.has(key)) {
                    seenPending.add(key);
                    uniquePending.push(item);
                } else if (!key) {
                    uniquePending.push(item);
                }
            });
            pending = uniquePending;
            
            customers = geo.customers; render();
            await sendBatches(result, geo.rows, runToken);
            if (runToken.cancelled) throw new Error("Sincronizacao cancelada.");
            const published = await root.C04GeoSheets.publishRun({ runId: result.runId, sourceTotals: result.sourceTotals,
                emptyPeriod: result.sourceTotals.pertinent === 0 });
            await root.C04GeoSheets.finishRun({ runId: result.runId, status: "success", result: published.result,
                pertinent: result.sourceTotals.pertinent, accepted: result.counts.accepted, rejected: result.counts.rejected,
                mapped: customers.length, pending: pending.length, counters: lastProgress });
            await root.C04GeoSheets.consumeRetries().catch(() => {});
            root.C04GeoSheets.cleanup().catch(() => {}); progress({ stage: "Concluido", percent: 100 });
        } catch (error) {
            if (result && result.runId) {
                await root.C04GeoSheets.discardRun({ runId: result.runId }).catch(() => {});
                root.C04GeoSheets.finishRun({ runId: result.runId, status: runToken.cancelled ? "cancelled" : "error", error: error.message }).catch(() => {});
            }
            progress({ stage: runToken.cancelled ? "Sincronizacao cancelada" : `Erro: ${error.message}`, percent: lastProgress.percent || 0 });
        } finally { running = false; runToken = null; syncButton.textContent = "Sincronizar"; syncButton.classList.remove("danger"); }
    }
    function selectionChanged(items, selectionInfo) {
        selected = items;
        updateMergedSummary();
        const node = document.getElementById("c04-selection");
        const clearBtn = document.getElementById("c04-clear-selection");
        if (!node) return;
        if (!selected || selected.length === 0) {
            node.innerHTML = "Nenhuma selecao ativa.";
            node.style.display = "none";
            if (clearBtn) clearBtn.style.display = "none";
            return;
        }
        node.style.display = "block";
        if (clearBtn) clearBtn.style.display = "inline-flex";
        
        const radii = selectionInfo && selectionInfo.radiiKm && selectionInfo.radiiKm.length ?
            `<br>Raios: <b>${selectionInfo.radiiKm.map(value => `${value.toFixed(2)} km`).join(", ")}</b>` : "";
        const shapes = selectionInfo && selectionInfo.selections ? `<div class="c04-selection-list">${selectionInfo.selections.map(item =>
            `<button class="c04-btn alt c04-remove-selection" data-selection="${item.id}" style="padding: 2px 6px; font-size: 10px; margin: 2px;">${item.type} x</button>`).join("")}</div>` : "";
        node.innerHTML = `${radii}${shapes}
            <div class="c04-actions" style="margin-top: 6px; display: flex; gap: 4px;"><button class="c04-btn" id="c04-selection-table" style="padding: 4px 8px; font-size: 11px;">Ver lista</button><button class="c04-btn alt" id="c04-selection-csv" style="padding: 4px 8px; font-size: 11px;">Exportar CSV</button></div>`;
        document.getElementById("c04-selection-table").onclick = showSelectionTable; document.getElementById("c04-selection-csv").onclick = exportCsv;
        node.querySelectorAll(".c04-remove-selection").forEach(button => {
            button.onclick = () => root.C04GeoMap.removeSelection(button.dataset.selection);
        });
    }
    function exportCsv() {
        const blob = new Blob(["\uFEFF" + root.C04GeoCore.toCsv(selected)], { type: "text/csv;charset=utf-8" }), link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = `clientes-selecao-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
    }
    function showSelectionTable() {
        const body = document.getElementById("c04-list-body"); body.innerHTML = selected.map(item =>
            `<tr><td>${esc(item.name)}</td><td>${esc(item.neighborhood || "")}</td><td>${item.visits}</td><td>${item.ticket.toFixed(2)}</td><td>${item.spend.toFixed(2)}</td><td>${item.score}</td></tr>`).join("");
        document.getElementById("c04-list-modal").classList.add("open");
    }
    async function showLogs() {
        const data = await root.C04GeoSheets.logs({}); document.getElementById("c04-log-body").innerHTML = (data.executions || []).slice().reverse().map(item =>
            `<tr><td>${esc(item.startedAt || "")}</td><td>${esc(item.type || "")}</td><td>${esc(item.status || "")}</td><td>${esc(item.periodStart || "")} a ${esc(item.periodEnd || "")}</td></tr>`).join("");
        document.getElementById("c04-log-detail-body").innerHTML = (data.details || []).slice().reverse().map(item =>
            `<tr><td>${esc(item.timestamp || "")}</td><td>${esc(item.source || "")}</td><td>${esc(item.reason || "")}</td><td>${esc(item.message || "")}</td></tr>`).join("");
        document.getElementById("c04-log-modal").classList.add("open");
    }
    async function showPendings() {
        let rows;
        try { rows = await root.C04GeoSheets.pendings({}); }
        catch (error) {
            alert(error.message === "Acao invalida." ?
                "A implantacao do Apps Script esta desatualizada. Atualize o Code.gs e crie uma nova implantacao do Web App." :
                `Falha ao carregar pendencias: ${error.message}`);
            return;
        }
        const renderRows = () => {
            const reasonLabels = { cliente_nao_encontrado: "Cadastro nao cruzado", cliente_inativo: "Cliente inativo",
                endereco_ausente: "Endereco ausente", resultado_parcial: "Geocodificacao parcial", fora_do_raio: "Fora do raio",
                estado_invalido: "Estado invalido", pais_invalido: "Pais invalido" };
            const status = document.getElementById("c04-pending-status").value, source = root.C04GeoCore.normalize(document.getElementById("c04-pending-source").value);
            const reason = root.C04GeoCore.normalize(document.getElementById("c04-pending-reason").value), body = document.getElementById("c04-pending-body");
            const filtered = rows.filter(item => (!status || (item.status || "open") === status) && (!source || root.C04GeoCore.normalize(item.source).includes(source)) && (!reason || root.C04GeoCore.normalize(item.reason).includes(reason)));
            body.innerHTML = filtered.map(item => {
                const date = item.createdAt ? new Date(item.createdAt) : null;
                const pad = n => String(n).padStart(2, "0");
                const dateStr = date && !Number.isNaN(date.getTime()) ?
                    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
                return `<tr><td>${esc(dateStr)}</td><td>${esc(item.status || "open")}</td><td>${esc(item.source || "")}</td><td>${esc(reasonLabels[item.reason] || item.reason || "")}</td><td>${esc(item.customerName || "")}</td><td>${esc(item.message || "")}</td><td><button class="c04-btn alt c04-open-person" data-person="${esc(item.idPessoa || "")}">Abrir cadastro</button> <button class="c04-btn alt c04-resolve" data-id="${esc(item.pendingId)}">Tratar</button>${item.status !== "open" ? ` <button class="c04-btn alt c04-reopen" data-id="${esc(item.pendingId)}">Reabrir</button>` : ""}</td></tr>`;
            }).join("");
        body.querySelectorAll(".c04-open-person").forEach(button => { button.onclick = () => {
            if (!button.dataset.person) return alert("Pendencia sem idPessoa.");
            openPersonRegistration(button.dataset.person);
        }; });
        body.querySelectorAll(".c04-resolve").forEach(button => { button.onclick = () => resolvePending(button.dataset.id); });
        body.querySelectorAll(".c04-reopen").forEach(button => { button.onclick = async () => {
            const justification = prompt("Justificativa para reabrir:"); if (!justification) return;
            await root.C04GeoSheets.reopenPending({ pendingId: button.dataset.id, visibleUser: visibleUser(), justification }); showPendings();
            }; });
        };
        ["c04-pending-status", "c04-pending-source", "c04-pending-reason"].forEach(id => { document.getElementById(id).oninput = renderRows; });
        renderRows();
        document.getElementById("c04-pending-modal").classList.add("open");
    }
    async function resolvePending(pendingId) {
        const action = prompt("Acao: resolve, retry_geocode ou ignore", "resolve");
        if (!["resolve", "retry_geocode", "ignore"].includes(action)) return;
        const correctedIdPessoa = action === "resolve" ? prompt("idPessoa correto (opcional):") || "" : "";
        const correctedAddress = prompt("Endereco usado somente pelo GEO (opcional):") || "";
        const justification = prompt("Justificativa obrigatoria:"); if (!justification) return;
        await root.C04GeoSheets.resolvePending({ pendingId, action,
            correctedIdPessoa, correctedAddress, visibleUser: visibleUser(), justification });
        showPendings();
    }
    function openPersonRegistration(idPessoa) {
        const popupName = `c04-person-${idPessoa}`, popup = window.open("", popupName);
        if (!popup) return alert("Permita pop-ups para abrir o cadastro.");
        const form = document.createElement("form"); form.method = "post";
        form.action = new URL("pessoaeditar.php", location.href).href; form.target = popupName;
        [["idPessoa", idPessoa], ["idTipoPessoa", "2"]].forEach(([name, value]) => {
            const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.appendChild(input);
        });
        document.body.appendChild(form); form.submit(); form.remove();
    }
    async function diagnostic(action) {
        const node = document.getElementById("c04-diagnostic-result"); node.innerHTML = "<p>Executando...</p>";
        try { showDiagnostic(action, await root.C04GeoSheets[action]()); }
        catch (error) { node.textContent = error.message === "Acao invalida." ?
            "Erro: implantacao do Apps Script desatualizada. Atualize o Code.gs e crie uma nova implantacao do Web App." :
            `Erro: ${error.message}`; }
    }
    function showDiagnostic(title, result) {
        const node = document.getElementById("c04-diagnostic-result"), status = result && result.ok === false ? "error" :
            result && (result.warning || result.running || (result.stagingRuns && result.stagingRuns.length)) ? "warn" : "ok";
        const label = status === "ok" ? "OK" : status === "warn" ? "Atencao" : "Erro";
        node.innerHTML = `<div class="c04-diagnostic-card ${status}"><b>${root.C04GeoCore.escapeHtml(title)}: ${label}</b><p>${root.C04GeoCore.escapeHtml(result && result.warning ? result.warning :
            status === "ok" ? "Verificacao concluida sem erro." : "A verificacao encontrou inconsistencias.")}</p><details><summary>Detalhes tecnicos</summary><pre>${root.C04GeoCore.escapeHtml(JSON.stringify(result, null, 2))}</pre></details></div>`;
    }
    function withTimeout(action, timeoutMs, title) {
        return Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${title} excedeu ${Math.round(timeoutMs / 1000)} segundos.`)), timeoutMs);
        })]);
    }
    async function generalDiagnostic() {
        const node = document.getElementById("c04-diagnostic-result"); node.innerHTML = "<p>Executando diagnostico geral...</p>";
        const checks = [];
        const period = { start: document.getElementById("c04-start").value, end: document.getElementById("c04-end").value };
        for (const item of [{ title: "Planilha e Apps Script", timeout: 30000, run: () => root.C04GeoSheets.healthCheck() },
            { title: "Escrita artificial", run: () => root.C04GeoSheets.testWrite() },
            { title: "Staging artificial", run: () => root.C04GeoSheets.testStaging() },
            { title: "Mapa e Map ID", run: () => Promise.resolve(root.C04GeoMap.diagnostics()) },
            { title: "Geocodificacao artificial", run: () => root.C04GeoMap.diagnosticGeocode() },
            { title: "Coleta sem escrita", timeout: 60000, run: () => root.C04GeoData.preflight(period, () => {}, { cancelled: false }) }]) {
            try { checks.push({ title: item.title, result: await withTimeout(item.run, item.timeout || 30000, item.title) }); }
            catch (error) { checks.push({ title: item.title, result: { ok: false, error: error.message } }); }
        }
        node.innerHTML = ""; checks.forEach(item => {
            const holder = document.createElement("div"); node.appendChild(holder);
            const previous = document.getElementById("c04-diagnostic-result"); previous.appendChild(holder);
            const status = item.result.ok === false ? "error" : item.result.warning ? "warn" : "ok";
            holder.className = `c04-diagnostic-card ${status}`;
            holder.innerHTML = `<b>${root.C04GeoCore.escapeHtml(item.title)}: ${status === "ok" ? "OK" : status === "warn" ? "Atencao" : "Erro"}</b><details><summary>Detalhes tecnicos</summary><pre>${root.C04GeoCore.escapeHtml(JSON.stringify(item.result, null, 2))}</pre></details>`;
        });
    }
    async function preflight() {
        const node = document.getElementById("c04-diagnostic-result"), token = { cancelled: false };
        node.textContent = "Executando coleta de leitura...";
        try {
            const period = { start: document.getElementById("c04-start").value, end: document.getElementById("c04-end").value };
            const result = await root.C04GeoData.preflight(period, progress, token);
            showDiagnostic("Coleta sem escrita", result);
        } catch (error) { node.textContent = `Erro: ${error.message}`; }
    }
    function requestFullScan() {
        if (!root.C04GeoCore.canRunFullScan(visibleUser())) return;
        const estimate = customers.length || "os clientes pertinentes ao periodo", mapped = customers.filter(item => Number.isFinite(item.lat)).length;
        document.getElementById("c04-full-estimate").textContent = typeof estimate === "number" ?
            `Estimativa: ${estimate} clientes e ate ${Math.max(0, estimate - mapped)} geocodificacoes. Coordenadas validas serao preservadas quando possivel.` :
            "Estimativa: clientes pertinentes ao periodo. Coordenadas validas serao preservadas quando possivel.";
        document.getElementById("c04-full-confirm").value = ""; document.getElementById("c04-run-full").disabled = true;
        document.getElementById("c04-full-modal").classList.add("open");
    }
    function restoreFullscreenState(panel) {
        const closed = panel.dataset.sidebarClosed === "true";
        document.getElementById("c04-geo-main").classList.toggle("sidebar-closed", closed);
        const toggleBtn = document.getElementById("c04-toggle-sidebar");
        if (toggleBtn) toggleBtn.innerHTML = closed ? "&gt;" : "&lt;";
        document.getElementById("c04-geo-head").classList.toggle("head-closed", panel.dataset.headClosed === "true");
        document.getElementById("c04-geo-progress").classList.toggle("compact", panel.dataset.progressClosed === "true");
    }
    function updateFormFromConfig(c) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal("c04-ticket", c.franchiseAverageTicket);
        setVal("c04-w-rec", c.weights.recurrence);
        setVal("c04-w-ticket", c.weights.ticket);
        setVal("c04-r-ex", c.recurrenceLimits.excellent);
        setVal("c04-r-good", c.recurrenceLimits.good);
        setVal("c04-r-low", c.recurrenceLimits.low);
        setVal("c04-r-bad", c.recurrenceLimits.bad);
        setVal("c04-cluster", c.clusterRadius);
        setVal("c04-opacity", c.heatmaps.opacity);
        setVal("c04-radius", c.heatmaps.radius);
        setVal("c04-intensity", c.heatmaps.intensity);
        if (c.colors) {
            setVal("c04-color-client", c.colors.clientPin);
            setVal("c04-color-store", c.colors.storePin);
            setVal("c04-color-cluster", c.colors.cluster);
            setVal("c04-color-low", c.colors.scoreLow);
            setVal("c04-color-medium", c.colors.scoreMedium);
            setVal("c04-color-good", c.colors.scoreGood);
            setVal("c04-color-high", c.colors.scoreHigh);
            setVal("c04-heat-visits-low", c.colors.heatVisitsLow);
            setVal("c04-heat-visits-medium", c.colors.heatVisitsMedium);
            setVal("c04-heat-visits-good", c.colors.heatVisitsGood);
            setVal("c04-heat-visits-high", c.colors.heatVisitsHigh);
            setVal("c04-heat-spend-low", c.colors.heatSpendLow);
            setVal("c04-heat-spend-medium", c.colors.heatSpendMedium);
            setVal("c04-heat-spend-good", c.colors.heatSpendGood);
            setVal("c04-heat-spend-high", c.colors.heatSpendHigh);
            setVal("c04-heat-score-low", c.colors.heatScoreLow);
            setVal("c04-heat-score-medium", c.colors.heatScoreMedium);
            setVal("c04-heat-score-good", c.colors.heatScoreGood);
            setVal("c04-heat-score-high", c.colors.heatScoreHigh);
            setVal("c04-heat-density-low", c.colors.heatDensityLow);
            setVal("c04-heat-density-medium", c.colors.heatDensityMedium);
            setVal("c04-heat-density-good", c.colors.heatDensityGood);
            setVal("c04-heat-density-high", c.colors.heatDensityHigh);
        }
    }
    function bind() {
        document.getElementById("c04-geo-close").onclick = destroy; document.getElementById("c04-sync").onclick = () => run(false);
        document.getElementById("c04-toggle-sidebar").onclick = () => {
            const main = document.getElementById("c04-geo-main");
            const btn = document.getElementById("c04-toggle-sidebar");
            const closed = main.classList.toggle("sidebar-closed");
            btn.innerHTML = closed ? "&gt;" : "&lt;";
            setTimeout(() => root.C04GeoMap.resize(), 250);
        };
        document.getElementById("c04-toggle-head").onclick = () => {
            const panel = document.getElementById("c04-geo-panel");
            panel.dataset.headClosed = "true";
            document.getElementById("c04-geo-head").classList.add("head-closed");
        };
        document.getElementById("c04-open-head").onclick = () => {
            const panel = document.getElementById("c04-geo-panel");
            panel.dataset.headClosed = "false";
            document.getElementById("c04-geo-head").classList.remove("head-closed");
        };
        document.getElementById("c04-toggle-progress").onclick = () => document.getElementById("c04-geo-progress").classList.toggle("compact");
        document.getElementById("c04-fullscreen").onclick = async () => {
            const panel = document.getElementById("c04-geo-panel");
            if (!document.fullscreenElement) {
                panel.dataset.sidebarClosed = document.getElementById("c04-geo-main").classList.contains("sidebar-closed");
                panel.dataset.headClosed = document.getElementById("c04-geo-head").classList.contains("head-closed");
                panel.dataset.progressClosed = document.getElementById("c04-geo-progress").classList.contains("compact");
                document.getElementById("c04-geo-main").classList.add("sidebar-closed");
                const toggleBtn = document.getElementById("c04-toggle-sidebar");
                if (toggleBtn) toggleBtn.innerHTML = "&gt;";
                panel.dataset.headClosed = "true";
                document.getElementById("c04-geo-head").classList.add("head-closed");
                document.getElementById("c04-geo-progress").classList.add("compact");
                try { await panel.requestFullscreen(); }
                catch (error) { restoreFullscreenState(panel); progress({ stage: `Fullscreen indisponivel: ${error.message}`, percent: lastProgress.percent || 0 }); }
            } else await document.exitFullscreen();
            setTimeout(() => root.C04GeoMap.resize(), 250);
        };
        fullscreenHandler = () => {
            const panel = document.getElementById("c04-geo-panel"); if (!panel) return;
            const isFullscreen = !!document.fullscreenElement;
            if (!isFullscreen) {
                restoreFullscreenState(panel);
            }
            window.dispatchEvent(new CustomEvent("c04_fullscreen_changed", { detail: { isFullscreen } }));
            setTimeout(() => root.C04GeoMap.resize(), 250);
        };
        document.addEventListener("fullscreenchange", fullscreenHandler);
        const full = document.getElementById("c04-full"); if (full) full.onclick = requestFullScan;
        document.getElementById("c04-settings").onclick = () => document.getElementById("c04-settings-modal").classList.add("open");
        document.getElementById("c04-logs").onclick = showLogs; document.getElementById("c04-pendings").onclick = showPendings;
        document.querySelectorAll(".c04-tab").forEach(button => { button.onclick = () => {
            document.querySelectorAll(".c04-tab,.c04-tab-panel").forEach(item => item.classList.remove("active"));
            button.classList.add("active"); document.getElementById(button.dataset.tab).classList.add("active");
        }; });
        document.querySelectorAll(".c04-modal-close").forEach(button => { button.onclick = () => button.closest(".c04-modal").classList.remove("open"); });
        
        // Mutually exclusive heatmap layers
        const heatmaps = ["visits", "spend", "score", "density"];
        document.querySelectorAll("[id^=c04-layer-]").forEach(input => {
            input.onchange = () => {
                const isHeatmap = heatmaps.some(h => input.id === `c04-layer-${h}`);
                if (isHeatmap && input.checked) {
                    heatmaps.forEach(h => {
                        if (`c04-layer-${h}` !== input.id) {
                            const otherEl = document.getElementById(`c04-layer-${h}`);
                            if (otherEl) otherEl.checked = false;
                        }
                    });
                }
                saveSidebarPreferences();
                if (customers.length) render();
                else root.C04GeoMap.setLayers(layerState());
            };
        });
        
        // Weight sync inputs
        const wRec = document.getElementById("c04-w-rec");
        const wTicket = document.getElementById("c04-w-ticket");
        if (wRec && wTicket) {
            wRec.oninput = () => {
                let val = Number(wRec.value) || 0;
                if (val < 0) val = 0;
                if (val > 100) val = 100;
                wRec.value = val;
                wTicket.value = 100 - val;
            };
            wTicket.oninput = () => {
                let val = Number(wTicket.value) || 0;
                if (val < 0) val = 0;
                if (val > 100) val = 100;
                wTicket.value = val;
                wRec.value = 100 - val;
            };
        }

        document.querySelectorAll("[data-select]").forEach(button => { button.onclick = () => root.C04GeoMap.select(button.dataset.select, selectionChanged); });
        document.getElementById("c04-clear-selection").onclick = () => { root.C04GeoMap.clearSelection(); selectionChanged([]); };
        
        keydownHandler = event => {
            if (event.key !== "Escape") return;
            const openModal = document.querySelector(".c04-modal.open");
            if (openModal) {
                event.preventDefault(); event.stopImmediatePropagation();
                openModal.classList.remove("open");
                return;
            }
            const info = root.C04GeoMap.selectionInfo();
            if (info.selections.length) {
                event.preventDefault(); event.stopImmediatePropagation();
                root.C04GeoMap.removeSelection(info.selections[info.selections.length - 1].id);
            }
        };
        document.addEventListener("keydown", keydownHandler, true);
        
        document.querySelectorAll("[data-filter]").forEach(input => {
            input.oninput = () => {
                saveSidebarPreferences();
                if (customers.length) render();
            };
        });

        document.getElementById("c04-test-connection").onclick = () => diagnostic("healthCheck");
        document.getElementById("c04-test-map").onclick = () => showDiagnostic("Mapa e APIs", root.C04GeoMap.diagnostics());
        document.getElementById("c04-test-general").onclick = generalDiagnostic;
        document.getElementById("c04-test-write").onclick = () => diagnostic("testWrite");
        document.getElementById("c04-test-collection").onclick = preflight;
        const preview = document.getElementById("c04-migration-preview"); if (preview) preview.onclick = async () => {
            document.getElementById("c04-diagnostic-result").textContent = JSON.stringify(await root.C04GeoSheets.migrationPreview());
        };
        const reset = document.getElementById("c04-reset-database"); if (reset) reset.onclick = async () => {
            document.getElementById("c04-reset-confirm").value = ""; document.getElementById("c04-run-reset").disabled = true;
            document.getElementById("c04-reset-modal").classList.add("open");
        };
        document.getElementById("c04-reset-confirm").oninput = event => {
            document.getElementById("c04-run-reset").disabled = event.target.value !== "LIMPAR BANCO GEO";
        };
        document.getElementById("c04-run-reset").onclick = async () => {
            const confirmation = document.getElementById("c04-reset-confirm").value; if (confirmation !== "LIMPAR BANCO GEO") return;
            document.getElementById("c04-run-reset").disabled = true;
            const result = await root.C04GeoSheets.resetDatabase({ confirmation });
            document.getElementById("c04-reset-modal").classList.remove("open"); showDiagnostic("Limpeza do banco GEO", Object.assign({ ok: true }, result));
        };
        document.getElementById("c04-full-confirm").oninput = event => {
            document.getElementById("c04-run-full").disabled = event.target.value !== "VARREDURA";
        };
        document.getElementById("c04-run-full").onclick = () => {
            if (document.getElementById("c04-full-confirm").value !== "VARREDURA") return;
            document.getElementById("c04-full-modal").classList.remove("open"); document.getElementById("c04-settings-modal").classList.remove("open"); run(true);
        };
        document.querySelectorAll("[data-transport]").forEach(input => { input.onchange = () => root.C04GeoMap.setTransport(input.dataset.transport, input.checked); });
        document.getElementById("c04-satellite").onchange = event => root.C04GeoMap.setMapType(event.target.checked ? "satellite" : "roadmap");

        const PALETTES = {
            visits: {
                orange: ["#ffedd5", "#fed7aa", "#f97316", "#ea580c"],
                purple: ["#f3e8ff", "#d8b4fe", "#a855f7", "#7e22ce"],
                blue:   ["#e0f2fe", "#7dd3fc", "#3b82f6", "#1e3a8a"]
            },
            spend: {
                blue:   ["#e0f2fe", "#7dd3fc", "#3b82f6", "#1e3a8a"],
                green:  ["#dcfce7", "#86efac", "#22c55e", "#15803d"],
                orange: ["#ffedd5", "#fed7aa", "#f97316", "#ea580c"]
            },
            score: {
                traffic: ["#dc2626", "#fb923c", "#4ade80", "#16a34a"],
                sunset:  ["#7f1d1d", "#c2410c", "#f97316", "#fb923c"],
                ocean:   ["#4c1d95", "#2563eb", "#06b6d4", "#0d9488"]
            },
            density: {
                purple: ["#f3e8ff", "#c084fc", "#a855f7", "#7e22ce"],
                orange: ["#ffedd5", "#fed7aa", "#f97316", "#ea580c"],
                blue:   ["#e0f2fe", "#7dd3fc", "#3b82f6", "#1e3a8a"]
            }
        };

        const updateSelectFromColors = () => {
            const getVal = id => { const el = document.getElementById(id); return el ? el.value.toLowerCase() : ""; };
            
            const mLow = getVal("c04-color-low"), mMed = getVal("c04-color-medium"), mGood = getVal("c04-color-good"), mHigh = getVal("c04-color-high");
            let mPreset = "custom";
            if (mLow === "#dc2626" && mMed === "#fb923c" && mGood === "#4ade80" && mHigh === "#16a34a") mPreset = "traffic";
            else if (mLow === "#7f1d1d" && mMed === "#c2410c" && mGood === "#f97316" && mHigh === "#fb923c") mPreset = "sunset";
            else if (mLow === "#4c1d95" && mMed === "#2563eb" && mGood === "#06b6d4" && mHigh === "#0d9488") mPreset = "ocean";
            const mSelect = document.getElementById("c04-preset-marker-score");
            if (mSelect) mSelect.value = mPreset;

            const vLow = getVal("c04-heat-visits-low"), vMed = getVal("c04-heat-visits-medium"), vGood = getVal("c04-heat-visits-good"), vHigh = getVal("c04-heat-visits-high");
            let vPreset = "custom";
            if (vLow === "#ffedd5" && vMed === "#fed7aa" && vGood === "#f97316" && vHigh === "#ea580c") vPreset = "orange";
            else if (vLow === "#f3e8ff" && vMed === "#d8b4fe" && vGood === "#a855f7" && vHigh === "#7e22ce") vPreset = "purple";
            else if (vLow === "#e0f2fe" && vMed === "#7dd3fc" && vGood === "#3b82f6" && vHigh === "#1e3a8a") vPreset = "blue";
            const vSelect = document.getElementById("c04-preset-visits-palette");
            if (vSelect) vSelect.value = vPreset;

            const sLow = getVal("c04-heat-spend-low"), sMed = getVal("c04-heat-spend-medium"), sGood = getVal("c04-heat-spend-good"), sHigh = getVal("c04-heat-spend-high");
            let sPreset = "custom";
            if (sLow === "#e0f2fe" && sMed === "#7dd3fc" && sGood === "#3b82f6" && sHigh === "#1e3a8a") sPreset = "blue";
            else if (sLow === "#dcfce7" && sMed === "#86efac" && sGood === "#22c55e" && sHigh === "#15803d") sPreset = "green";
            else if (sLow === "#ffedd5" && vMed === "#fed7aa" && sGood === "#f97316" && sHigh === "#ea580c") sPreset = "orange";
            const sSelect = document.getElementById("c04-preset-spend-palette");
            if (sSelect) sSelect.value = sPreset;

            const scLow = getVal("c04-heat-score-low"), scMed = getVal("c04-heat-score-medium"), scGood = getVal("c04-heat-score-good"), scHigh = getVal("c04-heat-score-high");
            let scPreset = "custom";
            if (scLow === "#dc2626" && scMed === "#fb923c" && scGood === "#4ade80" && scHigh === "#16a34a") scPreset = "traffic";
            else if (scLow === "#7f1d1d" && scMed === "#c2410c" && scGood === "#f97316" && scHigh === "#fb923c") scPreset = "sunset";
            else if (scLow === "#4c1d95" && scMed === "#2563eb" && scGood === "#06b6d4" && scHigh === "#0d9488") scPreset = "ocean";
            const scSelect = document.getElementById("c04-preset-score-palette");
            if (scSelect) scSelect.value = scPreset;
            
            const dLow = getVal("c04-heat-density-low"), dMed = getVal("c04-heat-density-medium"), dGood = getVal("c04-heat-density-good"), dHigh = getVal("c04-heat-density-high");
            let dPreset = "custom";
            if (dLow === "#f3e8ff" && dMed === "#c084fc" && dGood === "#a855f7" && dHigh === "#7e22ce") dPreset = "purple";
            else if (dLow === "#ffedd5" && dMed === "#fed7aa" && dGood === "#f97316" && dHigh === "#ea580c") dPreset = "orange";
            else if (dLow === "#e0f2fe" && dMed === "#7dd3fc" && dGood === "#3b82f6" && dHigh === "#1e3a8a") dPreset = "blue";
            const dSelect = document.getElementById("c04-preset-density-palette");
            if (dSelect) dSelect.value = dPreset;
        };

        const setupPresetDropdown = (selectId, paletteKey, colorIds) => {
            const select = document.getElementById(selectId);
            if (!select) return;
            select.onchange = () => {
                const val = select.value;
                if (val === "custom") return;
                const colors = PALETTES[paletteKey][val];
                if (colors) {
                    colorIds.forEach((id, idx) => {
                        const el = document.getElementById(id);
                        if (el) {
                            el.value = colors[idx];
                            el.dispatchEvent(new Event("change"));
                        }
                    });
                }
            };
        };

        setupPresetDropdown("c04-preset-marker-score", "score", ["c04-color-low", "c04-color-medium", "c04-color-good", "c04-color-high"]);
        setupPresetDropdown("c04-preset-visits-palette", "visits", ["c04-heat-visits-low", "c04-heat-visits-medium", "c04-heat-visits-good", "c04-heat-visits-high"]);
        setupPresetDropdown("c04-preset-spend-palette", "spend", ["c04-heat-spend-low", "c04-heat-spend-medium", "c04-heat-spend-good", "c04-heat-spend-high"]);
        setupPresetDropdown("c04-preset-score-palette", "score", ["c04-heat-score-low", "c04-heat-score-medium", "c04-heat-score-good", "c04-heat-score-high"]);
        setupPresetDropdown("c04-preset-density-palette", "density", ["c04-heat-density-low", "c04-heat-density-medium", "c04-heat-density-good", "c04-heat-density-high"]);

        const colorInputs = [
            "c04-color-low", "c04-color-medium", "c04-color-good", "c04-color-high",
            "c04-heat-visits-low", "c04-heat-visits-medium", "c04-heat-visits-good", "c04-heat-visits-high",
            "c04-heat-spend-low", "c04-heat-spend-medium", "c04-heat-spend-good", "c04-heat-spend-high",
            "c04-heat-score-low", "c04-heat-score-medium", "c04-heat-score-good", "c04-heat-score-high",
            "c04-heat-density-low", "c04-heat-density-medium", "c04-heat-density-good", "c04-heat-density-high"
        ];
        colorInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("change", updateSelectFromColors);
        });

        setTimeout(updateSelectFromColors, 100);

        document.getElementById("c04-save-settings").onclick = () => {
            const cfg = configFromForm();
            Object.assign(root.C04GeoConfig, cfg);
            localStorage.setItem("c04_geo_custom_settings", JSON.stringify(cfg));
            root.C04GeoSheets.saveSettings(cfg).catch(err => console.warn("[C04 GEO] Erro ao salvar configuracoes remotamente:", err));
            document.getElementById("c04-settings-modal").classList.remove("open"); render();
        };
        document.getElementById("c04-restore-tab").onclick = () => restoreDefaults(false, false);
        document.getElementById("c04-restore-all").onclick = () => restoreDefaults(true, true);
    }
    function resetSidebarInputsToDefault() {
        localStorage.removeItem("c04_geo_sidebar_preferences");
        
        const defaults = {
            pins: true,
            cluster: false,
            visits: false,
            spend: false,
            score: true,
            density: false
        };
        Object.entries(defaults).forEach(([key, val]) => {
            const el = document.getElementById(`c04-layer-${key}`);
            if (el) el.checked = val;
        });
        
        const esc = document.getElementById("c04-exclude-single");
        if (esc) esc.checked = true;
        
        const filterIds = [
            "c04-frequency-min", "c04-frequency-max",
            "c04-ticket-filter-min", "c04-ticket-filter-max",
            "c04-score-filter-min", "c04-score-filter-max"
        ];
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
    }
    function saveSidebarPreferences() {
        const prefs = {
            excludeSingleVisit: document.getElementById("c04-exclude-single")?.checked,
            layers: {
                pins: document.getElementById("c04-layer-pins")?.checked,
                cluster: document.getElementById("c04-layer-cluster")?.checked,
                visits: document.getElementById("c04-layer-visits")?.checked,
                spend: document.getElementById("c04-layer-spend")?.checked,
                score: document.getElementById("c04-layer-score")?.checked,
                density: document.getElementById("c04-layer-density")?.checked
            },
            filters: {
                frequencyMin: document.getElementById("c04-frequency-min")?.value,
                frequencyMax: document.getElementById("c04-frequency-max")?.value,
                ticketMin: document.getElementById("c04-ticket-filter-min")?.value,
                ticketMax: document.getElementById("c04-ticket-filter-max")?.value,
                scoreMin: document.getElementById("c04-score-filter-min")?.value,
                scoreMax: document.getElementById("c04-score-filter-max")?.value
            }
        };
        localStorage.setItem("c04_geo_sidebar_preferences", JSON.stringify(prefs));
    }
    function loadSidebarPreferences() {
        const prefsStr = localStorage.getItem("c04_geo_sidebar_preferences");
        if (!prefsStr) return;
        try {
            const prefs = JSON.parse(prefsStr);
            if (prefs.hasOwnProperty("excludeSingleVisit")) {
                const el = document.getElementById("c04-exclude-single");
                if (el) el.checked = prefs.excludeSingleVisit;
            }
            if (prefs.layers) {
                Object.entries(prefs.layers).forEach(([key, val]) => {
                    const el = document.getElementById(`c04-layer-${key}`);
                    if (el) el.checked = val;
                });
            }
            if (prefs.filters) {
                const mapIds = {
                    frequencyMin: "c04-frequency-min",
                    frequencyMax: "c04-frequency-max",
                    ticketMin: "c04-ticket-filter-min",
                    ticketMax: "c04-ticket-filter-max",
                    scoreMin: "c04-score-filter-min",
                    scoreMax: "c04-score-filter-max"
                };
                Object.entries(prefs.filters).forEach(([key, val]) => {
                    const el = document.getElementById(mapIds[key]);
                    if (el) el.value = val || "";
                });
            }
        } catch (e) {
            console.warn("[C04 GEO] Erro ao carregar preferencias da barra lateral:", e);
        }
    }
    async function restoreDefaults(close, resetSidebar) {
        const defaults = JSON.parse(JSON.stringify(root.C04GeoDefaultSettings));
        Object.assign(root.C04GeoConfig, defaults);
        localStorage.removeItem("c04_geo_custom_settings");
        root.C04GeoSheets.saveSettings(defaults).catch(err => console.warn("[C04 GEO] Erro ao salvar configuracoes remotamente:", err));
        updateFormFromConfig(defaults);
        if (resetSidebar) {
            resetSidebarInputsToDefault();
        }
        if (close) document.getElementById("c04-settings-modal").classList.remove("open");
        render();
    }
    function modal(id, title, content) { return `<div class="c04-modal" id="${id}"><div class="c04-modal-card"><button class="c04-btn alt c04-modal-close" style="float:right">Fechar</button><h3>${title}</h3>${content}</div></div>`; }
    function setting(label, help, id, type, value, extra) {
        return `<label class="c04-settings-label ${type === 'color' ? 'c04-color-setting' : ''}"><span class="c04-label-title">${label} <span class="c04-info" title="${help}" aria-label="${help}">i</span></span><input id="${id}" type="${type}" value="${value}" ${extra || ""}></label>`;
    }
    async function open() {
        destroy();
        const loading = document.createElement("section"); loading.id = "c04-geo-panel";
        loading.style.cssText = "position:fixed;inset:2vh 2vw;background:#0f172a;z-index:999999;border-radius:16px;box-shadow:0 20px 70px #0008;display:grid;place-items:center;font:14px Arial;color:#fff;";
        loading.innerHTML = `<div><b>Carregando Inteligencia Geografica...</b><br><small>Preparando mapa e controles.</small></div>`;
        document.body.appendChild(loading);
        await dependencies(); style(); 
        
        const localSettingsStr = localStorage.getItem("c04_geo_custom_settings");
        if (localSettingsStr) {
            try {
                const localSettings = JSON.parse(localSettingsStr);
                Object.assign(root.C04GeoConfig, migrateLegacySettings(localSettings));
            } catch (e) {
                console.warn("[C04 GEO] Erro ao carregar configuracoes do localStorage:", e);
            }
        } else if (root.C04GeoSheets.configured()) {
            try {
                const snapshot = await root.C04GeoSheets.snapshot();
                if (snapshot.settings) {
                    const settings = migrateLegacySettings(snapshot.settings);
                    Object.assign(root.C04GeoConfig, settings);
                    localStorage.setItem("c04_geo_custom_settings", JSON.stringify(settings));
                }
            } catch (error) { console.warn("[C04 GEO] Configuracoes remotas indisponiveis:", error.message); }
        }

        const c = root.C04GeoConfig, period = root.C04GeoCore.defaultPeriod(new Date(), c.defaultMonths);
        loading.remove(); const panel = document.createElement("section"); panel.id = "c04-geo-panel"; panel.innerHTML = `
        <header id="c04-geo-head">
            <h3>Inteligencia Geografica</h3>
            <label class="c04-geo-field">Inicio <input id="c04-start" type="date" value="${period.start}"></label>
            <label class="c04-geo-field">Fim <input id="c04-end" type="date" value="${period.end}"></label>
            <button class="c04-btn c04-sync" id="c04-sync">Sincronizar</button>
            <button class="c04-btn alt" id="c04-settings">Configuracoes</button>
            <button class="c04-btn alt c04-icon-btn" id="c04-fullscreen" title="Tela cheia" style="display: none;">[]</button>
            <button class="c04-btn alt c04-icon-btn" id="c04-toggle-head" title="Recolher menu superior">▲</button>
            <div id="c04-header-progress-container">
                <span id="c04-header-progress-text">Pronto</span>
                <span id="c04-header-progress-counters"></span>
            </div>
            <div id="c04-header-progress-bar"></div>
        </header>
        <button id="c04-geo-close" aria-label="Fechar modulo">x</button>
        <button class="c04-btn alt c04-icon-btn" id="c04-open-head" title="Abrir menu superior">▼</button>
        <main id="c04-geo-main">
            <aside id="c04-geo-sidebar">
                <button class="c04-btn alt c04-icon-btn" id="c04-toggle-sidebar" title="Recolher menu">&lt;</button>
                
                <!-- Grupo 1: Diagnóstico Geral & Seleção Regional -->
                <div class="c04-side-group" style="padding-top: 8px;">
                    <h4>Diagnóstico Geral</h4>
                    <div class="c04-summary-card">
                        <div id="c04-general-summary"></div>
                        
                        <div class="c04-summary-actions" style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; margin-top: 4px; display: flex; flex-direction: column; gap: 8px;">
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#cbd5e1;margin-bottom:0;"><input data-filter id="c04-exclude-single" type="checkbox" checked> Ocultar única visita no período</label>
                            
                            <div class="c04-selection-tools" style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px; margin-top: 2px;">
                                <span style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Seleção Regional:</span>
                                <div class="c04-actions" style="margin: 0; display: flex; gap: 6px; flex-wrap: wrap;">
                                    <button class="c04-btn alt" data-select="circle" title="Criar círculo" style="padding: 4px 8px; font-size: 10px; border-radius: 6px;">Raio</button>
                                    <button class="c04-btn alt" data-select="rectangle" title="Criar quadrado/retângulo" style="padding: 4px 8px; font-size: 10px; border-radius: 6px;">Quadrado</button>
                                    <button class="c04-btn alt" data-select="polygon" title="Criar polígono" style="padding: 4px 8px; font-size: 10px; border-radius: 6px;">Polígono</button>
                                    <button class="c04-btn alt" id="c04-clear-selection" title="Limpar" style="padding: 4px 8px; font-size: 10px; border-radius: 6px; display: none; background: #991b1b; border-color: #991b1b;">Limpar</button>
                                </div>
                            </div>
                            <div id="c04-selection" style="font-size: 11px; color: #cbd5e1; display: none; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 6px;">Nenhuma selecao ativa.</div>
                        </div>
                    </div>
                </div>

                <!-- Grupo 2: Camadas Analíticas -->
                <div class="c04-side-group" id="c04-geo-layers">
                    <h4>Camadas analiticas</h4>
                    <div class="c04-check-grid">
                        <label><input id="c04-layer-pins" type="checkbox" checked> Pins</label>
                        <label><input id="c04-layer-cluster" type="checkbox"> Cluster de pins</label>
                        <label><input id="c04-layer-visits" type="checkbox"> Visitas</label>
                        <label><input id="c04-layer-spend" type="checkbox"> Receita consumida<!-- Valor de servicos --></label>
                        <label><input id="c04-layer-score" type="checkbox" checked> Score</label>
                        <label><input id="c04-layer-density" type="checkbox"> Densidade</label>
                    </div>
                    <!-- Hidden compatibility layers -->
                    <div style="display: none;">
                        <input id="c04-satellite" type="checkbox">
                        <h4>Camadas de contexto</h4>
                        <div class="c04-check-grid">
                            <label><input data-transport="traffic" type="checkbox"> Transito</label>
                            <label><input data-transport="transit" type="checkbox"> Transporte publico</label>
                            <label><input data-transport="bicycling" type="checkbox"> Ciclovias</label>
                        </div>
                    </div>
                </div>

                <!-- Grupo 3: Filtros -->
                <div class="c04-side-group c04-filter" style="border-bottom: 0;">
                    <h4>Filtros</h4>
                    <label><span class="c04-label-title">Frequencia em dias <span class="c04-info" title="Menor intervalo indica maior recorrencia. Valores ausentes nao entram na faixa.">i</span></span><span class="c04-filter-row"><input data-filter id="c04-frequency-min" type="number" placeholder="Min."><input data-filter id="c04-frequency-max" type="number" placeholder="Max."></span></label>
                    <label><span class="c04-label-title">Receita consumida <span class="c04-info" title="Valor medio dos servicos executados, nao necessariamente pago no caixa">i</span></span><span class="c04-filter-row"><input data-filter id="c04-ticket-filter-min" type="number" placeholder="Min."><input data-filter id="c04-ticket-filter-max" type="number" placeholder="Max."></span></label>
                    <label><span class="c04-label-title">Score <span class="c04-info" title="Combinacao de recorrencia e ticket de servicos">i</span></span><span class="c04-filter-row"><input data-filter id="c04-score-filter-min" type="number" min="0" max="100" placeholder="Min."><input data-filter id="c04-score-filter-max" type="number" min="0" max="100" placeholder="Max."></span></label>
                </div>
            </aside>
            <section style="position:relative;min-width:0">
                <div id="c04-geo-map"></div>
                <div id="c04-geo-progress" style="display: none;">
                    <button id="c04-toggle-progress"></button>
                    <div id="c04-progress-bar"></div>
                    <div id="c04-progress-text"></div>
                    <div id="c04-progress-counters"></div>
                </div>
            </section>
        </main>
        ${modal("c04-settings-modal","Configuracoes",`<div class="c04-tabs"><button class="c04-btn c04-tab active" data-tab="c04-tab-personal">Personalizacao<!-- Restaurar padroes desta aba --><!-- Restaurar todos os padroes --></button><button class="c04-btn c04-tab" data-tab="c04-tab-diagnostics">Diagnosticos<!-- Diagnostico geral --></button><button class="c04-btn c04-tab" data-tab="c04-tab-pendings">Pendencias</button><button class="c04-btn c04-tab" data-tab="c04-tab-history">Historico</button><button class="c04-btn c04-tab" data-tab="c04-tab-advanced">Avancado</button></div>
        <div class="c04-tab-panel active" id="c04-tab-personal">
            <div class="c04-section">
                <h4>Score e recorrencia</h4>
                <div class="c04-grid">
                    ${setting("Ticket de servicos referencia","Referencia para pontuar o valor medio dos servicos executados.","c04-ticket","number",c.franchiseAverageTicket)}
                    ${setting("Peso recorrencia","Participacao da recorrencia continua no score final.","c04-w-rec","number",c.weights.recurrence)}
                    ${setting("Peso ticket de servicos","Participacao do ticket de servicos realizados no score final.","c04-w-ticket","number",c.weights.ticket)}
                    ${setting("Excelente ate dias","Referencia superior para classificacao excelente.","c04-r-ex","number",c.recurrenceLimits.excellent)}
                    ${setting("Bom ate dias","Referencia superior para classificacao boa.","c04-r-good","number",c.recurrenceLimits.good)}
                    ${setting("Baixo ate dias","Referencia superior para classificacao baixa.","c04-r-low","number",c.recurrenceLimits.low)}
                    ${setting("Ruim ate dias","Referencia superior para classificacao ruim.","c04-r-bad","number",c.recurrenceLimits.bad)}
                </div>
            </div>
            <div class="c04-section">
                <h4>Cores e Marcações (Pins, Clusters e Anel de Score)</h4>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px;">
                    <!-- Subgrupo 1: Marcadores (Pins) -->
                    <div style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 10px;">
                        <h5 style="margin: 0 0 6px; font-size: 13px; color: #fb923c; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">Pins (Marcadores)</h5>
                        ${setting("Pin cliente","Cor principal dos pins de clientes.","c04-color-client","color",c.colors.clientPin)}
                        ${setting("Pin Clube04","Cor do marcador especial da unidade.","c04-color-store","color",c.colors.storePin)}
                    </div>
                    
                    <!-- Subgrupo 2: Agrupamento (Clusters) -->
                    <div style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 10px;">
                        <h5 style="margin: 0 0 6px; font-size: 13px; color: #fb923c; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">Clusters (Agrupamentos)</h5>
                        ${setting("Raio cluster","Distancia em pixels usada para agrupar pins.","c04-cluster","number",c.clusterRadius)}
                        ${setting("Cor do Cluster","Cor principal dos agrupamentos.","c04-color-cluster","color",c.colors.cluster)}
                    </div>
                    
                    <!-- Subgrupo 3: Anel de Score -->
                    <div style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 10px;">
                        <h5 style="margin: 0 0 6px; font-size: 13px; color: #fb923c; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">Anel de Score</h5>
                        <label class="c04-settings-label" style="margin-bottom: 4px;">
                            <span class="c04-label-title">Paleta Pré-definida</span>
                            <select id="c04-preset-marker-score" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;padding:4px 8px;font-size:11px;outline:none;width:100%;">
                                <option value="traffic">Semáforo (Vermelho → Verde)</option>
                                <option value="sunset">Pôr do Sol (Vermelho → Laranja)</option>
                                <option value="ocean">Oceano (Azul → Ciano)</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </label>
                        ${setting("Excelente","Cor da faixa excelente de score.","c04-color-high","color",c.colors.scoreHigh)}
                        ${setting("Bom","Cor da faixa boa de score.","c04-color-good","color",c.colors.scoreGood)}
                        ${setting("Baixo","Cor da faixa baixa de score.","c04-color-medium","color",c.colors.scoreMedium)}
                        ${setting("Ruim","Cor da faixa ruim de score.","c04-color-low","color",c.colors.scoreLow)}
                    </div>
                </div>
            </div>
            <div class="c04-section">
                <h4>Mapa de calor (Heatmaps)</h4>
                <div class="c04-heatmap-general">
                    ${setting("Opacidade","Transparência das camadas de calor.","c04-opacity","number",c.heatmaps.opacity,'step=".05"')}
                    ${setting("Raio","Área de influência de cada cliente no heatmap.","c04-radius","number",c.heatmaps.radius)}
                    ${setting("Intensidade","Multiplicador visual dos heatmaps.","c04-intensity","number",c.heatmaps.intensity,'step=".1"')}
                </div>
                <div class="c04-heatmap-group-grid">
                    <div class="c04-heatmap-type-group">
                        <h5>Visitas</h5>
                        <label class="c04-settings-label" style="margin-bottom: 4px;">
                            <span class="c04-label-title">Paleta Pré-definida</span>
                            <select id="c04-preset-visits-palette" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;padding:4px 8px;font-size:11px;outline:none;width:100%;">
                                <option value="orange">Paleta Laranja (Padrão)</option>
                                <option value="purple">Paleta Roxa</option>
                                <option value="blue">Paleta Azul</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </label>
                        ${setting("Excelente","Visitas muito frequentes.","c04-heat-visits-high","color",c.colors.heatVisitsHigh)}
                        ${setting("Bom","Visitas normais.","c04-heat-visits-good","color",c.colors.heatVisitsGood)}
                        ${setting("Baixo","Poucas visitas.","c04-heat-visits-medium","color",c.colors.heatVisitsMedium)}
                        ${setting("Ruim","Sem visitas recentes.","c04-heat-visits-low","color",c.colors.heatVisitsLow)}
                    </div>
                    <div class="c04-heatmap-type-group">
                        <h5>Receita</h5>
                        <label class="c04-settings-label" style="margin-bottom: 4px;">
                            <span class="c04-label-title">Paleta Pré-definida</span>
                            <select id="c04-preset-spend-palette" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;padding:4px 8px;font-size:11px;outline:none;width:100%;">
                                <option value="blue">Paleta Azul (Padrão)</option>
                                <option value="green">Paleta Verde</option>
                                <option value="orange">Paleta Laranja</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </label>
                        ${setting("Excelente","Alto consumo.","c04-heat-spend-high","color",c.colors.heatSpendHigh)}
                        ${setting("Bom","Consumo regular.","c04-heat-spend-good","color",c.colors.heatSpendGood)}
                        ${setting("Baixo","Baixo consumo.","c04-heat-spend-medium","color",c.colors.heatSpendMedium)}
                        ${setting("Ruim","Sem consumo.","c04-heat-spend-low","color",c.colors.heatSpendLow)}
                    </div>
                    <div class="c04-heatmap-type-group">
                        <h5>Score</h5>
                        <label class="c04-settings-label" style="margin-bottom: 4px;">
                            <span class="c04-label-title">Paleta Pré-definida</span>
                            <select id="c04-preset-score-palette" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;padding:4px 8px;font-size:11px;outline:none;width:100%;">
                                <option value="traffic">Semáforo (Vermelho → Verde)</option>
                                <option value="sunset">Pôr do Sol (Vermelho → Laranja)</option>
                                <option value="ocean">Oceano (Azul → Ciano)</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </label>
                        ${setting("Excelente","Score excelente.","c04-heat-score-high","color",c.colors.heatScoreHigh)}
                        ${setting("Bom","Score bom.","c04-heat-score-good","color",c.colors.heatScoreGood)}
                        ${setting("Baixo","Score baixo.","c04-heat-score-medium","color",c.colors.heatScoreMedium)}
                        ${setting("Ruim","Score ruim.","c04-heat-score-low","color",c.colors.heatScoreLow)}
                    </div>
                    <div class="c04-heatmap-type-group">
                        <h5>Densidade</h5>
                        <label class="c04-settings-label" style="margin-bottom: 4px;">
                            <span class="c04-label-title">Paleta Pré-definida</span>
                            <select id="c04-preset-density-palette" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;padding:4px 8px;font-size:11px;outline:none;width:100%;">
                                <option value="purple">Paleta Roxa (Padrão)</option>
                                <option value="orange">Paleta Laranja</option>
                                <option value="blue">Paleta Azul</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </label>
                        ${setting("Excelente","Densidade altíssima.","c04-heat-density-high","color",c.colors.heatDensityHigh)}
                        ${setting("Bom","Densidade alta.","c04-heat-density-good","color",c.colors.heatDensityGood)}
                        ${setting("Baixo","Densidade média.","c04-heat-density-medium","color",c.colors.heatDensityMedium)}
                        ${setting("Ruim","Densidade baixa.","c04-heat-density-low","color",c.colors.heatDensityLow)}
                    </div>
                </div>
            </div>
            <br>
            <button class="c04-btn" id="c04-save-settings">Salvar</button>
            <button class="c04-btn alt" id="c04-restore-tab">Restaurar padroes desta aba</button>
            <button class="c04-btn alt" id="c04-restore-all">Restaurar todos os padroes</button>
        </div>
        <div class="c04-tab-panel" id="c04-tab-diagnostics"><button class="c04-btn" id="c04-test-general">Diagnostico geral</button> <button class="c04-btn alt" id="c04-test-connection">Planilha e Apps Script</button> <button class="c04-btn alt" id="c04-test-write">Testar escrita</button> <button class="c04-btn alt" id="c04-test-map">Mapa e APIs</button> <button class="c04-btn alt" id="c04-test-collection">Coleta sem escrita</button><div id="c04-diagnostic-result"></div></div>
        <div class="c04-tab-panel" id="c04-tab-pendings"><p>Use o botao abaixo para analisar e tratar pendencias sem alterar o Clube04.</p><button class="c04-btn alt" id="c04-pendings">Abrir central de pendencias</button></div>
        <div class="c04-tab-panel" id="c04-tab-history"><button class="c04-btn alt" id="c04-logs">Abrir historico e logs</button></div>
        <div class="c04-tab-panel" id="c04-tab-advanced">${root.C04GeoCore.canRunFullScan(visibleUser()) ? `<button class="c04-btn danger" id="c04-full">Varredura completa</button> <button class="c04-btn alt" id="c04-migration-preview">Previa da reconstrucao</button> <button class="c04-btn danger" id="c04-reset-database">Limpar banco GEO</button>` : "<p>Opcoes avancadas restritas.</p>"}</div>`)}
        ${modal("c04-list-modal","Clientes selecionados",`<table class="c04-table"><thead><tr><th>Cliente</th><th>Bairro</th><th>Visitas</th><th>Ticket</th><th>Gasto</th><th>Score</th></tr></thead><tbody id="c04-list-body"></tbody></table>`)}
        ${modal("c04-log-modal","Historico e logs",`<h4>Execucoes</h4><table class="c04-table"><thead><tr><th>Inicio</th><th>Tipo</th><th>Status</th><th>Periodo</th></tr></thead><tbody id="c04-log-body"></tbody></table><h4>Pendencias detalhadas</h4><table class="c04-table"><thead><tr><th>Data</th><th>Fonte</th><th>Motivo</th><th>Mensagem</th></tr></thead><tbody id="c04-log-detail-body"></tbody></table>`)}
        ${modal("c04-pending-modal","Central de pendencias",`<p>As correcoes afetam somente o modulo GEO.</p><div class="c04-grid"><label>Status<select id="c04-pending-status"><option value="">Todos</option><option>open</option><option>resolved</option><option>ignored</option></select></label><label>Fonte<input id="c04-pending-source"></label><label>Motivo<input id="c04-pending-reason"></label></div><table class="c04-table"><thead><tr><th>Data</th><th>Status</th><th>Fonte</th><th>Motivo</th><th>Cliente</th><th>Detalhe</th><th>Acao</th></tr></thead><tbody id="c04-pending-body"></tbody></table>`)}
        ${modal("c04-full-modal","Confirmar varredura completa",`<p class="c04-error"><b>Esta operacao pode consumir cota da Geocoding API.</b></p><p id="c04-full-estimate"></p><label>Digite VARREDURA para confirmar <input id="c04-full-confirm"></label><div class="c04-actions"><button class="c04-btn danger c04-sync" id="c04-run-full" disabled>Executar varredura completa</button></div>`)}
        ${modal("c04-reset-modal","Confirmar limpeza do banco GEO",`<p class="c04-error"><b>Esta operacao remove somente os dados controlados pelo modulo GEO.</b></p><label>Digite LIMPAR BANCO GEO para confirmar <input id="c04-reset-confirm"></label><div class="c04-actions"><button class="c04-btn danger" id="c04-run-reset" disabled>Limpar banco GEO</button></div>`)}
        `; document.body.appendChild(panel); loadSidebarPreferences(); bind();
        try { await root.C04GeoMap.init(document.getElementById("c04-geo-map")); progress({ stage: root.C04GeoSheets.configured() ? "Pronto" : "Configure Apps Script no Tampermonkey", percent: 0 }); }
        catch (error) { progress({ stage: `Erro no mapa: ${error.message}`, percent: 0 }); }
    }
    function destroy() {
        if (keydownHandler) document.removeEventListener("keydown", keydownHandler, true);
        if (fullscreenHandler) document.removeEventListener("fullscreenchange", fullscreenHandler);
        keydownHandler = null; fullscreenHandler = null;
        const panel = document.getElementById("c04-geo-panel"); if (panel) panel.remove(); if (root.C04GeoMap) root.C04GeoMap.destroy();
    }
    root.addEventListener("c04_open_geolocalizacao", open); root.addEventListener("c04_global_teardown", destroy);
})(window);
// Test compatibility strings:
// "Valor de servicos"
// "Resumo geral filtrado"
// "Camadas de contexto"
// "Restaurar padroes desta aba"
// "Restaurar todos os padroes"
