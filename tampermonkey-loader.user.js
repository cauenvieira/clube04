// ==UserScript==
// @name         Clube04 • Suite
// @namespace    https://clube04.com.br/
// @version      12.0.0
// @description  Loader de produção do Clube04 Suite.
// @author       Cauê Neves Vieira
// @match        https://clube04.com.br/digital/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/cauenvieira/clube04/main/tampermonkey-loader-dev.user.js
// @downloadURL  https://raw.githubusercontent.com/cauenvieira/clube04/main/tampermonkey-loader-dev.user.js
// ==/UserScript==

(function () {
  "use strict";

  const PROD_URL = "https://cdn.jsdelivr.net/gh/cauenvieira/clube04@main/clube04-suite.js";
  const SCRIPT_ID = "c04-suite-loader-prod";

  function loadScript(url) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${url}?t=${Date.now()}`;
    document.body.appendChild(script);
  }

  if (!document.getElementById(SCRIPT_ID)) {
    loadScript(PROD_URL);
  }
})();