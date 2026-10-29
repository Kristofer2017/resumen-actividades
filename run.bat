@echo off
cd /d "%~dp0"
python -m pip install -r requirements.txt -q

if not exist "frontend\node_modules" (
  echo Instalando dependencias del frontend...
  pushd frontend
  call npm install
  popd
)

echo Compilando frontend...
pushd frontend
call npm run build
popd

echo.
echo Abre en el navegador: http://127.0.0.1:5050
echo.
python app.py
