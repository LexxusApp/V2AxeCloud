@echo off
title AxeCloud Control Center - Local
cd /d "%~dp0.."
start "" /b cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:5174"
echo.
echo  AXECLOUD CONTROL CENTER
echo  Admin:   http://localhost:5174
echo  Backend: http://localhost:3000
echo.
echo  Mantenha esta janela aberta durante o uso.
echo  Pressione Ctrl+C para encerrar o ambiente local.
echo.
call npm.cmd run dev:admin
