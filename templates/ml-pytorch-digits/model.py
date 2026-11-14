from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
import torch
from torch import nn


def split_digits():
    digits = load_digits()
    images = torch.tensor(digits.data / 16.0, dtype=torch.float32)
    labels = torch.tensor(digits.target, dtype=torch.long)
    return train_test_split(images, labels, test_size=0.25, random_state=42, stratify=labels)


def make_model():
    return nn.Sequential(nn.Linear(64, 64), nn.ReLU(), nn.Linear(64, 10))
