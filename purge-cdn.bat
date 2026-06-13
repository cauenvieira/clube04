@findstr/v "^@f" "%~f0" | powershell -NoProfile -ExecutionPolicy Bypass -Command - & pause & goto :EOF
# --- O código PowerShell abaixo é executado automaticamente pelo interpretador ---
$userRepo = "cauenvieira/clube04@main"
$currentDir = (Get-Location).Path

# 1. Busca os arquivos na raiz e na pasta modules
$allFiles = Get-ChildItem -Recurse -File | 
    Where-Object { 
        $relative = $_.FullName.Replace($currentDir + "\", "").Replace("\", "/")
        # Apenas arquivos na raiz (sem barras) ou na pasta modules/
        ($relative -notmatch '/' -or $relative -like 'modules/*') -and
        $_.Extension -match '^\.(js|json|css)$' -and
        $_.Name -notlike 'purge-cdn.*'
    } | 
    ForEach-Object { 
        $_.FullName.Replace($currentDir + "\", "").Replace("\", "/") 
    }

if ($allFiles.Count -eq 0) {
    Write-Host "❌ Nenhum arquivo elegivel encontrado (.js, .json, .css)." -ForegroundColor Red
    exit
}

# 2. Lista os arquivos e pede exclusão interativa
Write-Host "📋 Arquivos detectados para limpeza (raiz e modules):" -ForegroundColor Cyan
for ($i = 0; $i -lt $allFiles.Count; $i++) {
    Write-Host "   [$($i + 1)] $($allFiles[$i])"
}
Write-Host ""
Write-Host "Dica: Digite os numeros dos arquivos que quer REMOVER da limpeza (ex: 1,3) ou pressione Enter para limpar todos." -ForegroundColor Gray
$input = Read-Host "Remover da lista"

$toRemove = @()
if ($input -trim) {
    $parts = $input.Split(',')
    foreach ($part in $parts) {
        $val = 0
        if ([int]::TryParse($part.Trim(), [ref]$val)) {
            $idx = $val - 1
            if ($idx -ge 0 -and $idx -lt $allFiles.Count) {
                $toRemove += $allFiles[$idx]
            }
        }
    }
}

# Filtra a lista final
$filesToPurge = $allFiles | Where-Object { $toRemove -notcontains $_ }

if ($filesToPurge.Count -eq 0) {
    Write-Host "❌ Nenhum arquivo restou na lista. Cancelando limpeza." -ForegroundColor Red
    exit
}

# 3. Executa a limpeza dos arquivos selecionados
Write-Host ""
Write-Host "🧹 Iniciando limpeza (purge) de cache no jsDelivr..." -ForegroundColor Cyan
foreach ($file in $filesToPurge) {
    $url = "https://purge.jsdelivr.net/gh/$userRepo/$file"
    try {
        $res = Invoke-RestMethod -Uri $url -Method Get
        if ($res.status -eq "ok" -or $res.success -or $res.id) {
            Write-Host "   ✅ [SUCESSO] $file - Cache limpo!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ [ATENÇÃO] $file - Resposta inesperada" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ [ERRO] Falha ao limpar cache de $($file): $_" -ForegroundColor Red
    }
}
Write-Host "🏁 Limpeza de cache concluida!" -ForegroundColor Cyan
