@echo off
title Limpar Cache jsDelivr
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0purge-cdn.ps1"
pause
