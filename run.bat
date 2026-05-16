@echo off
set VENV_DIR=.venv

if not exist %VENV_DIR% (
    echo Virtual environment not found. Please run bootstrap.bat first.
    pause
    exit /b 1
)

echo Activating virtual environment...
call %VENV_DIR%\Scripts\activate

echo Launching MoneySplitter...
streamlit run app.py
pause
