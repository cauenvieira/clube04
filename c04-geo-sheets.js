(function (root) {
    "use strict";
    let requestId = 0;
    function configured() {
        return document.documentElement.getAttribute("data-c04-geo-bridge-ready") === "true";
    }
    function request(action, payload) {
        if (!configured()) return Promise.reject(new Error("Configure o endpoint e o segredo do Apps Script no Tampermonkey."));
        return new Promise((resolve, reject) => {
            const id = `c04-geo-${Date.now()}-${requestId += 1}`;
            const timeout = setTimeout(() => { cleanup(); reject(new Error("Tempo excedido ao consultar Google Sheets.")); }, 60000);
            function cleanup() { clearTimeout(timeout); root.removeEventListener("c04_geo_sheet_response", handler); }
            function handler(event) {
                if (!event.detail || event.detail.id !== id) return;
                cleanup();
                if (event.detail.status === "success") resolve(event.detail.data);
                else reject(new Error(event.detail.error || "Falha no Google Sheets."));
            }
            root.addEventListener("c04_geo_sheet_response", handler);
            root.dispatchEvent(new CustomEvent("c04_geo_sheet_request", { detail: {
                id, body: { action, payload: payload || {} }
            } }));
        });
    }
    root.C04GeoSheets = {
        configured,
        snapshot: () => request("snapshot"),
        upsert: (payload) => request("upsert", payload),
        stageBatch: (payload) => request("stageBatch", payload),
        publishRun: (payload) => request("publishRun", payload),
        discardRun: (payload) => request("discardRun", payload),
        startRun: (payload) => request("startRun", payload),
        finishRun: (payload) => request("finishRun", payload),
        saveSettings: (payload) => request("saveSettings", payload),
        logs: (payload) => request("logs", payload),
        healthCheck: () => request("healthCheck").catch(error => {
            if (error.message !== "Acao invalida.") throw error;
            return request("snapshot").then(() => ({ ok: true, serviceVersion: "legacy",
                warning: "Conexao valida, mas a implantacao do Apps Script esta desatualizada." }));
        }),
        testWrite: () => request("testWrite"),
        testStaging: () => request("testStaging"),
        pendings: (payload) => request("pendings", payload),
        resolvePending: (payload) => request("resolvePending", payload),
        reopenPending: (payload) => request("reopenPending", payload),
        consumeRetries: () => request("consumeRetries"),
        migrationPreview: () => request("migrationPreview"),
        resetDatabase: (payload) => request("resetDatabase", payload),
        cleanup: () => request("cleanup", { retentionMonths: root.C04GeoConfig.logRetentionMonths })
    };
})(window);
