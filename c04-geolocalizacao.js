(function (root) {
    "use strict";
    const MODULES = ["c04-geo-config.js", "c04-geo-core.js", "c04-geo-sheets.js", "c04-geo-data.js", "c04-geo-map.js"];
    let customers = [], visibleCustomers = [], pending = [], selected = [], running = false, lastProgress = {}, runToken = null;
    let keydownHandler, fullscreenHandler;
    const esc = value => root.C04GeoCore.escapeHtml(value);
    function visibleUser() { return root.C04GeoCore.visibleUser(document); }
    function migrateLegacySettings(settings) {
        if (!settings || !settings.weights || settings.weights.spend == null) return settings;
        settings.weights = { recurrence: 60, ticket: 40 };
        settings.colors = Object.assign({}, settings.colors, {
            clientPin: "#343434", storePin: "#f97316", cluster: "#3f3f46",
            scoreLow: "#7f1d1d", scoreMedium: "#c2410c", scoreGood: "#f97316", scoreHigh: "#fb923c",
            heatVisitsLow: "#ffedd5", heatVisitsHigh: "#ea580c", heatSpendLow: "#fed7aa", heatSpendHigh: "#9a3412",
            heatScoreLow: "#fff7ed", heatScoreHigh: "#f97316"
        });
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
        #c04-geo-panel{position:fixed;inset:2vh 2vw;background:#fff;z-index:999999;border-radius:10px;box-shadow:0 20px 70px #0008;display:grid;grid-template-rows:auto 1fr;font:12px Arial;overflow:hidden;color:#292524}#c04-geo-panel:fullscreen{inset:0;border-radius:0}
        #c04-geo-head{position:relative;background:#292524;color:#fff;padding:8px 96px 8px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-height:40px}#c04-geo-head.head-closed>*:not(#c04-toggle-head):not(#c04-geo-close){display:none}#c04-geo-head.head-closed{min-height:38px;padding:3px 96px 3px 12px}.c04-icon-btn{width:30px;height:30px;padding:0;font:bold 15px Arial}#c04-toggle-head{position:absolute;right:54px;top:8px}#c04-geo-head h3{margin:0 8px 0 0}.c04-geo-field{display:flex;gap:4px;align-items:center}.c04-geo-field input{width:110px;padding:5px}
        .c04-btn{border:0;border-radius:5px;padding:7px 9px;color:#fff;background:#ea580c;cursor:pointer}.c04-btn.alt{background:#475569}.c04-btn.danger{background:#991b1b}.c04-btn:disabled{opacity:.5}#c04-geo-close{position:absolute;right:8px;top:8px;z-index:30;width:38px;height:38px;border-radius:50%;border:2px solid #fff;background:#991b1b;color:#fff;font:bold 23px Arial;cursor:pointer}
        #c04-geo-map{width:100%;height:100%;min-height:0}.c04-float{position:absolute;z-index:5;background:#fff;border:1px solid #ddd;border-radius:7px;box-shadow:0 4px 18px #0003}
        #c04-geo-main{position:relative;min-height:0;display:grid;grid-template-columns:320px minmax(0,1fr);overflow:hidden}#c04-geo-main.sidebar-closed{grid-template-columns:0 minmax(0,1fr)}#c04-geo-sidebar{position:relative;background:#fafaf9;border-right:1px solid #d6d3d1;padding:38px 10px 10px;overflow:auto;transition:.2s;min-width:0}#c04-toggle-sidebar{position:absolute;right:6px;top:5px;z-index:12}#c04-geo-main.sidebar-closed #c04-geo-sidebar{padding:0;border:0;overflow:visible;width:0}#c04-geo-main.sidebar-closed #c04-toggle-sidebar{right:-36px;background:#292524}
        .c04-side-group{border-top:1px solid #d6d3d1;padding:10px 0}.c04-side-group:first-of-type{border-top:0}.c04-side-group h4{margin:0 0 7px;color:#9a3412}.c04-summary-card{background:#fff7ed;border:1px solid #fed7aa;border-radius:7px;padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:5px}.c04-summary-card b{font-size:14px}.c04-summary-wide{grid-column:1/-1}#c04-geo-progress{left:50%;bottom:36px;transform:translateX(-50%);width:min(760px,86%);min-height:36px;padding:10px 40px 10px 12px;box-sizing:border-box;transition:.3s}#c04-toggle-progress{position:absolute;right:5px;top:5px}#c04-geo-progress.compact{width:auto;min-width:190px}#c04-geo-progress.compact #c04-progress-counters,#c04-geo-progress.compact #c04-progress-track{display:none}
        #c04-progress-track{height:7px;background:#e2e8f0;border-radius:5px;overflow:hidden}#c04-progress-bar{height:100%;width:0;background:#ea580c;transition:.2s}.c04-progress-info{display:flex;justify-content:space-between;gap:8px;margin-top:5px}
        #c04-geo-layers{padding:8px 0}.c04-check-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.c04-filter{border-top:1px solid #d6d3d1;padding-top:8px;margin-top:8px}.c04-filter-row{display:grid;grid-template-columns:1fr 1fr;gap:5px}.c04-filter-row input{width:100%;box-sizing:border-box}#c04-geo-selectbox{padding:8px 0}
        .c04-modal{position:absolute;inset:0;background:#0007;z-index:20;display:none;place-items:center}.c04-modal.open{display:grid}.c04-modal-card{background:#fff;border-radius:8px;padding:16px;width:min(760px,90%);max-height:85%;overflow:auto}
        .c04-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.c04-grid label{display:grid;gap:3px}.c04-info{display:inline-grid;place-items:center;width:14px;height:14px;border:1px solid #78716c;border-radius:50%;font:bold 10px Arial}.c04-table{width:100%;border-collapse:collapse}.c04-table th,.c04-table td{padding:5px;border:1px solid #ddd;text-align:left;font-size:11px}.c04-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.c04-error{color:#991b1b}.c04-tabs{display:flex;gap:4px;border-bottom:1px solid #d6d3d1;margin-bottom:12px}.c04-tab{background:#e7e5e4;color:#292524}.c04-tab.active{background:#ea580c;color:#fff}.c04-tab-panel{display:none}.c04-tab-panel.active{display:block}.c04-diagnostic-card{border-left:5px solid #78716c;background:#fafaf9;padding:8px;margin:7px 0}.c04-diagnostic-card.ok{border-color:#15803d}.c04-diagnostic-card.warn{border-color:#f97316}.c04-diagnostic-card.error{border-color:#b91c1c}.c04-selection-list button{margin:3px}
        .c04-map-edges{position:absolute;inset:55px 8px 8px;z-index:8;pointer-events:none}.c04-map-edges button{pointer-events:auto;position:relative;margin:4px;border:0;border-radius:12px;background:#111827;color:#fff;padding:5px 8px}.c04-map-edges button[data-edge=N]{position:absolute;left:50%;top:0}.c04-map-edges button[data-edge=S]{position:absolute;left:50%;bottom:0}.c04-map-edges button[data-edge=E]{position:absolute;right:0;top:50%}.c04-map-edges button[data-edge=W]{position:absolute;left:0;top:50%}.c04-section{border-top:1px solid #ddd;margin-top:14px;padding-top:10px}
        `; document.head.appendChild(node);
    }
    function progress(update) {
        lastProgress = Object.assign(lastProgress, update); const p = lastProgress;
        const box = document.getElementById("c04-geo-progress"), bar = document.getElementById("c04-progress-bar"), text = document.getElementById("c04-progress-text"), counters = document.getElementById("c04-progress-counters");
        if (!bar) return; bar.style.width = `${p.percent || 0}%`; text.textContent = p.stage || "";
        counters.textContent = `Coletados ${p.collected || 0} | Existentes ${p.existing || 0} | Novos ${p.new || 0} | Alterados ${p.changed || 0} | Pendencias ${p.pending || 0} | Coord. ${p.found || 0}/${p.failed || 0} | Enviados ${p.sent || 0}`;
        box.classList.remove("compact"); if (p.percent === 100) setTimeout(() => box.classList.add("compact"), 4000);
    }
    function configFromForm() {
        const number = id => Number(document.getElementById(id).value);
        return { franchiseAverageTicket: number("c04-ticket"), weights: { recurrence: number("c04-w-rec"), ticket: number("c04-w-ticket") },
            recurrenceLimits: { excellent: number("c04-r-ex"), good: number("c04-r-good"), improve: number("c04-r-improve") },
            clusterRadius: number("c04-cluster"), heatmaps: { opacity: number("c04-opacity"), radius: number("c04-radius"), intensity: number("c04-intensity") },
            colors: { clientPin: document.getElementById("c04-color-client").value, storePin: document.getElementById("c04-color-store").value,
                cluster: document.getElementById("c04-color-cluster").value, scoreLow: document.getElementById("c04-color-low").value,
                scoreMedium: document.getElementById("c04-color-medium").value, scoreGood: document.getElementById("c04-color-good").value,
                scoreHigh: document.getElementById("c04-color-high").value, heatVisitsLow: document.getElementById("c04-heat-visits-low").value,
                heatVisitsHigh: document.getElementById("c04-heat-visits-high").value, heatSpendLow: document.getElementById("c04-heat-spend-low").value,
                heatSpendHigh: document.getElementById("c04-heat-spend-high").value, heatScoreLow: document.getElementById("c04-heat-score-low").value,
                heatScoreHigh: document.getElementById("c04-heat-score-high").value } };
    }
    function layerState() {
        return Object.fromEntries(["pins", "visits", "spend", "score"].map(key => [key, document.getElementById(`c04-layer-${key}`).checked]));
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
        root.C04GeoMap.renderPins(mapped, layerState().pins); root.C04GeoMap.setLayers(layerState());
        renderSummary("c04-general-summary", root.C04GeoCore.selectionSummary(mapped), pending.length);
    }
    function renderSummary(id, summary, pendingCount, general) {
        const node = document.getElementById(id); if (!node) return;
        const base = general || summary, percentage = value => base && base[value] ? 100 * summary[value] / base[value] : 0;
        node.innerHTML = `<span>Clientes<br><b>${summary.count}</b></span><span>Visitas<br><b>${summary.visits}</b></span>
            <span>Valor servicos<br><b>R$ ${summary.spend.toFixed(0)}</b></span><span>Ticket medio<br><b>R$ ${summary.averageTicket.toFixed(0)}</b></span>
            <span>Freq. media<br><b>${summary.frequencyAverage.toFixed(1)} d</b></span><span>Freq. mediana<br><b>${summary.frequencyMedian.toFixed(1)} d</b></span>
            <span>Score medio<br><b>${summary.averageScore.toFixed(0)}</b></span>${pendingCount == null ? "" : `<span>Pendencias<br><b>${pendingCount}</b></span>`}
            ${general ? `<span class="c04-summary-wide">Participacao: ${percentage("count").toFixed(0)}% clientes | ${percentage("visits").toFixed(0)}% visitas | ${percentage("spend").toFixed(0)}% valor</span>` : ""}`;
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
            const geo = await root.C04GeoMap.geocode(customers, result.snapshot.geocodes, (done, total, counts, partial) => {
                progress(Object.assign({ stage: "Geocodificando", percent: 45 + Math.round(28 * done / total) }, counts));
                if (done % 25 === 0 || done === total) { root.C04GeoMap.renderPins(partial, layerState().pins); root.C04GeoMap.setLayers(layerState()); }
            }, runToken, { forceFailed: force });
            geo.rejected.forEach(item => pending.push({ pendingId: root.C04GeoCore.hash(`Geocodificacao|${item.customer.idPessoa}|${item.reason}`),
                source: "Geocodificacao", reason: item.reason, message: `Resultado rejeitado (${item.distanceKm.toFixed(1)} km)`,
                idPessoa: item.customer.idPessoa, customerName: item.customer.name, status: "open", record: item }));
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
        selected = items; const summary = root.C04GeoCore.selectionSummary(items), node = document.getElementById("c04-selection");
        const general = root.C04GeoCore.selectionSummary(visibleCustomers.filter(item => Number.isFinite(item.lat)));
        const radii = selectionInfo && selectionInfo.radiiKm && selectionInfo.radiiKm.length ?
            `<br>Raios: <b>${selectionInfo.radiiKm.map(value => `${value.toFixed(2)} km`).join(", ")}</b>` : "";
        const shapes = selectionInfo && selectionInfo.selections ? `<div class="c04-selection-list">${selectionInfo.selections.map(item =>
            `<button class="c04-btn alt c04-remove-selection" data-selection="${item.id}">${item.type} x</button>`).join("")}</div>` : "";
        node.innerHTML = `<div class="c04-summary-card" id="c04-selection-summary"></div>${radii}${shapes}
            <div class="c04-actions"><button class="c04-btn" id="c04-selection-table">Ver lista</button><button class="c04-btn alt" id="c04-selection-csv">Exportar CSV</button></div>`;
        renderSummary("c04-selection-summary", summary, null, general);
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
            body.innerHTML = filtered.map(item => `<tr><td>${esc(item.status || "open")}</td><td>${esc(item.source || "")}</td><td>${esc(reasonLabels[item.reason] || item.reason || "")}</td><td>${esc(item.customerName || "")}</td><td>${esc(item.message || "")}</td><td><button class="c04-btn alt c04-open-person" data-person="${esc(item.idPessoa || "")}">Abrir cadastro</button> <button class="c04-btn alt c04-resolve" data-id="${esc(item.pendingId)}">Tratar</button>${item.status !== "open" ? `<button class="c04-btn alt c04-reopen" data-id="${esc(item.pendingId)}">Reabrir</button>` : ""}</td></tr>`).join("");
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
        document.getElementById("c04-geo-main").classList.toggle("sidebar-closed", panel.dataset.sidebarClosed === "true");
        document.getElementById("c04-geo-head").classList.toggle("head-closed", panel.dataset.headClosed === "true");
        document.getElementById("c04-geo-progress").classList.toggle("compact", panel.dataset.progressClosed === "true");
    }
    function bind() {
        document.getElementById("c04-geo-close").onclick = destroy; document.getElementById("c04-sync").onclick = () => run(false);
        document.getElementById("c04-toggle-sidebar").onclick = () => {
            document.getElementById("c04-geo-main").classList.toggle("sidebar-closed");
            setTimeout(() => root.C04GeoMap.resize(), 250);
        };
        document.getElementById("c04-toggle-head").onclick = () => document.getElementById("c04-geo-head").classList.toggle("head-closed");
        document.getElementById("c04-toggle-progress").onclick = () => document.getElementById("c04-geo-progress").classList.toggle("compact");
        document.getElementById("c04-fullscreen").onclick = async () => {
            const panel = document.getElementById("c04-geo-panel");
            if (!document.fullscreenElement) {
                panel.dataset.sidebarClosed = document.getElementById("c04-geo-main").classList.contains("sidebar-closed");
                panel.dataset.headClosed = document.getElementById("c04-geo-head").classList.contains("head-closed");
                panel.dataset.progressClosed = document.getElementById("c04-geo-progress").classList.contains("compact");
                document.getElementById("c04-geo-main").classList.add("sidebar-closed");
                document.getElementById("c04-geo-head").classList.add("head-closed");
                document.getElementById("c04-geo-progress").classList.add("compact");
                try { await panel.requestFullscreen(); }
                catch (error) { restoreFullscreenState(panel); progress({ stage: `Fullscreen indisponivel: ${error.message}`, percent: lastProgress.percent || 0 }); }
            } else await document.exitFullscreen();
            setTimeout(() => root.C04GeoMap.resize(), 250);
        };
        fullscreenHandler = () => {
            const panel = document.getElementById("c04-geo-panel"); if (!panel || document.fullscreenElement) return;
            restoreFullscreenState(panel);
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
        document.querySelectorAll("[id^=c04-layer-]").forEach(input => { input.onchange = () => root.C04GeoMap.setLayers(layerState()); });
        document.querySelectorAll("[data-select]").forEach(button => { button.onclick = () => root.C04GeoMap.select(button.dataset.select, selectionChanged); });
        document.getElementById("c04-clear-selection").onclick = () => { root.C04GeoMap.clearSelection(); selectionChanged([]); };
        keydownHandler = event => {
            if (event.key !== "Escape") return; const info = root.C04GeoMap.selectionInfo();
            if (info.selections.length) {
                event.preventDefault(); event.stopImmediatePropagation();
                root.C04GeoMap.removeSelection(info.selections[info.selections.length - 1].id);
            }
        };
        document.addEventListener("keydown", keydownHandler, true);
        document.querySelectorAll("[data-filter]").forEach(input => { input.oninput = () => { if (customers.length) render(); }; });
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
        document.getElementById("c04-save-settings").onclick = async () => {
            Object.assign(root.C04GeoConfig, configFromForm()); await root.C04GeoSheets.saveSettings(configFromForm());
            document.getElementById("c04-settings-modal").classList.remove("open"); if (customers.length) render();
        };
        document.getElementById("c04-restore-tab").onclick = () => restoreDefaults(false);
        document.getElementById("c04-restore-all").onclick = () => restoreDefaults(true);
    }
    async function restoreDefaults(close) {
        Object.assign(root.C04GeoConfig, JSON.parse(JSON.stringify(root.C04GeoDefaultSettings)));
        await root.C04GeoSheets.saveSettings(root.C04GeoDefaultSettings);
        if (close) document.getElementById("c04-settings-modal").classList.remove("open");
        if (customers.length) render();
    }
    function modal(id, title, content) { return `<div class="c04-modal" id="${id}"><div class="c04-modal-card"><button class="c04-btn alt c04-modal-close" style="float:right">Fechar</button><h3>${title}</h3>${content}</div></div>`; }
    function setting(label, help, id, type, value, extra) {
        return `<label>${label} <span class="c04-info" title="${help}" aria-label="${help}">i</span><input id="${id}" type="${type}" value="${value}" ${extra || ""}></label>`;
    }
    async function open() {
        destroy();
        const loading = document.createElement("section"); loading.id = "c04-geo-panel";
        loading.style.cssText = "position:fixed;inset:2vh 2vw;background:#fff;z-index:999999;border-radius:10px;box-shadow:0 20px 70px #0008;display:grid;place-items:center;font:14px Arial";
        loading.innerHTML = `<div><b>Carregando Inteligencia Geografica...</b><br><small>Preparando mapa e controles.</small></div>`;
        document.body.appendChild(loading);
        await dependencies(); style(); const c = root.C04GeoConfig, period = root.C04GeoCore.defaultPeriod(new Date(), c.defaultMonths);
        if (root.C04GeoSheets.configured()) {
            try {
                const snapshot = await root.C04GeoSheets.snapshot();
                if (snapshot.settings) Object.assign(root.C04GeoConfig, migrateLegacySettings(snapshot.settings));
            } catch (error) { console.warn("[C04 GEO] Configuracoes remotas indisponiveis:", error.message); }
        }
        loading.remove(); const panel = document.createElement("section"); panel.id = "c04-geo-panel"; panel.innerHTML = `
        <header id="c04-geo-head"><h3>Inteligencia Geografica</h3><label class="c04-geo-field">Inicio <input id="c04-start" type="date" value="${period.start}"></label><label class="c04-geo-field">Fim <input id="c04-end" type="date" value="${period.end}"></label>
        <button class="c04-btn c04-sync" id="c04-sync">Sincronizar</button><button class="c04-btn alt" id="c04-settings">Configuracoes</button><button class="c04-btn alt c04-icon-btn" id="c04-fullscreen" title="Tela cheia">[]</button><button class="c04-btn alt c04-icon-btn" id="c04-toggle-head" title="Recolher menu superior">^</button><button id="c04-geo-close" aria-label="Fechar modulo">x</button></header>
        <main id="c04-geo-main"><aside id="c04-geo-sidebar"><button class="c04-btn alt c04-icon-btn" id="c04-toggle-sidebar" title="Recolher menu">&lt;</button>
        <div class="c04-side-group"><h4>Resumo geral filtrado</h4><div class="c04-summary-card" id="c04-general-summary"></div></div>
        <div class="c04-side-group"><h4>Mapa base</h4><label><input id="c04-satellite" type="checkbox"> Satelite</label></div>
        <div class="c04-side-group" id="c04-geo-layers"><h4>Camadas analiticas</h4><div class="c04-check-grid">${[["pins","Pins"],["visits","Visitas"],["spend","Valor de servicos"],["score","Score"]].map(([key,label]) => `<label><input id="c04-layer-${key}" type="checkbox" checked> ${label}</label>`).join("")}</div>
        <h4>Camadas de contexto</h4><div class="c04-check-grid"><label><input data-transport="traffic" type="checkbox"> Transito</label><label><input data-transport="transit" type="checkbox"> Transporte publico</label><label><input data-transport="bicycling" type="checkbox"> Ciclovias</label></div></div>
        <div class="c04-side-group c04-filter"><h4>Filtros</h4><label>Frequencia em dias <span class="c04-info" title="Menor intervalo indica maior recorrencia. Valores ausentes nao entram na faixa.">i</span><span class="c04-filter-row"><input data-filter id="c04-frequency-min" type="number" placeholder="Min."><input data-filter id="c04-frequency-max" type="number" placeholder="Max."></span></label><label>Ticket de servicos realizados <span class="c04-info" title="Valor medio dos servicos executados, nao necessariamente pago no caixa">i</span><span class="c04-filter-row"><input data-filter id="c04-ticket-filter-min" type="number" placeholder="Min."><input data-filter id="c04-ticket-filter-max" type="number" placeholder="Max."></span></label><label>Score <span class="c04-info" title="Combinacao de recorrencia e ticket de servicos">i</span><span class="c04-filter-row"><input data-filter id="c04-score-filter-min" type="number" min="0" max="100" placeholder="Min."><input data-filter id="c04-score-filter-max" type="number" min="0" max="100" placeholder="Max."></span></label><label><input data-filter id="c04-exclude-single" type="checkbox"> Ocultar primeira visita</label></div>
        <div class="c04-side-group" id="c04-geo-selectbox"><h4>Selecao regional</h4><div class="c04-actions"><button class="c04-btn alt" data-select="circle">Raio</button><button class="c04-btn alt" data-select="rectangle">Quadrado</button><button class="c04-btn alt" data-select="polygon">Poligono</button><button class="c04-btn alt" id="c04-clear-selection">Limpar todas</button></div><div id="c04-selection">Nenhuma selecao ativa.</div></div></aside>
        <section style="position:relative;min-width:0"><div id="c04-geo-map"></div><div class="c04-float" id="c04-geo-progress"><button class="c04-btn alt c04-icon-btn" id="c04-toggle-progress" title="Recolher progresso">_</button><div id="c04-progress-track"><div id="c04-progress-bar"></div></div><div class="c04-progress-info"><span id="c04-progress-text">Pronto</span><span id="c04-progress-counters"></span></div></div></section></main>
        ${modal("c04-settings-modal","Configuracoes",`<div class="c04-tabs"><button class="c04-btn c04-tab active" data-tab="c04-tab-personal">Personalizacao</button><button class="c04-btn c04-tab" data-tab="c04-tab-diagnostics">Diagnosticos</button><button class="c04-btn c04-tab" data-tab="c04-tab-pendings">Pendencias</button><button class="c04-btn c04-tab" data-tab="c04-tab-history">Historico</button><button class="c04-btn c04-tab" data-tab="c04-tab-advanced">Avancado</button></div>
        <div class="c04-tab-panel active" id="c04-tab-personal"><div class="c04-section"><h4>Score e recorrencia</h4><div class="c04-grid">${setting("Ticket de servicos referencia","Referencia para pontuar o valor medio dos servicos executados.","c04-ticket","number",c.franchiseAverageTicket)}${setting("Peso recorrencia","Participacao da recorrencia continua no score final.","c04-w-rec","number",c.weights.recurrence)}${setting("Peso ticket de servicos","Participacao do ticket de servicos realizados no score final.","c04-w-ticket","number",c.weights.ticket)}${setting("Excelente ate dias","Referencia superior para classificacao excelente.","c04-r-ex","number",c.recurrenceLimits.excellent)}${setting("Bom ate dias","Referencia superior para classificacao boa.","c04-r-good","number",c.recurrenceLimits.good)}${setting("Melhorar ate dias","Referencia superior antes da classificacao ruim.","c04-r-improve","number",c.recurrenceLimits.improve)}</div></div><div class="c04-section"><h4>Mapa e cores</h4><div class="c04-grid">${setting("Raio cluster","Distancia em pixels usada para agrupar pins.","c04-cluster","number",c.clusterRadius)}${setting("Pin cliente","Cor principal dos pins de clientes.","c04-color-client","color",c.colors.clientPin)}${setting("Pin Clube04","Cor do marcador especial da unidade.","c04-color-store","color",c.colors.storePin)}${setting("Clusters","Cor principal dos agrupamentos.","c04-color-cluster","color",c.colors.cluster)}${setting("Score baixo","Cor da faixa baixa de score.","c04-color-low","color",c.colors.scoreLow)}${setting("Score medio","Cor da faixa media de score.","c04-color-medium","color",c.colors.scoreMedium)}${setting("Score bom","Cor da faixa boa de score.","c04-color-good","color",c.colors.scoreGood)}${setting("Score alto","Cor da faixa alta de score.","c04-color-high","color",c.colors.scoreHigh)}</div></div><div class="c04-section"><h4>Heatmaps</h4><div class="c04-grid">${setting("Opacidade","Transparencia das camadas de calor.","c04-opacity","number",c.heatmaps.opacity,'step=".05"')}${setting("Raio","Area de influencia de cada cliente no heatmap.","c04-radius","number",c.heatmaps.radius)}${setting("Intensidade","Multiplicador visual dos heatmaps.","c04-intensity","number",c.heatmaps.intensity,'step=".1"')}${setting("Visitas baixa","Inicio da escala do heatmap de visitas.","c04-heat-visits-low","color",c.colors.heatVisitsLow)}${setting("Visitas alta","Fim da escala do heatmap de visitas.","c04-heat-visits-high","color",c.colors.heatVisitsHigh)}${setting("Valor servicos baixa","Inicio da escala do heatmap de valor de servicos.","c04-heat-spend-low","color",c.colors.heatSpendLow)}${setting("Valor servicos alta","Fim da escala do heatmap de valor de servicos.","c04-heat-spend-high","color",c.colors.heatSpendHigh)}${setting("Score baixa","Inicio da escala do heatmap de score.","c04-heat-score-low","color",c.colors.heatScoreLow)}${setting("Score alta","Fim da escala do heatmap de score.","c04-heat-score-high","color",c.colors.heatScoreHigh)}</div></div><br><button class="c04-btn" id="c04-save-settings">Salvar</button> <button class="c04-btn alt" id="c04-restore-tab">Restaurar padroes desta aba</button> <button class="c04-btn alt" id="c04-restore-all">Restaurar todos os padroes</button></div>
        <div class="c04-tab-panel" id="c04-tab-diagnostics"><button class="c04-btn" id="c04-test-general">Diagnostico geral</button> <button class="c04-btn alt" id="c04-test-connection">Planilha e Apps Script</button> <button class="c04-btn alt" id="c04-test-write">Testar escrita</button> <button class="c04-btn alt" id="c04-test-map">Mapa e APIs</button> <button class="c04-btn alt" id="c04-test-collection">Coleta sem escrita</button><div id="c04-diagnostic-result"></div></div>
        <div class="c04-tab-panel" id="c04-tab-pendings"><p>Use o botao abaixo para analisar e tratar pendencias sem alterar o Clube04.</p><button class="c04-btn alt" id="c04-pendings">Abrir central de pendencias</button></div>
        <div class="c04-tab-panel" id="c04-tab-history"><button class="c04-btn alt" id="c04-logs">Abrir historico e logs</button></div>
        <div class="c04-tab-panel" id="c04-tab-advanced">${root.C04GeoCore.canRunFullScan(visibleUser()) ? `<button class="c04-btn danger" id="c04-full">Varredura completa</button> <button class="c04-btn alt" id="c04-migration-preview">Previa da reconstrucao</button> <button class="c04-btn danger" id="c04-reset-database">Limpar banco GEO</button>` : "<p>Opcoes avancadas restritas.</p>"}</div>`)}
        ${modal("c04-list-modal","Clientes selecionados",`<table class="c04-table"><thead><tr><th>Cliente</th><th>Bairro</th><th>Visitas</th><th>Ticket</th><th>Gasto</th><th>Score</th></tr></thead><tbody id="c04-list-body"></tbody></table>`)}
        ${modal("c04-log-modal","Historico e logs",`<h4>Execucoes</h4><table class="c04-table"><thead><tr><th>Inicio</th><th>Tipo</th><th>Status</th><th>Periodo</th></tr></thead><tbody id="c04-log-body"></tbody></table><h4>Pendencias detalhadas</h4><table class="c04-table"><thead><tr><th>Data</th><th>Fonte</th><th>Motivo</th><th>Mensagem</th></tr></thead><tbody id="c04-log-detail-body"></tbody></table>`)}
        ${modal("c04-pending-modal","Central de pendencias",`<p>As correcoes afetam somente o modulo GEO.</p><div class="c04-grid"><label>Status<select id="c04-pending-status"><option value="">Todos</option><option>open</option><option>resolved</option><option>ignored</option></select></label><label>Fonte<input id="c04-pending-source"></label><label>Motivo<input id="c04-pending-reason"></label></div><table class="c04-table"><thead><tr><th>Status</th><th>Fonte</th><th>Motivo</th><th>Cliente</th><th>Detalhe</th><th>Acao</th></tr></thead><tbody id="c04-pending-body"></tbody></table>`)}
        ${modal("c04-full-modal","Confirmar varredura completa",`<p class="c04-error"><b>Esta operacao pode consumir cota da Geocoding API.</b></p><p id="c04-full-estimate"></p><label>Digite VARREDURA para confirmar <input id="c04-full-confirm"></label><div class="c04-actions"><button class="c04-btn danger c04-sync" id="c04-run-full" disabled>Executar varredura completa</button></div>`)}
        ${modal("c04-reset-modal","Confirmar limpeza do banco GEO",`<p class="c04-error"><b>Esta operacao remove somente os dados controlados pelo modulo GEO.</b></p><label>Digite LIMPAR BANCO GEO para confirmar <input id="c04-reset-confirm"></label><div class="c04-actions"><button class="c04-btn danger" id="c04-run-reset" disabled>Limpar banco GEO</button></div>`)}
        `; document.body.appendChild(panel); bind();
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
