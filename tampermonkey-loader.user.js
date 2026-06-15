// ==UserScript==
// @name         Clube04 • Suite (HÍBRIDO + BRIDGE)
// @namespace    https://clube04.com.br/
// @version      11.0.0
// @description  Carregador híbrido do Clube04 Suite com suporte local e produção para o módulo GEO integrado ao Supabase.
// @author       Cauê Neves Vieira
// @match        https://clube04.com.br/digital/*
// @grant        none
// ==/UserScript==
(function () {
    "use strict";
    const LOCAL_URL = "http://127.0.0.1:8080/clube04-suite.js";
    const PROD_URL = "https://cdn.jsdelivr.net/gh/cauenvieira/clube04@main/clube04-suite.js";
    const SCRIPT_ID = "c04-suite-loader-hybrid";

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
