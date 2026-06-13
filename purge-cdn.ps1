# Script PowerShell para limpar o cache do jsDelivr
$files = @(
    "clube04-suite.js",
    "modules/geo/c04-geolocalizacao.js",
    "modules/geo/c04-geo-config.js",
    "modules/geo/c04-geo-core.js",
    "modules/geo/c04-geo-data.js",
    "modules/geo/c04-geo-map.js",
    "modules/geo/c04-geo-sheets.js",
    "modules/metas/c04-metas.js",
    "modules/ponto/c04-ponto.js"
)

$userRepo = "cauenvieira/clube04@main"

Write-Host "🧹 Iniciando limpeza (purge) de cache do jsDelivr..." -ForegroundColor Cyan

foreach ($file in $files) {
    $url = "https://purge.jsdelivr.net/gh/$userRepo/$file"
    try {
        $res = Invoke-RestMethod -Uri $url -Method Get
        if ($res.status -eq "ok" -or $res.success -or $res.id) {
            Write-Host "✅ [SUCESSO] $file - Cache limpo!" -ForegroundColor Green
        } else {
            Write-Host "⚠️ [ATENÇÃO] $file - Resposta inesperada: $($res | ConvertTo-Json -Compress)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ [ERRO] Falha ao limpar cache de $($file): $_" -ForegroundColor Red
    }
}

Write-Host "🏁 Limpeza de cache concluída!" -ForegroundColor Cyan
