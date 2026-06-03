#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
JOBSPY_DIR="$PROJECT_ROOT/native/jobspy"

echo "Setting up JobSpy Python environment..."
cd "$JOBSPY_DIR"

echo "Creating virtual environment using uv..."
uv venv --python 3.11 venv

echo "Installing requirements with uv..."
VIRTUAL_ENV="$JOBSPY_DIR/venv"
uv pip install -r requirements.txt --python "$VIRTUAL_ENV/bin/python"

echo "Done! The jobspy environment is ready."
