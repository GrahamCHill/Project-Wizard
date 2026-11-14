import argparse
from pathlib import Path

import torch

from model import make_model, split_digits


def main():
    parser = argparse.ArgumentParser(description="Classify a held-out handwritten digit.")
    parser.add_argument("--index", type=int, default=0, help="Index in the holdout split")
    args = parser.parse_args()
    artifact = Path(__file__).parent / "artifacts" / "digits.pt"
    if not artifact.is_file():
        parser.error("Run train.py to generate the model weights first.")
    _, images, _, labels = split_digits()
    if not 0 <= args.index < len(images):
        parser.error(f"Choose an index between 0 and {len(images) - 1}.")
    model = make_model()
    model.load_state_dict(torch.load(artifact, map_location="cpu", weights_only=True))
    model.eval()
    with torch.inference_mode():
        prediction = model(images[args.index]).argmax().item()
    print(f"Predicted {prediction}, actual {labels[args.index].item()}")


if __name__ == "__main__":
    main()
