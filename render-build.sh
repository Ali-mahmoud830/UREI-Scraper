#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing required Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Installing Playwright chromium binaries..."
# Playwright needs these to run the headless browser instances on Render
playwright install chromium --with-deps
