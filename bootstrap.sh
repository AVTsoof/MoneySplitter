#!/bin/bash

# MoneySplitter Bootstrap Script
# Sets up a Python virtual environment and installs dependencies.

VENV_DIR=".venv"

echo "🚀 Bootstrapping MoneySplitter..."

if [ -d "$VENV_DIR" ]; then
    printf "Virtual environment already exists. Do you want to overwrite it? (y/N): "
    read response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "🗑️  Removing existing virtual environment..."
        rm -rf "$VENV_DIR"
    else
        echo "⏭️  Skipping VENV creation, keeping existing one."
    fi
fi

if [ ! -d "$VENV_DIR" ]; then
    echo "🛠️  Creating virtual environment in $VENV_DIR..."
    python3 -m venv "$VENV_DIR" || { echo "❌ Failed to create venv. Is python3-venv installed?"; exit 1; }
fi

echo "🔌 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

echo "📦 Installing requirements from core/requirements.txt..."
pip install --upgrade pip
pip install -r core/requirements.txt

echo ""
echo "✅ Setup complete!"
echo "👉 Run the app using: ./run.sh"
