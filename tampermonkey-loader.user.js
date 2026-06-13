// ==UserScript==
// @name         Clube04 • Suite (HÍBRIDO + BRIDGE)
// @namespace    https://clube04.com.br/
// @version      10.0.0
// @description  Ponte de Download via API OneDrive.
// @author       Cauê Neves Vieira
// @match        https://clube04.com.br/digital/*
// @connect      1drv.ms
// @connect      api.onedrive.com
// @connect      *.sharepoint.com
// @connect      onedrive.live.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==
(function () {
    "use strict";
    const LOCAL_URL = "http://127.0.0.1:8080/clube04-suite.js";
    const PROD_URL = "https://cdn.jsdelivr.net/gh/cauenvieira/clube04@main/clube04-suite.js";
    const SCRIPT_ID = "c04-suite-loader-hybrid";
    const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbysfQZqurK-7TJQXOQSruTjF6k8J_DvLUlmf2ib1ln4ASYC6gN2BD01aRMSkPju1Cdb/exec";
    const APPS_SCRIPT_SECRET = "sAJnd6*¨(*#!@bisd#";
    function respond(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }
    window.addEventListener("c04_request_download", function (event) {
        GM_xmlhttpRequest({
            method: "GET",
            url: event.detail.url,
            responseType: "arraybuffer",
            onload: response => respond("c04_response_download", response.status >= 400 ?
                { status: "error", error: `HTTP ${response.status}` } :
                { status: "success", data: response.response }),
            onerror: error => respond("c04_response_download", { status: "error", error })
        });
    });
    window.addEventListener("c04_geo_sheet_request", function (event) {
        const detail = event.detail || {};
        GM_xmlhttpRequest({
            method: "POST",
            url: APPS_SCRIPT_URL,
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            data: JSON.stringify(Object.assign({}, detail.body, { secret: APPS_SCRIPT_SECRET })),
            responseType: "json",
            onload: function (response) {
                const result = response.response || {};
                respond("c04_geo_sheet_response", result.ok ?
                    { id: detail.id, status: "success", data: result.data } :
                    { id: detail.id, status: "error", error: result.error || `HTTP ${response.status}` });
            },
            onerror: error => respond("c04_geo_sheet_response",
                { id: detail.id, status: "error", error: String(error && error.error || error) })
        });
    });
    document.documentElement.setAttribute("data-c04-geo-bridge-ready",
        APPS_SCRIPT_URL && APPS_SCRIPT_SECRET && !APPS_SCRIPT_URL.startsWith("REPLACE_") ? "true" : "false");
    function showDevBadge() {
        const badge = document.createElement("div");
        badge.id = "c04-dev-mode-badge";
        badge.textContent = "🔧 DEV MODE";
        badge.style.cssText = "position:fixed;bottom:35px;right:110px;background:#ff0055;color:#fff;padding:6px 12px;border-radius:20px;font:700 11px monospace;z-index:100000;pointer-events:none";
        document.body.appendChild(badge);
    }
    function loadScript(url, isDev) {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = `${url}?t=${Date.now()}`;
        script.onload = () => { if (isDev) showDevBadge(); };
        script.onerror = () => {
            script.remove();
            if (isDev) loadScript(PROD_URL, false);
        };
        document.body.appendChild(script);
    }
    if (!document.getElementById(SCRIPT_ID)) loadScript(LOCAL_URL, true);
})();
