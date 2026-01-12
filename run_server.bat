@echo off
TITLE Backend Server
@REM cd /d "c:\Users\kripa\Downloads\anti\backend"
cd /d "C:\Users\kripa\Downloads\ProjectByDigicoders\fms\fms\FeeManagementSystem"

:start
echo Starting Backend Server...
echo If the window closes, it will restart automatically.
call npm start

echo.
echo Server stopped. Restarting in 5 seconds...
echo Press CTRL+C to cancel.
timeout /t 5
goto start
