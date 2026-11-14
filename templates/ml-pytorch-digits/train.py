from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from model import make_model, split_digits


def main():
    torch.manual_seed(42)
    train_images, test_images, train_labels, test_labels = split_digits()
    batches = DataLoader(TensorDataset(train_images, train_labels), batch_size=64, shuffle=True)
    model = make_model()
    loss_fn = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

    for _ in range(12):
        for images, labels in batches:
            optimizer.zero_grad()
            loss_fn(model(images), labels).backward()
            optimizer.step()

    model.eval()
    with torch.inference_mode():
        accuracy = (model(test_images).argmax(dim=1) == test_labels).float().mean().item()
    artifact = Path(__file__).parent / "artifacts" / "digits.pt"
    artifact.parent.mkdir(exist_ok=True)
    torch.save(model.state_dict(), artifact)
    print(f"Holdout accuracy {accuracy:.1%}")
    print(f"Saved weights to {artifact}")


if __name__ == "__main__":
    main()
