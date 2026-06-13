"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("GEO UI exposes cancellation, sidebar controls and translated layers", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geolocalizacao.js"), "utf8");
    assert.match(source, /Cancelar sincronizacao/);
    assert.match(source, /sidebar-closed/);
    assert.match(source, /id="c04-toggle-sidebar"/);
    assert.match(source, /Cadastro/);
    assert.doesNotMatch(source, /Mapa de referencia/);
    assert.match(source, /Diagnostico geral/);
    assert.match(source, /c04-toggle-head/);
    assert.match(source, /c04-toggle-progress/);
    assert.match(source, /c04-reset-modal/);
    assert.doesNotMatch(source, /prompt\("Esta acao limpa todas as abas GEO/);
    ["Visitas", "Valor de servicos", "Resumo geral filtrado", "Camadas analiticas", "Camadas de contexto",
        "Restaurar padroes desta aba", "Restaurar todos os padroes"].forEach(label => assert.match(source, new RegExp(label)));
    assert.doesNotMatch(source, /Limites geograficos/);
    assert.match(source, /testStaging/);
    assert.match(source, /diagnosticGeocode/);
    assert.match(source, /withTimeout/);
    assert.match(source, /C04GeoCore\.escapeHtml\(JSON\.stringify/);
    assert.match(source, /event\.stopImmediatePropagation\(\)/);
    assert.match(source, /addEventListener\("keydown", keydownHandler, true\)/);
    assert.match(fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-data.js"), "utf8"), /const warning = built\.counts\.minimal/);
    assert.match(fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-data.js"), "utf8"), /salesHeaders: Object\.keys/);
    assert.match(fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-data.js"), "utf8"), /csvHeaders: Object\.keys/);
    assert.match(fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-data.js"), "utf8"), /exactNameMatches, exactPhoneMatches/);
    assert.match(fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-data.js"), "utf8"), /const pendingReasons = built\.pending\.reduce/);
});

test("map uses scale, reduced rectangle and satellite without rebuilding", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-map.js"), "utf8");
    assert.match(source, /scaleControl: true/);
    assert.match(source, /fullscreenControl: false/);
    assert.match(source, /setMapTypeId/);
    assert.match(source, /computeOffset\(center, 1500/);
    assert.match(source, /selections\.some/);
    assert.doesNotMatch(source, /if \(type === "satellite"\) rebuildMap/);
    assert.match(source, /title = "Centralizar no Clube04"/);
    assert.match(source, /clearMarkers\(\); clusterer\.setMap\(null\); createClusterer\(state\.pins\)/);
    assert.match(source, /v=quarterly/);
    assert.doesNotMatch(source, /boundaryGeoJsonUrl/);
});

test("map does not force progress outside short viewports", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geolocalizacao.js"), "utf8");
    assert.match(source, /#c04-geo-map\s*\{\s*width:\s*100%;\s*height:\s*100%;\s*min-height:\s*0;?\s*\}/);
    assert.doesNotMatch(source, /#c04-geo-map\{[^}]*min-height:500px/);
    assert.match(source, /#c04-geo-progress\s*\{\s*left:\s*50%;\s*bottom:\s*(?:30px|36px)/);
    assert.match(source, /#c04-toggle-head\s*\{\s*position:\s*absolute;\s*right:\s*(?:54px|56px)/);
    assert.match(source, /not\(#c04-geo-close\)/);
    assert.match(source, /function restoreFullscreenState/);
    assert.match(source, /panel\.dataset\.progressClosed/);
    assert.match(source, /Fullscreen indisponivel/);
});
