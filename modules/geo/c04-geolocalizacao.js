(function (root) {
    "use strict";
    const MODULES = ["c04-geo-config.js", "c04-geo-core.js", "c04-geo-supabase.js", "c04-geo-data.js", "c04-geo-map.js"];
    let customers = [], visibleCustomers = [], pending = [], selected = [], running = false, lastProgress = {}, runToken = null;
    let currentPendings = [], currentSnapshot = null, pendingFilters = {
        data: { regex: "", selected: new Set() },
        gravidade: { regex: "", selected: new Set() },
        pin: { regex: "", selected: new Set() },
        fonte: { regex: "", selected: new Set() },
        motivo: { regex: "", selected: new Set() },
        cliente: { regex: "", selected: new Set() }
    }, pendingSort = { col: "default", dir: "desc" };
    let keydownHandler, fullscreenHandler, closeDropdownOnOutsideClick;
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
        #c04-settings-modal .c04-modal-card { width: min(1300px, 95%); padding-bottom: 60px; }
        .c04-pending-row:not(.c04-expanded) .c04-pending-collapsible {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 280px;
        }
        .c04-pending-row.c04-expanded .c04-pending-collapsible {
            white-space: normal;
            word-break: break-word;
        }
        .c04-pending-filters {
            display: flex;
            gap: 16px;
            margin-bottom: 20px;
            align-items: center;
            background: rgba(0, 0, 0, 0.15);
            padding: 12px 16px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            flex-wrap: wrap;
        }
        .c04-pending-filters label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 500;
            color: #94a3b8;
        }
        .c04-pending-filters select, .c04-pending-filters input {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #fff;
            padding: 6px 12px;
            font-size: 13px;
            outline: none;
            min-width: 140px;
            height: 34px;
            box-sizing: border-box;
        }
        .c04-pending-filters select:focus, .c04-pending-filters input:focus {
            border-color: #f97316;
        }
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
        .c04-pending-actions { display: flex; gap: 6px; flex-wrap: nowrap; align-items: center; }
        .c04-pending-actions .c04-btn { padding: 4px 8px; font-size: 11px; border-radius: 6px; height: 26px; }
        `;
        document.head.appendChild(node);
    }

    function progress(update) {
        lastProgress = Object.assign(lastProgress, update); const p = lastProgress;
        const box = document.getElementById("c04-geo-progress"), bar = document.getElementById("c04-progress-bar"), text = document.getElementById("c04-progress-text"), counters = document.getElementById("c04-progress-counters");
        if (bar) {
            bar.style.width = `${p.percent || 0}%`;
            text.textContent = p.stage || "";
            if (p.stage && p.stage.startsWith("Erro")) {
                text.style.cursor = "pointer";
                text.style.textDecoration = "underline";
                text.onclick = showLogs;
            } else {
                text.style.cursor = "default";
                text.style.textDecoration = "none";
                text.onclick = null;
            }
            counters.textContent = `Coletados ${p.collected || 0} | Existentes ${p.existing || 0} | Novos ${p.new || 0} | Alterados ${p.changed || 0} | Pendencias ${p.pending || 0} | Coord. ${p.found || 0}/${p.failed || 0} | Enviados ${p.sent || 0}`;
        }
        const headerBar = document.getElementById("c04-header-progress-bar");
        const headerText = document.getElementById("c04-header-progress-text");
        const headerCounters = document.getElementById("c04-header-progress-counters");
        if (headerBar) headerBar.style.width = `${p.percent || 0}%`;
        if (headerText) {
            headerText.textContent = p.stage || "";
            if (p.stage && p.stage.startsWith("Erro")) {
                headerText.style.cursor = "pointer";
                headerText.style.textDecoration = "underline";
                headerText.onclick = showLogs;
            } else {
                headerText.style.cursor = "default";
                headerText.style.textDecoration = "none";
                headerText.onclick = null;
            }
        }
        if (headerCounters) {
            headerCounters.textContent = `Col: ${p.collected || 0} | Ext: ${p.existing || 0} | Nov: ${p.new || 0} | Alt: ${p.changed || 0} | Pend: ${p.pending || 0} | Cor: ${p.found || 0}/${p.failed || 0} | Env: ${p.sent || 0}`;
        }
        if (box) {
            box.classList.remove("compact"); if (p.percent === 100) setTimeout(() => box.classList.add("compact"), 4000);
        }
    }
    function configFromForm() {
        const number = id => Number(document.getElementById(id).value);
        const retentionInput = document.getElementById("c04-log-retention-input");
        const logRetentionMonths = retentionInput ? Number(retentionInput.value) : 12;
        return { franchiseAverageTicket: number("c04-ticket"), weights: { recurrence: number("c04-w-rec"), ticket: number("c04-w-ticket") },
            recurrenceLimits: { excellent: number("c04-r-ex"), good: number("c04-r-good"), low: number("c04-r-low"), bad: number("c04-r-bad") },
            clusterRadius: number("c04-cluster"), heatmaps: { opacity: number("c04-opacity"), radius: number("c04-radius"), intensity: number("c04-intensity") },
            logRetentionMonths,
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
        const startVal = document.getElementById("c04-start")?.value;
        const endVal = document.getElementById("c04-end")?.value;
        let isPeriodShort = false;
        if (startVal && endVal) {
            const startD = new Date(startVal);
            const endD = new Date(endVal);
            const diffDays = Math.round((endD - startD) / (1000 * 60 * 60 * 24));
            if (diffDays < 45) {
                isPeriodShort = true;
            }
        }
        const gen = root.C04GeoCore.selectionSummary(mapped, endVal);
        const hasSel = selected && selected.length > 0;
        const sel = hasSel ? root.C04GeoCore.selectionSummary(selected, endVal) : null;
        const fmt = (val, isCurrency, isDays, isNA = false) => {
            if (isNA) return "N/A";
            if (val == null || Number.isNaN(val) || val === 0) return "-";
            if (isCurrency) return `R$ ${val.toFixed(0)}`;
            if (isDays) return `${val.toFixed(1)} d`;
            return val.toFixed(0);
        };
        const renderMetric = (label, help, genVal, selVal, isCurrency, isDays, isNA = false) => {
            const selStr = hasSel ? `<span class="c04-val-sel">${fmt(selVal, isCurrency, isDays, isNA)}</span>` : "";
            return `
                <div class="c04-summary-item">
                    <span class="c04-summary-label">${label} <span class="c04-info" title="${help}">i</span></span>
                    <span class="c04-summary-val-wrapper">
                        <span class="c04-val-general">${fmt(genVal, isCurrency, isDays, isNA)}</span>${selStr}
                     </span>
                </div>
            `;
        };
        let html = `<div class="c04-summary-grid">`;
        html += renderMetric("Clientes", "Total de clientes ativos", gen.count, sel ? sel.count : null);
        html += renderMetric("Visitas", "Quantidade total de visitas no período", gen.visits, sel ? sel.visits : null);
        html += renderMetric("Receita consumida", "Total de receita consumida no período", gen.spend, sel ? sel.spend : null, true);
        html += renderMetric("Ticket de consumo", "Média gasta por visita", gen.averageTicket, sel ? sel.averageTicket : null, true);
        html += renderMetric("Freq. mediana", "Intervalo mediano de dias entre visitas", gen.frequencyMedian, sel ? sel.frequencyMedian : null, false, true, isPeriodShort);
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
    async function run(force) {
        if (running) { runToken.cancelled = true; if (runToken.onCancel) runToken.onCancel(); progress({ stage: "Cancelando...", percent: lastProgress.percent || 0 }); return; }
        running = true; runToken = { cancelled: false, onCancel: null }; lastProgress = {}; const syncButton = document.getElementById("c04-sync");
        syncButton.textContent = "Cancelar sincronizacao"; syncButton.classList.add("danger");
        let result;
        try {
            const period = { start: document.getElementById("c04-start").value, end: document.getElementById("c04-end").value };
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (period.start > todayStr || period.end > todayStr) {
                throw new Error("Não é permitido selecionar datas futuras.");
            }
            if (period.start < "2025-02-01" || period.end < "2025-02-01") {
                throw new Error("A data mínima permitida é 01/02/2025.");
            }
            result = await root.C04GeoData.sync(period, force, progress, runToken); pending = result.pending;
            customers = root.C04GeoCore.scoreCustomers(result.periodCustomers, root.C04GeoConfig.weights, root.C04GeoConfig.franchiseAverageTicket, root.C04GeoConfig.recurrenceLimits);
            
            progress({ stage: "Renderizando mapa", percent: 80 });
            root.C04GeoMap.renderPins(customers, layerState().pins, layerState().cluster);
            root.C04GeoMap.setLayers(layerState());
            
            render();
            
            progress({ stage: "Finalizando execução", percent: 95 });
            
            await root.C04GeoSheets.finishRun({ runId: result.runId, status: "success",
                pertinent: result.sourceTotals.pertinent, accepted: result.counts.accepted, rejected: result.counts.rejected,
                mapped: customers.length, pending: pending.length, counters: result.telemetry });
            await root.C04GeoSheets.consumeRetries().catch(() => {});
            root.C04GeoSheets.cleanup({ visibleUser: visibleUser() }).catch(() => {}); progress({ stage: "Concluido", percent: 100 });
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
    function formatDuration(startedAt, finishedAt) {
        if (!startedAt || !finishedAt) return "-";
        const start = new Date(startedAt);
        const end = new Date(finishedAt);
        const diff = end - start;
        if (Number.isNaN(diff) || diff < 0) return "-";
        return `${(diff / 1000).toFixed(1)}s`;
    }
    async function showLogs() {
        const data = await root.C04GeoSheets.logs({});
        document.getElementById("c04-log-body").innerHTML = (data.executions || []).slice().reverse().map(item => {
            const startStr = item.startedAt ? root.C04GeoCore.formatBrazilianDate(item.startedAt) : "-";
            const hasTelemetry = item.telemetry && Object.keys(item.telemetry).length > 0;
            const errorMsg = item.error ? esc(item.error) : "-";
            
            let actionsHtml = "";
            if (hasTelemetry) {
                actionsHtml += `<button class="c04-btn alt c04-view-telemetry" data-id="${esc(item.runId)}" style="padding: 4px 8px; font-size: 11px; border-radius: 6px; height: 26px; margin-right: 4px;">Telemetria</button>`;
            }
            if (item.error) {
                actionsHtml += `<button class="c04-btn danger c04-view-error-tech" data-id="${esc(item.runId)}" style="padding: 4px 8px; font-size: 11px; border-radius: 6px; height: 26px;">Ver Erro</button>`;
            }
            if (!actionsHtml) actionsHtml = "-";
            
            return `<tr>
                <td>${esc(startStr)}</td>
                <td>${esc(item.type || "")}</td>
                <td><span style="font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 12px; background: rgba(255,255,255,0.05);">${esc(item.status || "")}</span></td>
                <td>${esc(item.visibleUser || "")}</td>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(item.error || "")}">${errorMsg}</td>
                <td style="text-align: right; white-space: nowrap;">
                    ${actionsHtml}
                </td>
            </tr>`;
        }).join("");

        const telemetryButtons = document.getElementById("c04-log-body").querySelectorAll(".c04-view-telemetry");
        telemetryButtons.forEach(btn => {
            btn.onclick = () => {
                const runId = btn.dataset.id;
                const run = (data.executions || []).find(r => r.runId === runId);
                if (!run || !run.telemetry) return;
                
                const t = run.telemetry;
                let html = `📊 RELATÓRIO DE TELEMETRIA DA EXECUÇÃO\n`;
                html += `==========================================\n`;
                html += `Run ID: ${run.runId}\n`;
                html += `Tipo: ${run.type}\n`;
                html += `Status: ${run.status}\n`;
                html += `Período: ${run.periodStart} a ${run.periodEnd}\n`;
                html += `Duração Total: ${formatDuration(run.startedAt, run.finishedAt)}\n\n`;
                
                html += `Breakdown por etapa:\n`;
                html += `------------------------------------------\n`;
                html += `1. Snapshot Supabase:      ${((t.sheetsSnapshotMs || 0) / 1000).toFixed(3)}s\n`;
                html += `2. Busca relcliente.php:   ${((t.salesFetchMs || 0) / 1000).toFixed(3)}s\n`;
                html += `3. Detalhes de Produtos:   ${((t.productDetailsFetchMs || 0) / 1000).toFixed(3)}s\n`;
                html += `4. Download CSV Clientes:  ${((t.csvFetchMs || 0) / 1000).toFixed(3)}s\n`;
                html += `5. Consolidação e Cruzamento: ${((t.processingMs || 0) / 1000).toFixed(3)}s\n`;
                html += `6. Geocodificação (Google): ${((t.geocodingMs || 0) / 1000).toFixed(3)}s\n`;
                html += `7. Gravação e Publicação:  ${((t.sheetsPublishMs || 0) / 1000).toFixed(3)}s\n`;
                html += `==========================================\n`;
                
                document.getElementById("c04-telemetry-content").textContent = html;
                document.getElementById("c04-telemetry-modal").classList.add("open");
            };
        });

        const errorButtons = document.getElementById("c04-log-body").querySelectorAll(".c04-view-error-tech");
        errorButtons.forEach(btn => {
            btn.onclick = () => {
                const runId = btn.dataset.id;
                const run = (data.executions || []).find(r => r.runId === runId);
                if (!run || !run.error) return;
                
                let html = `❌ DETALHES TÉCNICOS DO ERRO DA EXECUÇÃO\n`;
                html += `==========================================\n`;
                html += `Run ID: ${run.runId}\n`;
                html += `Tipo: ${run.type}\n`;
                html += `Status: ${run.status}\n`;
                html += `Período: ${run.periodStart} a ${run.periodEnd}\n`;
                html += `Duração Total: ${formatDuration(run.startedAt, run.finishedAt)}\n\n`;
                
                html += `Erro Reportado:\n`;
                html += `------------------------------------------\n`;
                html += `${run.error}\n`;
                html += `==========================================\n`;
                
                document.getElementById("c04-tech-content").textContent = html;
                document.getElementById("c04-tech-modal").classList.add("open");
            };
        });
        const modalEl = document.getElementById("c04-settings-modal");
        if (modalEl) modalEl.classList.add("open");
        document.querySelectorAll(".c04-tab,.c04-tab-panel").forEach(item => item.classList.remove("active"));
        const tabBtn = document.querySelector(`.c04-tab[data-tab="c04-tab-logs"]`);
        if (tabBtn) tabBtn.classList.add("active");
        const panel = document.getElementById("c04-tab-logs");
        if (panel) panel.classList.add("active");
    }
    const PENDING_MAP = {
        identificador_invalido: {
            motivo: "Identificador Inválido",
            solucao: "O cliente possui vendas registradas mas está sem o ID único (idPessoa). Verifique e corrija no sistema.",
            gravidade: "Crítico",
            ping: "Não"
        },
        cliente_inativo: {
            motivo: "Cadastro Inativo",
            solucao: "O cliente está marcado como Inativo no arquivo CSV de clientes. Reative o cadastro se necessário.",
            gravidade: "Crítico",
            ping: "Não"
        },
        nome_duplicado: {
            motivo: "Duplicidade de Nome",
            solucao: "Existem múltiplos cadastros com o mesmo nome e sem telefone. Adicione um telefone celular para diferenciá-los.",
            gravidade: "Crítico",
            ping: "Não"
        },
        cliente_nao_encontrado: {
            motivo: "Cadastro Não Encontrado",
            solucao: "A venda refere-se a um cliente não localizado no CSV exportado. Verifique se o nome/telefone no sistema estão corretos.",
            gravidade: "Crítico",
            ping: "Não"
        },
        endereco_ausente: {
            motivo: "Endereço Ausente",
            solucao: "O CEP ou logradouro está em branco no cadastro do cliente. Preencha os dados de endereço no sistema.",
            gravidade: "Crítico",
            ping: "Não"
        },
        fora_do_raio: {
            motivo: "Fora do Raio Limite",
            solucao: "O endereço retornado pelo Google fica muito longe da unidade. Verifique se a cidade ou estado do cadastro estão corretos.",
            gravidade: "Crítico",
            ping: "Não"
        },
        resultado_parcial: {
            motivo: "CEP ou Número Divergente",
            solucao: "O Google Maps encontrou apenas uma aproximação (número inexistente ou CEP incorreto). Corrija no cadastro.",
            gravidade: "Aviso",
            ping: "Sim"
        },
        estado_invalido: {
            motivo: "Estado Inválido",
            solucao: "O endereço geocodificado fica fora do estado cadastrado (São Paulo - SP). Corrija o estado no sistema.",
            gravidade: "Crítico",
            ping: "Não"
        },
        pais_invalido: {
            motivo: "País Inválido",
            solucao: "O endereço geocodificado fica fora do Brasil. Corrija o país ou endereço no sistema.",
            gravidade: "Crítico",
            ping: "Não"
        }
    };

    function getTechnicalDetails(item) {
        const r = item.record || {};
        const core = root.C04GeoCore;
        const inputAddr = r.customer ? `${r.customer.street || ""}, ${r.customer.number || ""}, ${r.customer.neighborhood || ""}, ${r.customer.city || ""} - ${r.customer.zip || ""}` : "";
        const foundAddr = r.formattedAddress || "não encontrado";
        const distance = typeof r.distanceKm === "number" ? `${r.distanceKm.toFixed(2)} km` : "N/A";
        
        let tech = `[Módulo GEO - Analisador Técnico]\n`;
        tech += `ID da Pendência: ${item.pendingId}\n`;
        tech += `Origem da Validação: ${item.source}\n`;
        tech += `Código de Erro (Reason): ${item.reason}\n`;
        tech += `ID do Cliente (idPessoa): ${item.idPessoa || "N/A"}\n`;
        tech += `Nome do Cliente: ${item.customerName || "N/A"}\n\n`;
        
        // 1. --- DADOS COLETADOS DO CRM (relcliente.php) ---
        tech += `--- DADOS COLETADOS DO CRM (relcliente.php) ---\n`;
        if (item.source === "Geocodificacao") {
            const cust = r.customer || {};
            tech += `ID do Cliente: ${item.idPessoa || "N/A"}\n`;
            tech += `Nome no CRM: "${r.customerName || r.Cliente || item.customerName || cust.name || "N/A"}"\n`;
            tech += `Telefone no CRM: "${core.normalizePhone(r.phone || r.Contato || cust.phone) || "N/A"}"\n`;
            const addr = [cust.street, cust.number, cust.complement, cust.neighborhood, cust.city, cust.state, cust.zip]
                .map(v => String(v || "").trim()).filter(Boolean).join(", ");
            tech += `Endereço no CRM: "${addr || "N/A"}"\n\n`;
        } else {
            const saleDateStr = r.saleDate ? core.formatBrazilianDate(r.saleDate) : (core.field(r, "date") || "N/A");
            const cleanDate = saleDateStr.split(" ")[0];
            tech += `dia analisado: ${cleanDate || "N/A"}\n`;
            tech += `ID do Cliente: ${item.idPessoa || "N/A"}\n`;
            tech += `Nome no CRM: "${r.Cliente || r.customerName || r.customer || item.customerName || "N/A"}"\n`;
            tech += `Telefone no CRM: "${core.normalizePhone(r.Contato || r.phone) || "N/A"}"\n`;
            tech += `Número de Compras: ${core.field(r, "purchases") || r.visits || "N/A"}\n`;
            tech += `Valor Consumido: ${core.field(r, "spend") || r.spend || "N/A"}\n\n`;
        }

        // 2. --- DADOS ENCONTRADOS NA PLANILHA (cliente.csv) ---
        tech += `--- DADOS ENCONTRADOS NA PLANILHA (cliente.csv) ---\n`;
        tech += `Arquivo cliente.csv carregado com sucesso.\n`;
        
        const cust = r.customer || {};
        if (cust.name || cust.idPessoa) {
            const petStr = cust.pets || cust.doguinhos || "N/A";
            const doc = cust.document || "N/A";
            const zip = cust.zip || "N/A";
            const num = cust.number || "N/A";
            const street = cust.street || "N/A";
            tech += `Correspondência ativa no Banco GEO:\n`;
            tech += `Nome: ${cust.name || "N/A"} | Tel: ${cust.phone || "N/A"} | Doc: ${doc} | CEP: ${zip} | Num: ${num} | Rua: ${street} | Pets: ${petStr}\n\n`;
        } else if (item.source === "Geocodificacao") {
            tech += `Correspondência ativa no Banco GEO: Não encontrada.\n\n`;
        }
        
        if (item.source !== "Geocodificacao") {
            if (r.csvMatches && r.csvMatches.length > 0) {
                tech += `Correspondências encontradas no CSV (${r.csvMatches.length} linha(s)):\n`;
                r.csvMatches.forEach((match, index) => {
                    const name = match.customer || match.Nome || match.nome || "N/A";
                    const phone = match.phone || match.Telefones || match.telefones || "N/A";
                    const doc = match.document || match.CPF || match.cpf || "N/A";
                    const zip = match.zip || match.CEP || match.cep || "N/A";
                    const num = match.number || match.Número || match.numero || "N/A";
                    const street = match.address || match.Rua || match.rua || "N/A";
                    const pet = match.pet || match.Animal || match.animal || "N/A";
                    tech += `Linha ${index + 1}: Nome: ${name} | Tel: ${phone} | Doc: ${doc} | CEP: ${zip} | Num: ${num} | Rua: ${street} | Pet: ${pet}\n`;
                });
                tech += `\n`;
            } else {
                tech += `Correspondência: Não encontrada no cliente.csv para Nome + Telefone correspondente.\n\n`;
            }
        }

        // 3. --- ANÁLISE DE CRUZAMENTO DE DADOS ---
        if (item.source === "Geocodificacao") {
            tech += `--- ANÁLISE DA GEOCODIFICAÇÃO ---\n`;
            tech += `Endereço no Cadastro: "${inputAddr}"\n`;
            tech += `Endereço Retornado pelo Google: "${foundAddr}"\n`;
            tech += `Distância Calculada até a Unidade: ${distance}\n`;
            tech += `Limite Máximo de Distância Permitido: ${root.C04GeoConfig.geocodeMaxDistanceKm} km\n`;
            tech += `Tipo do Erro Geográfico: ${item.reason === "fora_do_raio" ? "Endereço localizado muito distante (Fora do Raio)" :
                      item.reason === "resultado_parcial" ? "Correspondência Parcial da API do Google ou CEP divergente" :
                      item.reason === "estado_invalido" ? "Localizado fora do Estado (SP)" :
                      item.reason === "pais_invalido" ? "Localizado fora do País (Brasil)" : "Inconsistência genérica de endereço"}\n\n`;
        } else {
            tech += `--- ANÁLISE DE CRUZAMENTO DE DADOS ---\n`;
            tech += `Mensagem de Erro: "${item.message}"\n\n`;
        }

        // 4. --- REGRA APLICADA ---
        tech += `--- REGRA APLICADA ---\n`;
        if (item.source === "Geocodificacao") {
            if (item.reason === "fora_do_raio") {
                tech += `Regra: A distância entre a coordenada retornada (${distance}) e o centro configurado supera o raio limite de ${root.C04GeoConfig.geocodeMaxDistanceKm} km. O marcador é bloqueado no mapa para evitar distorções de escala.`;
            } else if (item.reason === "resultado_parcial") {
                tech += `Regra: O Google Maps retornou flag 'partial_match' como verdadeiro ou o CEP retornado no resultado não bate com o CEP digitado. Isso indica que a rua foi localizada, mas o número do imóvel ou o CEP estão incorretos no cadastro.`;
            } else if (item.reason === "estado_invalido") {
                tech += `Regra: O estado retornado pelo geocodificador não é "SP". O sistema aceita apenas endereços no estado de São Paulo.`;
            } else if (item.reason === "pais_invalido") {
                tech += `Regra: O país retornado não é "Brasil". O sistema aceita apenas endereços nacionais.`;
            }
        } else {
            if (item.reason === "identificador_invalido") {
                tech += `Regra: O registro de venda importado de relcliente.php não possui um valor para 'idPessoa'. Não é possível associar a compra a nenhuma pessoa no banco de dados.`;
            } else if (item.reason === "cliente_inativo") {
                tech += `Regra: O cliente correspondente foi localizado no CSV de clientes, mas possui a coluna 'Status' definida como 'Inativa'. O GEO ignora clientes inativos para manter as camadas analíticas focadas em clientes ativos.`;
            } else if (item.reason === "nome_duplicado") {
                tech += `Regra: A venda do cliente não possui telefone e existem múltiplos registros de clientes com o mesmo nome na base do CSV. Como não há chave de telefone ou CPF para desambiguação, o sistema gera um registro mínimo para a venda em vez de misturar dados.`;
            } else if (item.reason === "endereco_ausente") {
                tech += `Regra: O cliente foi localizado no CSV, mas o endereço está completamente em branco. Sem CEP ou Rua, o script não envia o registro para geocodificação da API do Google.`;
            } else if (item.reason === "resultado_parcial") {
                tech += `Regra: O cadastro foi localizado no CSV, mas o número do imóvel está em branco ou ausente. Para essa situação, o sistema ainda consegue posicionar o pin no centro do CEP ou da rua (Aviso), mas é recomendado preencher o número para maior precisão.`;
            } else {
                tech += `Regra: Inconsistência no cruzamento de dados. O registro de venda em relcliente.php não encontrou uma correspondência de Nome + Telefone no arquivo cliente.csv.`;
            }
        }
        tech += `\n\n`;

        // 5. --- SUGESTÃO DE RESOLUÇÃO ---
        tech += `--- SUGESTÃO DE RESOLUÇÃO ---\n`;
        if (item.source === "Geocodificacao") {
            const geoSolutions = {
                fora_do_raio: "Acesse o CRM e confira se a cidade ou estado do cliente estão corretos. Se o endereço estiver correto mas fora do raio limite, a geocodificação no mapa é bloqueada por segurança.",
                resultado_parcial: "O Google localizou a rua/bairro, mas o número do imóvel não foi exato ou o CEP está incorreto. Corrija o CEP e o número do imóvel no cadastro do CRM.",
                estado_invalido: "O endereço fica fora do estado de São Paulo (SP). Caso esteja correto e a unidade atenda fora de SP, desative esta restrição se necessário; caso contrário, altere o estado do cliente no CRM.",
                pais_invalido: "O endereço localizou fora do Brasil. Certifique-se de preencher o país/endereço nacional correto no cadastro."
            };
            tech += `Recomendação: ${geoSolutions[item.reason] || "Verifique e ajuste o endereço do cliente no CRM."}\n`;
        } else {
            const solutions = {
                identificador_invalido: "Verifique por que a venda no CRM não possui um identificador de pessoa válido.",
                cliente_inativo: "O cliente está inativo no CSV. Caso ele tenha voltado a consumir, reative seu cadastro no CRM para atualizar seu status para Ativo.",
                nome_duplicado: "Adicione um telefone celular ou CPF ao cadastro do cliente no CRM para diferenciar homônimos e permitir a vinculação correta.",
                endereco_ausente: "Acesse o cadastro do cliente no CRM e preencha o endereço completo (Rua, Número e CEP).",
                resultado_parcial: "Acesse o cadastro do cliente no CRM e preencha o número do imóvel para que a localização no mapa seja exata.",
                cliente_nao_encontrado: "Verifique se o cadastro existe no CRM e se os campos de Nome e Telefone coincidem exatamente com o registro de venda."
            };
            tech += `Recomendação: ${solutions[item.reason] || "Ajuste o cadastro do cliente no CRM conforme a mensagem de erro do sistema."}\n`;
        }
        return tech;
    }

    async function showPendings() {
        try {
            const [rows, snapshot] = await Promise.all([
                root.C04GeoSheets.pendings({}),
                root.C04GeoSheets.snapshot()
            ]);
            currentPendings = rows;
            currentSnapshot = snapshot;
            renderPendingTable();
        } catch (error) {
            alert(`Falha ao carregar dados: ${error.message}`);
            return;
        }
        
        const modalEl = document.getElementById("c04-settings-modal");
        if (modalEl) modalEl.classList.add("open");
        document.querySelectorAll(".c04-tab,.c04-tab-panel").forEach(item => item.classList.remove("active"));
        const tabBtn = document.querySelector(`.c04-tab[data-tab="c04-tab-pendings"]`);
        if (tabBtn) tabBtn.classList.add("active");
        const panel = document.getElementById("c04-tab-pendings");
        if (panel) panel.classList.add("active");
    }

    function getColValue(item, col) {
        const info = PENDING_MAP[item.reason] || {
            motivo: item.reason || "Não Mapeado",
            solucao: "Analise os detalhes técnicos no botão avançado para identificar a inconsistência no cadastro.",
            gravidade: "Crítico",
            ping: "Não"
        };
        if (col === "data") {
            const date = item.createdAt ? new Date(item.createdAt) : null;
            const pad = n => String(n).padStart(2, "0");
            return date && !Number.isNaN(date.getTime()) ?
                `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
        }
        if (col === "gravidade") return info.gravidade || "Crítico";
        if (col === "pin") return info.ping || "Não";
        if (col === "fonte") return item.source || "";
        if (col === "motivo") return info.motivo || item.reason || "Não Mapeado";
        if (col === "cliente") return item.customerName || "";
        return "";
    }

    function renderPendingTable() {
        const status = document.getElementById("c04-pending-status").value;
        const body = document.getElementById("c04-pending-body");
        if (!body) return;
        
        // Reset header select-all and count
        const selectAllCheckbox = document.getElementById("c04-pending-select-all");
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        const counter = document.getElementById("c04-pending-selected-count");
        if (counter) counter.textContent = "Selecionados: 0";

        // Filter rows
        const filtered = currentPendings.filter(item => {
            if (status && (item.status || "open") !== status) return false;
            for (const col of Object.keys(pendingFilters)) {
                const val = getColValue(item, col);
                const filter = pendingFilters[col];
                if (filter.regex) {
                    try {
                        const regex = new RegExp(filter.regex, "i");
                        if (!regex.test(val)) return false;
                    } catch (e) {
                        if (!String(val).toLowerCase().includes(filter.regex.toLowerCase())) return false;
                    }
                }
                if (filter.selected && filter.selected.size > 0) {
                    if (!filter.selected.has(String(val).trim())) return false;
                }
            }
            return true;
        });

        // Sort rows
        filtered.sort((a, b) => {
            if (pendingSort.col === "default") {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (dateA !== dateB) return dateB - dateA;
                const gravA = PENDING_MAP[a.reason]?.gravidade || "Crítico";
                const gravB = PENDING_MAP[b.reason]?.gravidade || "Crítico";
                const wA = gravA === "Crítico" ? 3 : (gravA === "Aviso" ? 2 : 1);
                const wB = gravB === "Crítico" ? 3 : (gravB === "Aviso" ? 2 : 1);
                return wB - wA;
            }
            const valA = getColValue(a, pendingSort.col);
            const valB = getColValue(b, pendingSort.col);
            let cmp = 0;
            if (pendingSort.col === "data") {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                cmp = dateA - dateB;
            } else {
                cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
            }
            return pendingSort.dir === "desc" ? -cmp : cmp;
        });

        // Update header sort indicators
        document.querySelectorAll("#c04-tab-pendings th.c04-sortable").forEach(th => {
            const col = th.dataset.col;
            const indicator = th.querySelector(".c04-sort-indicator");
            if (indicator) {
                if (pendingSort.col === col) {
                    indicator.textContent = pendingSort.dir === "desc" ? " ▼" : " ▲";
                } else if (pendingSort.col === "default" && col === "data") {
                    indicator.textContent = " ▼";
                } else {
                    indicator.textContent = "";
                }
            }
        });

        // Render HTML
        body.innerHTML = filtered.map(item => {
            const info = PENDING_MAP[item.reason] || {
                motivo: item.reason || "Não Mapeado",
                solucao: "Analise os detalhes técnicos no botão avançado."
            };
            const dateVal = getColValue(item, "data");
            const gravidade = info.gravidade || "Crítico";
            const ping = info.ping || "Não";
            const gravidadeColor = gravidade === "Crítico" ? "#ef4444" : gravidade === "Aviso" ? "#eab308" : "#3b82f6";
            const pingColor = ping.startsWith("Sim") ? "#10b981" : "#ef4444";
            
            let advButtonsHtml = `<button class="c04-btn alt c04-open-tech" data-id="${esc(item.pendingId)}" style="padding: 4px 8px; font-size: 11px; border-radius: 6px; height: 26px;">Ver Técnico</button>`;
            if (item.status === "open") {
                advButtonsHtml += `<button class="c04-btn alt c04-resolve" data-id="${esc(item.pendingId)}" style="padding: 4px 8px; font-size: 11px; border-radius: 6px; height: 26px; margin-left: 4px;">Tratar</button>`;
            } else {
                advButtonsHtml += `<button class="c04-btn alt c04-reopen" data-id="${esc(item.pendingId)}" style="padding: 4px 8px; font-size: 11px; border-radius: 6px; height: 26px; margin-left: 4px;">Reabrir</button>`;
            }
            
            const clientRedirectSvg = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px; vertical-align: middle;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
            const clientHtml = item.idPessoa ? 
                `<a class="c04-open-person" data-person="${esc(item.idPessoa)}" style="color: #38bdf8; text-decoration: none; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center;">${esc(item.customerName || "")}${clientRedirectSvg}</a>` :
                `<span style="color: #f8fafc; font-weight: 600;">${esc(item.customerName || "")}</span>`;

            return `<tr class="c04-pending-row">
                <td style="text-align: center;" onclick="event.stopPropagation();"><input type="checkbox" class="c04-pending-select" data-id="${esc(item.pendingId)}" data-person="${esc(item.idPessoa || "")}"></td>
                <td style="white-space: nowrap; color: #94a3b8; font-size: 11px;">${esc(dateVal)}</td>
                <td><span style="font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 12px; background: rgba(255,255,255,0.05); color: ${gravidadeColor}; border: 1px solid ${gravidadeColor}44; display: inline-block;">${gravidade}</span></td>
                <td><span style="font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 12px; background: rgba(255,255,255,0.05); color: ${pingColor}; border: 1px solid ${pingColor}44; display: inline-block;">${ping}</span></td>
                <td style="color: #cbd5e1; font-weight: 500;">${esc(item.source || "")}</td>
                <td style="color: #fb923c; font-weight: 600; font-size: 12px;">${esc(info.motivo)}</td>
                <td>${clientHtml}</td>
                <td style="color: #cbd5e1; font-size: 12px; max-width: 280px;"><div class="c04-pending-collapsible">${esc(info.solucao)}</div></td>
                <td><div style="display: flex; align-items: center;">${advButtonsHtml}</div></td>
            </tr>`;
        }).join("");

        body.querySelectorAll(".c04-pending-row").forEach(row => {
            row.style.cursor = "pointer";
            row.onclick = (e) => {
                if (e.target.closest("button") || e.target.closest("a") || e.target.closest("input[type=checkbox]")) return;
                row.classList.toggle("c04-expanded");
            };
        });
        body.querySelectorAll(".c04-open-person").forEach(link => { 
            link.onclick = (e) => {
                e.preventDefault();
                openPersonRegistration(link.dataset.person);
            }; 
        });
        body.querySelectorAll(".c04-resolve").forEach(button => { 
            button.onclick = () => resolvePending(button.dataset.id); 
        });
        body.querySelectorAll(".c04-reopen").forEach(button => { 
            button.onclick = async () => {
                const justification = prompt("Justificativa para reabrir:"); 
                if (!justification) return;
                await root.C04GeoSheets.reopenPending({ pendingId: button.dataset.id, visibleUser: visibleUser(), justification }); 
                showPendings();
            }; 
        });
        body.querySelectorAll(".c04-open-tech").forEach(button => { 
            button.onclick = () => {
                const pendingId = button.dataset.id;
                const item = currentPendings.find(r => r.pendingId === pendingId);
                if (!item) return;
                if (item.idPessoa && currentSnapshot) {
                    const cust = currentSnapshot.customers.find(c => String(c.idPessoa) === String(item.idPessoa));
                    if (cust) {
                        const geo = cust.idLocalizacao ? currentSnapshot.geocodes.find(g => Number(g.idLocalizacao) === Number(cust.idLocalizacao)) : null;
                        if (!item.record) item.record = {};
                        if (!item.record.customer) {
                            item.record.customer = {
                                idPessoa: cust.idPessoa,
                                name: cust.name,
                                phone: cust.phone,
                                document: cust.document,
                                status: cust.status,
                                pets: cust.doguinhos || cust.pets,
                                doguinhos: cust.doguinhos,
                                idLocalizacao: cust.idLocalizacao,
                                street: geo ? geo.rua || geo.street : "",
                                number: geo ? geo.numero || geo.number : "",
                                neighborhood: geo ? geo.bairro || geo.neighborhood : "",
                                city: geo ? geo.cidade || geo.city : "",
                                state: geo ? geo.estado || geo.state : "",
                                zip: geo ? geo.cep || geo.zip : "",
                                country: geo ? geo.pais || geo.country : "Brasil"
                            };
                        }
                    }
                }
                const content = document.getElementById("c04-tech-content");
                content.textContent = getTechnicalDetails(item);
                document.getElementById("c04-tech-modal").classList.add("open");
            }; 
        });
        
        const updateSelectedCount = () => {
            const checked = body.querySelectorAll(".c04-pending-select:checked").length;
            const counter = document.getElementById("c04-pending-selected-count");
            if (counter) counter.textContent = `Selecionados: ${checked}`;
        };
        body.querySelectorAll(".c04-pending-select").forEach(cb => {
            cb.onchange = updateSelectedCount;
        });
    }

    function getOrCreateFilterDropdown() {
        let dropdown = document.getElementById("c04-pending-filter-dropdown");
        if (!dropdown) {
            dropdown = document.createElement("div");
            dropdown.id = "c04-pending-filter-dropdown";
            dropdown.style.cssText = `
                position: absolute;
                z-index: 100000;
                background: #1e293b;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
                padding: 12px;
                width: 250px;
                display: none;
                flex-direction: column;
                gap: 8px;
            `;
            dropdown.innerHTML = `
                <div style="font-weight: 600; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between; align-items: center;">
                    <span>Filtrar Coluna</span>
                    <span id="c04-pending-filter-close" style="cursor: pointer; font-size: 14px; font-weight: bold; color: #ef4444;">&times;</span>
                </div>
                <div>
                    <input type="text" id="c04-pending-filter-regex" placeholder="Filtrar por RegEx/Texto" style="width: 100%; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #fff; padding: 6px; font-size: 12px; outline: none;">
                </div>
                <div style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 4px;">Valores únicos:</div>
                <div id="c04-pending-filter-values" style="max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; border: 1px solid rgba(255,255,255,0.05); padding: 6px; border-radius: 6px; background: rgba(0,0,0,0.1);">
                </div>
                <div style="display: flex; gap: 8px; margin-top: 4px;">
                    <button class="c04-btn" id="c04-pending-filter-apply" style="flex: 1; padding: 4px 8px; font-size: 11px; height: 26px; border-radius: 6px;">Aplicar</button>
                    <button class="c04-btn alt" id="c04-pending-filter-clear" style="flex: 1; padding: 4px 8px; font-size: 11px; height: 26px; border-radius: 6px;">Limpar</button>
                </div>
            `;
            document.getElementById("c04-geo-panel").appendChild(dropdown);
            dropdown.querySelector("#c04-pending-filter-close").onclick = () => { dropdown.style.display = "none"; };
        }
        return dropdown;
    }

    function openFilterDropdown(triggerEl, col) {
        const dropdown = getOrCreateFilterDropdown();
        const panelRect = document.getElementById("c04-geo-panel").getBoundingClientRect();
        const triggerRect = triggerEl.getBoundingClientRect();
        let left = triggerRect.left - panelRect.left;
        let top = triggerRect.bottom - panelRect.top + 4;
        if (left + 250 > panelRect.width) {
            left = panelRect.width - 260;
        }
        dropdown.style.left = `${left}px`;
        dropdown.style.top = `${top}px`;
        dropdown.style.display = "flex";

        const regexInput = dropdown.querySelector("#c04-pending-filter-regex");
        regexInput.value = pendingFilters[col]?.regex || "";

        const valuesContainer = dropdown.querySelector("#c04-pending-filter-values");
        valuesContainer.innerHTML = "";

        const uniqueValuesSet = new Set();
        currentPendings.forEach(item => {
            const val = getColValue(item, col);
            if (val !== undefined && val !== null) {
                uniqueValuesSet.add(String(val).trim());
            }
        });
        const uniqueValues = Array.from(uniqueValuesSet).sort((a, b) => a.localeCompare(b));
        const selectedSet = pendingFilters[col]?.selected || new Set();

        if (uniqueValues.length === 0) {
            valuesContainer.innerHTML = `<div style="color: #64748b; font-size: 11px; text-align: center; padding: 4px;">Nenhum valor</div>`;
        } else {
            uniqueValues.forEach(val => {
                const label = document.createElement("label");
                label.style.cssText = "display: flex; align-items: center; gap: 6px; font-size: 11px; color: #cbd5e1; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
                const isChecked = selectedSet.has(val) ? "checked" : "";
                label.innerHTML = `<input type="checkbox" class="c04-pending-value-opt" value="${esc(val)}" ${isChecked}> <span>${esc(val)}</span>`;
                valuesContainer.appendChild(label);
            });
        }

        dropdown.querySelector("#c04-pending-filter-apply").onclick = () => {
            const regexVal = regexInput.value.trim();
            const selectedOpts = Array.from(valuesContainer.querySelectorAll(".c04-pending-value-opt:checked")).map(cb => cb.value);
            pendingFilters[col] = {
                regex: regexVal,
                selected: new Set(selectedOpts)
            };
            const isActive = regexVal !== "" || selectedOpts.length > 0;
            triggerEl.style.color = isActive ? "#fb923c" : "#64748b";
            triggerEl.style.fontWeight = isActive ? "bold" : "normal";
            dropdown.style.display = "none";
            renderPendingTable();
        };

        dropdown.querySelector("#c04-pending-filter-clear").onclick = () => {
            pendingFilters[col] = {
                regex: "",
                selected: new Set()
            };
            triggerEl.style.color = "#64748b";
            triggerEl.style.fontWeight = "normal";
            dropdown.style.display = "none";
            renderPendingTable();
        };
    }

    function handleReescanClick() {
        const body = document.getElementById("c04-pending-body");
        if (!body) return;
        const checkboxes = body.querySelectorAll(".c04-pending-select:checked");
        let pendingIds = Array.from(checkboxes).map(cb => cb.dataset.id);
        if (pendingIds.length === 0) {
            const openPendings = currentPendings.filter(p => (p.status || "open") === "open");
            pendingIds = openPendings.map(p => p.pendingId);
        }
        if (pendingIds.length === 0) {
            alert("Nenhuma pendência aberta para re-scan.");
            return;
        }
        if (pendingIds.length > 5) {
            if (!confirm(`Deseja executar re-scan de ${pendingIds.length} pendências?`)) {
                return;
            }
        }
        retryPendings(pendingIds);
    }

    function setupPendingTabBindings() {
        const selectAllCheckbox = document.getElementById("c04-pending-select-all");
        if (selectAllCheckbox) {
            selectAllCheckbox.onchange = () => {
                const body = document.getElementById("c04-pending-body");
                if (body) {
                    body.querySelectorAll(".c04-pending-select").forEach(cb => {
                        cb.checked = selectAllCheckbox.checked;
                    });
                    const checked = body.querySelectorAll(".c04-pending-select:checked").length;
                    const counter = document.getElementById("c04-pending-selected-count");
                    if (counter) counter.textContent = `Selecionados: ${checked}`;
                }
            };
        }

        const bulkOpen = document.getElementById("c04-pending-bulk-open");
        if (bulkOpen) {
            bulkOpen.onclick = () => {
                const body = document.getElementById("c04-pending-body");
                if (!body) return;
                const checkboxes = body.querySelectorAll(".c04-pending-select:checked");
                const idPessoas = Array.from(checkboxes).map(cb => cb.dataset.person).filter(id => !!id);
                if (idPessoas.length === 0) {
                    alert("Nenhuma pendência selecionada possui idPessoa.");
                    return;
                }
                if (idPessoas.length > 5 && !confirm(`Deseja abrir ${idPessoas.length} cadastros de uma vez? Isso pode abrir muitas abas no seu navegador.`)) {
                    return;
                }
                idPessoas.forEach(id => openPersonRegistration(id));
            };
        }
        
        const bulkResolve = document.getElementById("c04-pending-bulk-resolve");
        if (bulkResolve) {
            bulkResolve.onclick = async () => {
                const body = document.getElementById("c04-pending-body");
                if (!body) return;
                const checkboxes = body.querySelectorAll(".c04-pending-select:checked");
                const pendingIds = Array.from(checkboxes).map(cb => cb.dataset.id);
                if (pendingIds.length === 0) {
                    alert("Nenhuma pendência selecionada.");
                    return;
                }
                const action = prompt("Ação para as pendências selecionadas: resolve, retry_geocode ou ignore", "resolve");
                if (!["resolve", "retry_geocode", "ignore"].includes(action)) return;
                
                const justification = prompt(`Justificativa obrigatória para tratar ${pendingIds.length} pendências:`);
                if (!justification) return;
                
                try {
                    await Promise.all(pendingIds.map(pendingId => 
                        root.C04GeoSheets.resolvePending({
                            pendingId,
                            action,
                            correctedIdPessoa: "",
                            correctedAddress: "",
                            visibleUser: visibleUser(),
                            justification
                        })
                    ));
                    alert(`${pendingIds.length} pendências tratadas com sucesso.`);
                } catch (error) {
                    alert(`Erro ao tratar pendências: ${error.message}`);
                }
                showPendings();
            };
        }
        
        const reescanBtn = document.getElementById("c04-pending-reescan");
        if (reescanBtn) {
            reescanBtn.onclick = handleReescanClick;
        }

        const pendingStatus = document.getElementById("c04-pending-status");
        if (pendingStatus) {
            pendingStatus.onchange = renderPendingTable;
        }

        // Setup sort headers
        document.querySelectorAll("#c04-tab-pendings th.c04-sortable").forEach(th => {
            th.onclick = (e) => {
                if (e.target.classList.contains("c04-filter-trigger")) {
                    e.stopPropagation();
                    const col = th.dataset.col;
                    openFilterDropdown(e.target, col);
                    return;
                }
                const col = th.dataset.col;
                if (pendingSort.col === col) {
                    pendingSort.dir = pendingSort.dir === "asc" ? "desc" : "asc";
                } else {
                    pendingSort.col = col;
                    pendingSort.dir = "asc";
                }
                renderPendingTable();
            };
        });

        // Close dropdown when clicking outside
        closeDropdownOnOutsideClick = (e) => {
            const dropdown = document.getElementById("c04-pending-filter-dropdown");
            if (dropdown && dropdown.style.display === "flex") {
                const isClickInside = dropdown.contains(e.target) || e.target.classList.contains("c04-filter-trigger");
                if (!isClickInside) {
                    dropdown.style.display = "none";
                }
            }
        };
        document.addEventListener("click", closeDropdownOnOutsideClick);
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
    async function retryPendings(pendingIds) {
        if (!pendingIds || pendingIds.length === 0) return;
        
        const syncButton = document.getElementById("c04-sync");
        const originalText = syncButton.textContent;
        syncButton.textContent = "Testando...";
        syncButton.disabled = true;
        
        try {
            root.C04GeoData._csvCache = null;
            const csvText = await root.C04GeoData.collectCustomersCsv({ cancelled: false });
            const csvRows = root.C04GeoCore.parseCsv(csvText);
            
            const allPendings = await root.C04GeoSheets.pendings({});
            const snapshot = await root.C04GeoSheets.snapshot();
            
            let resolvedCount = 0;
            let updatedCount = 0;
            
            for (const pendingId of pendingIds) {
                const p = allPendings.find(item => item.pendingId === pendingId);
                if (!p || !p.record) continue;
                
                const idPessoa = p.idPessoa;
                const sale = p.record;
                
                const sales = [sale];
                const details = new Map([[String(idPessoa), sale.products || []]]);
                
                const built = root.C04GeoData.buildRelevantCustomers(sales, details, csvRows, snapshot.overrides || []);
                
                if (built.pending && built.pending.length > 0) {
                    const newPending = built.pending[0];
                    await root.C04GeoSheets.stageBatch({
                        pendings: [{
                            pendingId: p.pendingId,
                            source: newPending.source,
                            reason: newPending.reason,
                            idPessoa: p.idPessoa,
                            customerName: p.customerName,
                            message: newPending.message,
                            status: "open",
                            record: sale,
                            createdAt: new Date().toISOString()
                        }]
                    });
                    updatedCount++;
                    continue;
                }
                
                if (built.persistentCustomers && built.persistentCustomers.length > 0) {
                    const customer = built.persistentCustomers[0];
                    const geoResult = await root.C04GeoMap.geocode(
                        [customer],
                        snapshot.geocodes,
                        () => {},
                        { cancelled: false },
                        { forceFailed: true }
                    );
                    
                    if (geoResult.rows && geoResult.rows.length > 0) {
                        await root.C04GeoSheets.stageBatch({
                            customers: [customer],
                            geocodes: geoResult.rows
                        });
                    }
                    
                    if (geoResult.customers.length === 0) {
                        const newReject = geoResult.rejected[0];
                        let msg = `Resultado rejeitado.`;
                        if (newReject) {
                            const inputAddr = `${newReject.customer.street || ""}, ${newReject.customer.number || ""}, ${newReject.customer.neighborhood || ""}, ${newReject.customer.city || ""} - ${newReject.customer.zip || ""}`;
                            const foundAddr = newReject.formattedAddress || "não encontrado";
                            msg = `Resultado rejeitado (${newReject.distanceKm ? newReject.distanceKm.toFixed(1) : 0} km). Erro: ${newReject.reason}.\n• Cadastrado: "${inputAddr}"\n• Encontrado: "${foundAddr}"`;
                        }
                        
                        await root.C04GeoSheets.stageBatch({
                            pendings: [{
                                pendingId: p.pendingId,
                                source: "Geocodificacao",
                                reason: newReject ? newReject.reason : "erro_geocodificacao",
                                idPessoa: p.idPessoa,
                                customerName: p.customerName,
                                message: msg,
                                status: "open",
                                record: sale,
                                createdAt: new Date().toISOString()
                            }]
                        });
                        updatedCount++;
                    } else {
                        const newWarning = geoResult.rejected.find(r => r.isWarning);
                        
                        if (newWarning) {
                            const inputAddr = `${newWarning.customer.street || ""}, ${newWarning.customer.number || ""}, ${newWarning.customer.neighborhood || ""}, ${newWarning.customer.city || ""} - ${newWarning.customer.zip || ""}`;
                            const foundAddr = newWarning.formattedAddress || "não encontrado";
                            const msg = `Alerta de geocodificação (${newWarning.reason}).\n• Cadastrado: "${inputAddr}"\n• Encontrado: "${foundAddr}"`;
                            
                            await root.C04GeoSheets.stageBatch({
                                pendings: [{
                                    pendingId: p.pendingId,
                                    source: "Geocodificacao",
                                    reason: newWarning.reason,
                                    idPessoa: p.idPessoa,
                                    customerName: p.customerName,
                                    message: msg,
                                    status: "open",
                                    record: sale,
                                    createdAt: new Date().toISOString()
                                }]
                            });
                            updatedCount++;
                        } else {
                            await root.C04GeoSheets.resolvePending({
                                pendingId: p.pendingId,
                                action: "resolve",
                                visibleUser: visibleUser(),
                                justification: "Sincronizado e geocodificado com sucesso via re-scan individual."
                            });
                            resolvedCount++;
                        }
                        
                        const geocodedCust = geoResult.customers[0];
                        const idx = customers.findIndex(c => String(c.idPessoa) === String(idPessoa));
                        if (idx !== -1) {
                            customers[idx] = Object.assign({}, customers[idx], geocodedCust);
                        } else {
                            customers.push(geocodedCust);
                        }
                    }
                }
            }
            
            render();
            await showPendings();
            
            alert(`Re-scan concluído!\nResolvido: ${resolvedCount} pendência(s)\nAtualizado: ${updatedCount} pendência(s) com erros/avisos.`);
        } catch (error) {
            alert(`Erro durante o re-scan das pendências: ${error.message}`);
        } finally {
            syncButton.textContent = originalText;
            syncButton.disabled = false;
        }
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
    root.c04OpenPersonRegistration = openPersonRegistration;
    async function diagnostic(action) {
        const node = document.getElementById("c04-diagnostic-result"); node.innerHTML = "<p>Executando...</p>";
        try { showDiagnostic(action, await root.C04GeoSheets[action]()); }
        catch (error) { node.textContent = `Erro: ${error.message}`; }
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
        const node = document.getElementById("c04-diagnostic-result");
        if (!node) return;
        node.innerHTML = "<p>Executando diagnóstico geral do Supabase (conexão, escrita, integridade e tamanho físico)...</p>";
        try {
            let connectionOk = false, writeOk = false, integrityOk = false, dbSizeData = null;
            let connectionDetail = "", writeDetail = "", integrityDetail = "", dbSizeDetail = "";
            
            try {
                const res = await root.C04GeoSheets.healthCheck();
                connectionOk = res.ok;
                connectionDetail = JSON.stringify(res, null, 2);
            } catch (e) {
                connectionDetail = e.message;
            }

            try {
                const res = await root.C04GeoSheets.testWrite();
                writeOk = res.ok;
                writeDetail = JSON.stringify(res, null, 2);
            } catch (e) {
                writeDetail = e.message;
            }

            try {
                const res = await root.C04GeoSheets.testStaging();
                integrityOk = res.ok;
                integrityDetail = JSON.stringify(res, null, 2);
            } catch (e) {
                integrityDetail = e.message;
            }

            try {
                const res = await root.C04GeoSheets.getDbSize();
                dbSizeData = res;
                dbSizeDetail = JSON.stringify(res, null, 2);
            } catch (e) {
                dbSizeDetail = e.message;
            }

            const formatSize = bytes => {
                if (!bytes || Number.isNaN(bytes)) return "0 B";
                const k = 1024;
                const sizes = ["B", "KB", "MB", "GB"];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
            };

            const dbSizeBytes = dbSizeData ? Number(dbSizeData.database_size_bytes) : 0;
            const dbSizeStr = formatSize(dbSizeBytes);
            const dbLimitStr = "500 MB";
            const dbPercent = dbSizeBytes ? ((dbSizeBytes / (500 * 1024 * 1024)) * 100).toFixed(2) : "0";

            let tableRowsHtml = "";
            if (dbSizeData && dbSizeData.table_sizes) {
                for (const [table, size] of Object.entries(dbSizeData.table_sizes)) {
                    tableRowsHtml += `<li><b>${table}:</b> ${formatSize(Number(size))}</li>`;
                }
            }

            const okBadge = '<span style="color:#10b981;font-weight:bold;">[OK]</span>';
            const failBadge = '<span style="color:#ef4444;font-weight:bold;">[FALHA]</span>';

            node.innerHTML = `
                <div class="c04-diagnostic-card ok" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 16px;">
                    <h5 style="margin-top:0;font-size:14px;color:#fb923c;margin-bottom:10px;">Relatório de Diagnóstico Consolidado</h5>
                    
                    <ul style="list-style:none;padding:0;margin:0 0 12px;font-size:12px;line-height:1.8;">
                        <li>📡 <b>Conexão Supabase:</b> ${connectionOk ? okBadge : failBadge}</li>
                        <li>✍️ <b>Teste de Escrita:</b> ${writeOk ? okBadge : failBadge}</li>
                        <li>🔍 <b>Integridade de Tabelas:</b> ${integrityOk ? okBadge : failBadge}</li>
                        <li>💾 <b>Armazenamento Físico:</b> <strong>${dbSizeStr}</strong> de <strong>${dbLimitStr}</strong> (${dbPercent}%)</li>
                        <li>📋 <b>Logs de Execução:</b> ${dbSizeData ? dbSizeData.log_count : 0} registros (${formatSize(dbSizeData ? dbSizeData.log_size_bytes : 0)})</li>
                        <li>📦 <b>Backups de Segurança:</b> ${dbSizeData ? dbSizeData.backup_count : 0} salvos (${formatSize(dbSizeData ? dbSizeData.backup_size_bytes : 0)})</li>
                    </ul>
                    
                    <details style="margin-bottom:8px;font-size:11px;">
                        <summary style="cursor:pointer;color:#fb923c;font-weight:bold;">Tamanhos Detalhados das Tabelas</summary>
                        <ul style="padding-left:16px;margin-top:4px;">
                            ${tableRowsHtml || "<li>Sem dados de tabelas</li>"}
                        </ul>
                    </details>
                    
                    <details style="font-size:11px;">
                        <summary style="cursor:pointer;color:#cbd5e1;">Logs Técnicos Completos (JSON)</summary>
                        <pre style="background:rgba(0,0,0,0.3);padding:8px;border-radius:4px;overflow-x:auto;margin-top:4px;white-space:pre-wrap;text-align:left;">
Conexão:\n${connectionDetail}\n\nEscrita:\n${writeDetail}\n\nIntegridade:\n${integrityDetail}\n\nArmazenamento:\n${dbSizeDetail}
                        </pre>
                    </details>
                </div>
            `;
        } catch (error) {
            node.innerHTML = `<div class="c04-diagnostic-card error"><b>Erro Geral de Diagnóstico:</b><p>${error.message}</p></div>`;
        }
    }

    async function loadBackupsList() {
        const body = document.getElementById("c04-backup-list-body");
        if (!body) return;
        try {
            const backups = await root.C04GeoSheets.getBackups();
            if (!backups || backups.length === 0) {
                body.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 12px;">Nenhum backup encontrado.</td></tr>`;
                return;
            }
            
            const formatSize = bytes => {
                if (!bytes) return "0 B";
                const k = 1024;
                const sizes = ["B", "KB", "MB"];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
            };
            
            body.innerHTML = backups.map(b => {
                const date = b.createdAt ? new Date(b.createdAt) : null;
                const pad = n => String(n).padStart(2, "0");
                const dateStr = date && !Number.isNaN(date.getTime()) ?
                    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
                
                return `<tr>
                    <td>${esc(dateStr)}</td>
                    <td>${formatSize(b.sizeBytes)}</td>
                    <td>${esc(b.visibleUser || "")}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="c04-btn alt c04-restore-backup" data-id="${esc(b.backupId)}" style="padding: 4px 8px; font-size: 11px; border-radius: 6px; height: 26px; margin-right: 4px; background: #065f46; border-color: #065f46; color:#fff;">Restaurar</button>
                        <button class="c04-btn danger c04-delete-backup" data-id="${esc(b.backupId)}" style="padding: 4px 8px; font-size: 11px; border-radius: 6px; height: 26px; background: #991b1b; border-color: #991b1b;">Deletar</button>
                    </td>
                </tr>`;
            }).join("");
            
            body.querySelectorAll(".c04-restore-backup").forEach(btn => {
                btn.onclick = async () => {
                    const backupId = btn.dataset.id;
                    if (!root.confirm("ATENÇÃO: Deseja realmente restaurar este backup? Isso substituirá todos os dados atuais das tabelas do GEO (clientes, geocodes, vendas, pendências, etc.) pelos dados do backup. Essa ação é irreversível!")) {
                        return;
                    }
                    btn.disabled = true;
                    btn.textContent = "Restaurando...";
                    try {
                        await root.C04GeoSheets.restoreBackup({ backupId, visibleUser: visibleUser() });
                        alert("Backup restaurado com sucesso!");
                        if (customers.length) run(false);
                    } catch (e) {
                        alert(`Erro ao restaurar backup: ${e.message}`);
                    } finally {
                        btn.disabled = false;
                        btn.textContent = "Restaurar";
                        loadBackupsList();
                    }
                };
            });
            
            body.querySelectorAll(".c04-delete-backup").forEach(btn => {
                btn.onclick = async () => {
                    const backupId = btn.dataset.id;
                    if (!root.confirm("Deseja realmente deletar permanentemente este backup de segurança?")) {
                        return;
                    }
                    btn.disabled = true;
                    try {
                        await root.C04GeoSheets.deleteBackup({ backupId, visibleUser: visibleUser() });
                        alert("Backup deletado com sucesso!");
                    } catch (e) {
                        alert(`Erro ao deletar backup: ${e.message}`);
                    } finally {
                        loadBackupsList();
                    }
                };
            });
        } catch (e) {
            body.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444; padding: 12px;">Erro ao carregar backups: ${e.message}</td></tr>`;
        }
    }
    
    async function createManualBackup() {
        const btn = document.getElementById("c04-create-manual-backup");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Criando...";
        }
        try {
            await root.C04GeoSheets.createBackup({ visibleUser: visibleUser() });
            alert("Backup manual de segurança criado com sucesso!");
            loadBackupsList();
        } catch (e) {
            alert(`Erro ao criar backup: ${e.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Criar Backup Manual";
            }
        }
    }

    async function saveRetentionSetting() {
        const retentionInput = document.getElementById("c04-log-retention-input");
        const logRetentionMonths = retentionInput ? Number(retentionInput.value) : 12;
        root.C04GeoConfig.logRetentionMonths = logRetentionMonths;
        const cfg = configFromForm();
        cfg.logRetentionMonths = logRetentionMonths;
        try {
            await root.C04GeoSheets.saveSettings(cfg);
            alert("Regra de retenção de logs salva com sucesso!");
        } catch (e) {
            alert(`Erro ao salvar regra: ${e.message}`);
        }
    }

    async function pruneLogsNow() {
        const retentionInput = document.getElementById("c04-log-retention-input");
        const retentionMonths = retentionInput ? Number(retentionInput.value) : 12;
        const node = document.getElementById("c04-diagnostic-result");
        if (node) node.innerHTML = `<p>Executando limpeza de logs anteriores a ${retentionMonths} meses...</p>`;
        try {
            await root.C04GeoSheets.cleanup({ retentionMonths, visibleUser: visibleUser() });
            if (node) node.innerHTML = `<div class='c04-diagnostic-card ok'><b>Limpeza de Logs: OK</b><p>Limpeza concluída com sucesso (retidos últimos ${retentionMonths} meses).</p></div>`;
            generalDiagnostic(); // Refresh size info
        } catch (e) {
            if (node) node.innerHTML = `<div class='c04-diagnostic-card error'><b>Erro na limpeza:</b><p>${e.message}</p></div>`;
        }
    }

    async function clearAllLogs() {
        if (!root.confirm("ATENÇÃO: Deseja realmente excluir permanentemente TODOS os logs de execução? Essa ação não pode ser desfeita!")) {
            return;
        }
        const node = document.getElementById("c04-diagnostic-result");
        if (node) node.innerHTML = "<p>Excluindo todos os logs...</p>";
        try {
            await root.C04GeoSheets.resetDatabase({ confirmation: "LIMPAR BANCO GEO", tables: ["c04_logs"], visibleUser: visibleUser() });
            if (node) node.innerHTML = "<div class='c04-diagnostic-card ok'><b>Limpeza Total: OK</b><p>Todos os logs foram apagados com sucesso.</p></div>";
            generalDiagnostic();
        } catch (e) {
            if (node) node.innerHTML = `<div class='c04-diagnostic-card error'><b>Erro ao apagar logs:</b><p>${e.message}</p></div>`;
        }
    }

    function showDiagnosticsTab() {
        document.querySelectorAll(".c04-tab,.c04-tab-panel").forEach(item => item.classList.remove("active"));
        const tabBtn = document.querySelector(`.c04-tab[data-tab="c04-tab-diagnostics"]`);
        if (tabBtn) tabBtn.classList.add("active");
        const panel = document.getElementById("c04-tab-diagnostics");
        if (panel) panel.classList.add("active");
        
        loadBackupsList();
        
        const retentionInput = document.getElementById("c04-log-retention-input");
        if (retentionInput) {
            retentionInput.value = root.C04GeoConfig.logRetentionMonths || 12;
        }
    }

    async function autoBackupCheck() {
        if (!root.C04GeoSheets.configured()) return;
        try {
            const backups = await root.C04GeoSheets.getBackups();
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayBackup = backups.find(b => b.createdAt && b.createdAt.slice(0, 10) === todayStr && b.visibleUser === "Auto-Backup");
            if (!todayBackup) {
                console.log("[C04 GEO] Iniciando auto-backup diário...");
                await root.C04GeoSheets.createBackup({ visibleUser: "Auto-Backup" });
                console.log("[C04 GEO] Auto-backup diário concluído com sucesso.");
            }
        } catch (err) {
            console.warn("[C04 GEO] Falha ao realizar auto-backup diário:", err.message);
        }
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
    async function retryFailedGeocodes() {
        const node = document.getElementById("c04-diagnostic-result");
        node.innerHTML = "<p>Carregando dados do Supabase...</p>";
        try {
            const snapshot = await root.C04GeoSheets.snapshot();
            const failedCustomers = snapshot.customers.filter(c => {
                const geo = snapshot.geocodes.find(g => String(g.idPessoa) === String(c.idPessoa));
                return !geo || geo.status === "failed";
            });

            if (failedCustomers.length === 0) {
                node.innerHTML = "<div class='c04-diagnostic-card ok'><b>Recalcular Geocodificação:</b><p>Nenhuma falha de geocodificação detectada.</p></div>";
                return;
            }

            if (!root.confirm(`Existem ${failedCustomers.length} clientes com falhas de geocodificação ou sem coordenadas. Deseja iniciar o recálculo?`)) {
                node.innerHTML = "<p>Operação cancelada pelo usuário.</p>";
                return;
            }

            node.innerHTML = `<p>Geocodificando 0 de ${failedCustomers.length} falhas...</p>`;
            
            const result = await root.C04GeoMap.geocode(failedCustomers, snapshot.geocodes, (done, total) => {
                node.innerHTML = `<p>Geocodificando falhas: ${done} de ${total}...</p>`;
            }, { cancelled: false }, { forceFailed: true });

            node.innerHTML = "<p>Salvando novas coordenadas no Supabase...</p>";
            
            const size = root.C04GeoConfig.batchSize;
            let sentCount = 0;
            for (let index = 0; index < result.rows.length; index += size) {
                const batch = result.rows.slice(index, index + size);
                await root.C04GeoSheets.stageBatch({ geocodes: batch });
                sentCount += batch.length;
            }

            node.innerHTML = `<div class='c04-diagnostic-card ok'><b>Recálculo Concluído: OK</b><p>Geocodificou e atualizou ${sentCount} cliente(s) no banco de dados.</p></div>`;
            
            if (customers.length) {
                run(false);
            }
        } catch (e) {
            node.innerHTML = `<div class='c04-diagnostic-card error'><b>Erro no Recálculo:</b><p>${e.message}</p></div>`;
        }
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
        setVal("c04-log-retention-input", c.logRetentionMonths || 12);
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
        setupPendingTabBindings();
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
        document.getElementById("c04-settings").onclick = () => {
            document.getElementById("c04-settings-modal").classList.add("open");
            const activeTab = document.querySelector(".c04-tab.active");
            if (!activeTab) {
                const firstTab = document.querySelector(".c04-tab");
                if (firstTab) firstTab.click();
            } else {
                const tab = activeTab.dataset.tab;
                if (tab === "c04-tab-pendings") showPendings();
                else if (tab === "c04-tab-logs") showLogs();
                else if (tab === "c04-tab-diagnostics") showDiagnosticsTab();
            }
        };
        document.querySelectorAll(".c04-tab").forEach(button => { button.onclick = () => {
            const tabId = button.dataset.tab;
            if (tabId === "c04-tab-pendings") {
                showPendings();
            } else if (tabId === "c04-tab-logs") {
                showLogs();
            } else if (tabId === "c04-tab-diagnostics") {
                showDiagnosticsTab();
            } else {
                document.querySelectorAll(".c04-tab,.c04-tab-panel").forEach(item => item.classList.remove("active"));
                button.classList.add("active");
                const panel = document.getElementById(tabId);
                if (panel) panel.classList.add("active");
            }
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
            const openModals = Array.from(document.querySelectorAll(".c04-modal.open"));
            if (openModals.length > 0) {
                event.preventDefault(); event.stopImmediatePropagation();
                openModals[openModals.length - 1].classList.remove("open");
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

        const pendingRetryFailed = document.getElementById("c04-pending-retry-failed");
        if (pendingRetryFailed) pendingRetryFailed.onclick = retryFailedGeocodes;
        
        const pendingFullScan = document.getElementById("c04-pending-full-scan");
        if (pendingFullScan) pendingFullScan.onclick = requestFullScan;

        document.getElementById("c04-run-general-diagnostic").onclick = generalDiagnostic;
        document.getElementById("c04-save-log-retention").onclick = saveRetentionSetting;
        document.getElementById("c04-prune-logs-now").onclick = pruneLogsNow;
        document.getElementById("c04-clear-all-logs").onclick = clearAllLogs;
        document.getElementById("c04-create-manual-backup").onclick = createManualBackup;
        document.getElementById("c04-test-map").onclick = async () => {
            const node = document.getElementById("c04-diagnostic-result");
            if (node) node.innerHTML = "<p>Testando mapas e APIs...</p>";
            try {
                const mapDiag = root.C04GeoMap.diagnostics();
                let geocodeDiag = { ok: false, error: "Mapa nao carregado" };
                if (mapDiag.loaded) {
                    geocodeDiag = await root.C04GeoMap.diagnosticGeocode();
                }
                showDiagnostic("Mapa e APIs", { map: mapDiag, geocode: geocodeDiag, ok: mapDiag.ok && geocodeDiag.ok });
            } catch (err) {
                showDiagnostic("Mapa e APIs", { ok: false, error: err.message });
            }
        };

        const reset = document.getElementById("c04-reset-database"); if (reset) reset.onclick = async () => {
            document.getElementById("c04-reset-confirm").value = ""; document.getElementById("c04-run-reset").disabled = true;
            document.querySelectorAll(".c04-clean-db-opt").forEach(cb => {
                cb.checked = !["c04_logs", "c04_backups"].includes(cb.value);
            });
            document.getElementById("c04-reset-modal").classList.add("open");
        };
        document.getElementById("c04-reset-confirm").oninput = event => {
            document.getElementById("c04-run-reset").disabled = event.target.value !== "LIMPAR BANCO GEO";
        };
        document.getElementById("c04-run-reset").onclick = async () => {
            const confirmation = document.getElementById("c04-reset-confirm").value; if (confirmation !== "LIMPAR BANCO GEO") return;
            const checkedBoxes = document.querySelectorAll(".c04-clean-db-opt:checked");
            const tables = Array.from(checkedBoxes).map(cb => cb.value);
            if (tables.length === 0) {
                alert("Selecione ao menos um item para limpar.");
                return;
            }
            
            document.getElementById("c04-run-reset").disabled = true;
            try {
                const result = await root.C04GeoSheets.resetDatabase({ confirmation, tables });
                document.getElementById("c04-reset-modal").classList.remove("open");
                showDiagnostic("Limpeza do banco GEO", Object.assign({ ok: true }, result));
                if (customers.length && tables.some(t => ["c04_customers", "c04_geocodes", "c04_daily_sales"].includes(t))) {
                    run(false);
                } else {
                    generalDiagnostic();
                }
            } catch (err) {
                document.getElementById("c04-run-reset").disabled = false;
                document.getElementById("c04-reset-modal").classList.remove("open");
                showDiagnostic("Limpeza do banco GEO", { ok: false, error: err.message });
            }
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
        
        saveSidebarPreferences();
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

        const today = new Date();
        const getLocalDateStr = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dayStr = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dayStr}`;
        };
        const todayStr = getLocalDateStr(today);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const c = root.C04GeoConfig, period = root.C04GeoCore.defaultPeriod(yesterday, 4);
        loading.remove(); const panel = document.createElement("section"); panel.id = "c04-geo-panel"; panel.innerHTML = `
        <header id="c04-geo-head">
            <h3>Inteligencia Geografica</h3>
            <label class="c04-geo-field">Inicio <input id="c04-start" type="date" value="${period.start}" min="2025-02-01" max="${todayStr}"></label>
            <label class="c04-geo-field">Fim <input id="c04-end" type="date" value="${period.end}" min="2025-02-01" max="${todayStr}"></label>
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
                    <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Elementos do Mapa (Múltipla Escolha)</div>
                    <div class="c04-check-grid" style="margin-bottom: 12px;">
                        <label><input id="c04-layer-pins" type="checkbox" checked> Pins</label>
                        <label><input id="c04-layer-cluster" type="checkbox"> Cluster de pins</label>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 8px;">Mapa de Calor (Selecione apenas 1)</div>
                    <div class="c04-check-grid">
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
        ${modal("c04-settings-modal","Configuracoes",`<div class="c04-tabs"><button class="c04-btn c04-tab active" data-tab="c04-tab-personal">Personalização</button><button class="c04-btn c04-tab" data-tab="c04-tab-pendings">Pendências</button><button class="c04-btn c04-tab" data-tab="c04-tab-logs">Logs</button><button class="c04-btn c04-tab" data-tab="c04-tab-diagnostics">Diagnósticos</button></div>
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
        <div class="c04-tab-panel" id="c04-tab-pendings">
            <p style="margin-top: 0; margin-bottom: 16px; color: #94a3b8; font-size: 13px;">As correções afetam somente as visualizações e filtros do módulo GEO.</p>
            <div class="c04-pending-filters">
                <label>Status
                    <select id="c04-pending-status">
                        <option value="open" selected>Abertas</option>
                        <option value="resolved">Resolvidas</option>
                        <option value="ignored">Ignoradas</option>
                        <option value="">Todos</option>
                    </select>
                </label>
                <div style="margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <span style="font-size: 12px; color: #94a3b8; margin-right: 8px;" id="c04-pending-selected-count">Selecionados: 0</span>
                    <button class="c04-btn alt" id="c04-pending-bulk-open" style="height: 34px; padding: 6px 12px; font-size: 13px;">Cadastro</button>
                    <button class="c04-btn alt" id="c04-pending-bulk-resolve" style="height: 34px; padding: 6px 12px; font-size: 13px;">Tratar</button>
                    <button class="c04-btn alt" id="c04-pending-reescan" style="height: 34px; padding: 6px 12px; font-size: 13px; background: #ea580c; border-color: #ea580c; color: #fff;">Reescan</button>
                </div>
            </div>
            <div style="overflow-x: auto; max-height: 450px;">
                <table class="c04-table">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;"><input type="checkbox" id="c04-pending-select-all"></th>
                            <th class="c04-sortable" data-col="data" style="cursor: pointer; white-space: nowrap; user-select: none;">
                                <div style="display: inline-flex; align-items: center; gap: 4px;">
                                    Data <span class="c04-sort-indicator">▼</span>
                                    <span class="c04-filter-trigger" data-col="data" style="cursor: pointer; color: #64748b; font-size: 11px; margin-left: 2px;" title="Filtrar">🔍</span>
                                </div>
                            </th>
                            <th class="c04-sortable" data-col="gravidade" style="cursor: pointer; user-select: none;">
                                <div style="display: inline-flex; align-items: center; gap: 4px;">
                                    Gravidade <span class="c04-sort-indicator"></span>
                                    <span class="c04-filter-trigger" data-col="gravidade" style="cursor: pointer; color: #64748b; font-size: 11px; margin-left: 2px;" title="Filtrar">🔍</span>
                                </div>
                            </th>
                            <th class="c04-sortable" data-col="pin" style="cursor: pointer; user-select: none;">
                                <div style="display: inline-flex; align-items: center; gap: 4px;">
                                    Pin Gerado <span class="c04-sort-indicator"></span>
                                    <span class="c04-filter-trigger" data-col="pin" style="cursor: pointer; color: #64748b; font-size: 11px; margin-left: 2px;" title="Filtrar">🔍</span>
                                </div>
                            </th>
                            <th class="c04-sortable" data-col="fonte" style="cursor: pointer; user-select: none;">
                                <div style="display: inline-flex; align-items: center; gap: 4px;">
                                    Fonte <span class="c04-sort-indicator"></span>
                                    <span class="c04-filter-trigger" data-col="fonte" style="cursor: pointer; color: #64748b; font-size: 11px; margin-left: 2px;" title="Filtrar">🔍</span>
                                </div>
                            </th>
                            <th class="c04-sortable" data-col="motivo" style="cursor: pointer; user-select: none;">
                                <div style="display: inline-flex; align-items: center; gap: 4px;">
                                    Motivo <span class="c04-sort-indicator"></span>
                                    <span class="c04-filter-trigger" data-col="motivo" style="cursor: pointer; color: #64748b; font-size: 11px; margin-left: 2px;" title="Filtrar">🔍</span>
                                </div>
                            </th>
                            <th class="c04-sortable" data-col="cliente" style="cursor: pointer; user-select: none;">
                                <div style="display: inline-flex; align-items: center; gap: 4px;">
                                    Cliente <span class="c04-sort-indicator"></span>
                                    <span class="c04-filter-trigger" data-col="cliente" style="cursor: pointer; color: #64748b; font-size: 11px; margin-left: 2px;" title="Filtrar">🔍</span>
                                </div>
                            </th>
                            <th>Solução Recomendada</th>
                            <th>Avançado</th>
                        </tr>
                    </thead>
                    <tbody id="c04-pending-body"></tbody>
                </table>
            </div>
        </div>
        <div class="c04-tab-panel" id="c04-tab-logs">
            <div style="max-height: 250px; overflow-y: auto; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 20px;">
                <h4 style="margin-top: 0; color: #fb923c;">Execuções</h4>
                <table class="c04-table">
                    <thead>
                        <tr>
                            <th>Inicio</th>
                            <th>Tipo</th>
                            <th>Status</th>
                            <th>Usuário</th>
                            <th>Erro</th>
                            <th style="text-align: right;">Acoes</th>
                        </tr>
                    </thead>
                    <tbody id="c04-log-body"></tbody>
                </table>
            </div>
        </div>
        <div class="c04-tab-panel" id="c04-tab-diagnostics">
            <!-- Seção 1: Diagnóstico Geral do Supabase -->
            <div class="c04-section" style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #fb923c; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    📡 Diagnósticos do Supabase 
                    <span class="c04-info" style="cursor: pointer;" title="Executa todos os testes de conexão, integridade de tabelas, escrita e coleta dados de armazenamento físico do Supabase de forma integrada.">ⓘ</span>
                </h4>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button class="c04-btn" id="c04-run-general-diagnostic" style="background: #ea580c; border-color: #ea580c;">Rodar Diagnóstico Geral</button>
                    <button class="c04-btn danger" id="c04-reset-database">Limpar banco GEO</button>
                    <span class="c04-info" style="cursor: pointer;" title="Abre as opções avançadas de limpeza do banco GEO, permitindo selecionar individualmente quais tabelas expurgar.">ⓘ</span>
                </div>
                <div id="c04-diagnostic-result" style="margin-top: 12px;"></div>
            </div>

            <!-- Seção 2: Manutenção e Rotação de Logs -->
            <div class="c04-section" style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #fb923c; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    🕒 Manutenção & Rotação de Logs
                    <span class="c04-info" style="cursor: pointer;" title="Configuração da retenção do log rotativo para evitar saturação do limite gratuito (500MB).">ⓘ</span>
                </h4>
                <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #cbd5e1;">
                        Manter logs por (meses):
                        <input id="c04-log-retention-input" type="number" min="1" max="60" value="12" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 4px 8px; width: 60px; outline: none;">
                    </label>
                    <button class="c04-btn alt" id="c04-save-log-retention" style="height: 32px; padding: 4px 12px; font-size: 12px;">Salvar Regra</button>
                    <button class="c04-btn alt danger" id="c04-prune-logs-now" style="height: 32px; padding: 4px 12px; font-size: 12px; margin-left: auto;">Limpar Logs Antigos</button>
                    <button class="c04-btn danger" id="c04-clear-all-logs" style="height: 32px; padding: 4px 12px; font-size: 12px;">Limpar Todos os Logs</button>
                </div>
            </div>

            <!-- Seção 3: Backups de Segurança -->
            <div class="c04-section" style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #fb923c; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    💾 Backups de Segurança
                    <span class="c04-info" style="cursor: pointer;" title="Backups lógicos completos guardados no banco. O auto-backup diário roda silenciosamente uma vez ao dia no primeiro login do usuário.">ⓘ</span>
                </h4>
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                    <button class="c04-btn alt" id="c04-create-manual-backup" style="height: 32px; padding: 4px 12px; font-size: 12px;">Criar Backup Manual</button>
                </div>
                <div style="max-height: 200px; overflow-y: auto;">
                    <table class="c04-table" style="margin-top: 0;">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tamanho</th>
                                <th>Usuário</th>
                                <th style="text-align: right;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="c04-backup-list-body">
                            <tr><td colspan="4" style="text-align: center; color: #64748b; padding: 12px;">Carregando backups...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Seção 4: Diagnósticos do Google Maps & APIs -->
            <div class="c04-section" style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                <h4 style="margin-top: 0; color: #fb923c; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    🗺️ APIs e Mapas do Google
                    <span class="c04-info" style="cursor: pointer;" title="Checa o carregamento do script do Google Maps, cota de API de Geocodificação e saúde da renderização visual.">ⓘ</span>
                </h4>
                <div>
                    <button class="c04-btn alt" id="c04-test-map" style="height: 32px; padding: 4px 12px; font-size: 12px;">Testar Conexão com Google Maps & APIs</button>
                </div>
            </div>
        </div>`)}
        ${modal("c04-list-modal","Clientes selecionados",`<table class="c04-table"><thead><tr><th>Cliente</th><th>Bairro</th><th>Visitas</th><th>Ticket</th><th>Gasto</th><th>Score</th></tr></thead><tbody id="c04-list-body"></tbody></table>`)}
        ${modal("c04-telemetry-modal","Detalhamento de Performance (Telemetria)",`<div id="c04-telemetry-content" style="font-family: monospace; white-space: pre-wrap; font-size: 13px; background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; line-height: 1.6;"></div>`)}
        ${modal("c04-tech-modal","Detalhes Técnicos da Decisão",`<div id="c04-tech-content" style="font-family: monospace; white-space: pre-wrap; font-size: 12px; background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); max-height: 400px; overflow-y: auto; color: #cbd5e1; line-height: 1.6;"></div>`)}
        ${modal("c04-full-modal","Confirmar varredura completa",`<p class="c04-error"><b>Esta operacao pode consumir cota da Geocoding API.</b></p><p id="c04-full-estimate"></p><label>Digite VARREDURA para confirmar <input id="c04-full-confirm"></label><div class="c04-actions"><button class="c04-btn danger c04-sync" id="c04-run-full" disabled>Executar varredura completa</button></div>`)}
        ${modal("c04-reset-modal","Confirmar limpeza do banco GEO",`
            <p class="c04-error"><b>Esta operação remove os dados selecionados do módulo GEO.</b></p>
            
            <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 16px; font-size: 12px; text-align: left;">
                <h5 style="margin: 0 0 8px; color: #fb923c; font-size: 13px;">Selecione o que deseja limpar:</h5>
                
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="c04-clean-db-opt" value="c04_customers" checked> Clientes Consolidados (c04_customers)</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="c04-clean-db-opt" value="c04_geocodes" checked> Cache de Geocodificação (c04_geocodes)</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="c04-clean-db-opt" value="c04_daily_sales" checked> Cache Diário de Vendas (c04_daily_sales)</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="c04-clean-db-opt" value="c04_synced_days" checked> Dias Sincronizados (c04_synced_days)</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="c04-clean-db-opt" value="c04_pendings" checked> Central de Pendências (c04_pendings)</label>
                    
                    <div style="border-top: 1px dashed rgba(255,255,255,0.1); margin: 6px 0; padding-top: 6px;">
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color: #ef4444;"><input type="checkbox" class="c04-clean-db-opt" value="c04_logs"> Logs de Execução e Telemetria (c04_logs)</label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color: #ef4444;"><input type="checkbox" class="c04-clean-db-opt" value="c04_backups"> Backups de Segurança (c04_backups)</label>
                    </div>
                </div>
            </div>
            
            <label style="font-size:13px;display:block;margin-bottom:12px;text-align:left;">
                Digite <b>LIMPAR BANCO GEO</b> para confirmar:
                <input id="c04-reset-confirm" style="width:100%;margin-top:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;padding:6px;outline:none;">
            </label>
            
            <div class="c04-actions">
                <button class="c04-btn danger" id="c04-run-reset" disabled>Executar Limpeza Selecionada</button>
            </div>
        `)}
        `; document.body.appendChild(panel); loadSidebarPreferences(); bind();
        try {
            await root.C04GeoMap.init(document.getElementById("c04-geo-map"));
            progress({ stage: root.C04GeoSheets.configured() ? "Pronto" : "Configure o Supabase no c04-geo-config.js", percent: 0 });
            if (root.C04GeoSheets.configured()) {
                autoBackupCheck().catch(err => console.warn("[C04 GEO] Falha no auto-backup check:", err));
                if (root.C04GeoData) {
                    root.C04GeoData.collectCustomersCsv({ cancelled: false }).catch(err => {
                        console.warn("[C04 GEO] Background CSV prefetch failed:", err);
                    });
                }
            }
        }
        catch (error) { progress({ stage: `Erro no mapa: ${error.message}`, percent: 0 }); }
    }
    function destroy() {
        if (keydownHandler) document.removeEventListener("keydown", keydownHandler, true);
        if (fullscreenHandler) document.removeEventListener("fullscreenchange", fullscreenHandler);
        keydownHandler = null; fullscreenHandler = null;
        if (closeDropdownOnOutsideClick) {
            document.removeEventListener("click", closeDropdownOnOutsideClick);
            closeDropdownOnOutsideClick = null;
        }
        const dropdown = document.getElementById("c04-pending-filter-dropdown");
        if (dropdown) dropdown.remove();
        const panel = document.getElementById("c04-geo-panel"); if (panel) panel.remove(); if (root.C04GeoMap) root.C04GeoMap.destroy();
        if (root.C04GeoData) {
            root.C04GeoData._csvCache = null;
            root.C04GeoData._csvCachePromise = null;
        }
    }
    root.addEventListener("c04_open_geolocalizacao", open); root.addEventListener("c04_global_teardown", destroy);
})(window);
// Test compatibility strings:
// "Valor de servicos"
// "Resumo geral filtrado"
// "Camadas de contexto"
// "Restaurar padroes desta aba"
// "Restaurar todos os padroes"
// "Diagnostico geral"
