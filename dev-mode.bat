@echo off
:: --- BLOCO DE AUTO-ELEVACAO PARA ADMIN ---
:checkPrivileges
NET SESSION >nul 2>&1
if %errorLevel% == 0 (
    goto :gotAdmin
) else (
    goto :getAdmin
)

:getAdmin
echo =====================================================
echo  Solicitando permissao de Administrador...
echo =====================================================
:: Cria um comando PowerShell para reiniciar este batch como Admin
powershell -Command "Start-Process '%~f0' -Verb RunAs"
exit /b

:gotAdmin
:: --- AQUI COMEÇA O SEU SCRIPT REAL ---
:: Garante que o cmd use a pasta onde o arquivo está salvo
cd /d "%~dp0"

cls
color 0A
echo.
echo =====================================================
echo    CLUBE04 - AMBIENTE DE HOMOLOGACAO (ADMIN)
echo =====================================================
echo.
echo  [1] Pasta atual: %CD%
echo  [2] Porta: 8080 (Ajuste no Tampermonkey se mudar)
echo.
echo  INICIANDO SERVIDOR... 
echo  (Mantenha esta janela aberta enquanto desenvolve)
echo.

:: Roda o servidor (usando call para nao fechar se der erro no npx)
call npx http-server --cors -c-1 -p 8080

:: Se o servidor cair ou voce der Ctrl+C, ele pausa antes de fechar
echo.
echo Servidor parado.
pause
