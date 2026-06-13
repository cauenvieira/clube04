/**
 * SCRIPT DE LIMPEZA DE CACHE (PURGE) - JSDELIVR
 * Rodar com: node purge-cdn.js
 */

const FILES = [
    "clube04-suite.js",
    "modules/geo/c04-geolocalizacao.js",
    "modules/geo/c04-geo-config.js",
    "modules/geo/c04-geo-core.js",
    "modules/geo/c04-geo-data.js",
    "modules/geo/c04-geo-map.js",
    "modules/geo/c04-geo-sheets.js",
    "modules/metas/c04-metas.js",
    "modules/ponto/c04-ponto.js"
];

const USER_REPO = "cauenvieira/clube04@main";

async function purge() {
    console.log("🧹 Iniciando limpeza (purge) de cache do jsDelivr...");
    for (const file of FILES) {
        const url = `https://purge.jsdelivr.net/gh/${USER_REPO}/${file}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === "ok" || data.success || data.id) {
                console.log(`✅ [SUCESSO] ${file} - Cache limpo!`);
            } else {
                console.warn(`⚠️ [ATENÇÃO] ${file} - Resposta inesperada:`, data);
            }
        } catch (e) {
            console.error(`❌ [ERRO] Falha ao limpar cache de ${file}:`, e.message);
        }
    }
    console.log("🏁 Limpeza de cache concluída!");
}

purge();
