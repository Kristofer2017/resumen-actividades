@echo off
REM Desarrollo: API en http://127.0.0.1:5050 y Vite con recarga en http://127.0.0.1:5173
cd /d "%~dp0"

start "Bitacora API" cmd /k "python -m pip install -r requirements.txt -q && python app.py"

cd frontend
if not exist node_modules (
  echo Instalando dependencias del frontend...
  call npm install
)
call npm run dev
