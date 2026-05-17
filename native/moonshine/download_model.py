import sys
from moonshine_voice.download import get_model_for_language
from moonshine_voice import ModelArch
import logging

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

if len(sys.argv) < 2:
    print("Please specify a model architecture.")
    sys.exit(1)

model_name = sys.argv[1].upper()
try:
    arch = getattr(ModelArch, model_name)
    print(f"Downloading model {model_name}...")
    # This will trigger download if not present and print to stderr (from huggingface_hub)
    get_model_for_language('en', arch)
    print("Done")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
