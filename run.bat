@echo off
cd /d "%~dp0"
python -m pip install -r requirements.txt -q
echo.
echo Abre en el navegador: http://127.0.0.1:5050
echo.
python app.py
