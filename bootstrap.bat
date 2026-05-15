@echo off
echo Bootstrapping MoneySplitter for Windows...

set VENV_DIR=.venv

if exist %VENV_DIR% (
    set /p response="Virtual environment already exists. Overwrite it? (y/N): "
    if /i "%response%"=="y" (
        echo Removing existing virtual environment...
        rmdir /s /q %VENV_DIR%
    ) else (
        echo Skipping VENV creation.
        goto install
    )
)

echo Creating virtual environment...
python -m venv %VENV_DIR%

:install
echo Activating virtual environment...
call %VENV_DIR%\Scripts\activate

echo Installing requirements...
python -m pip install --upgrade pip
pip install -r core/requirements.txt

echo.
echo Setup complete!
echo Run the app using: run.bat
pause
