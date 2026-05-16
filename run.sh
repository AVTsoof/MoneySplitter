#!/bin/bash

# MoneySplitter Run Script
# Activates the virtual environment and launches the Streamlit app.

VENV_DIR=".venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "❌ Virtual environment not found. Please run ./bootstrap.sh first."
    exit 1
fi

echo "🔌 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

echo "✨ Launching MoneySplitter..."
streamlit run app.py
