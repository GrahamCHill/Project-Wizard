from pathlib import Path

import numpy as np
import onnxruntime as ort
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType


def main():
    dataset = load_iris()
    features = dataset.data.astype(np.float32)
    train_x, test_x, train_y, test_y = train_test_split(
        features, dataset.target, test_size=0.25, random_state=42, stratify=dataset.target
    )
    classifier = make_pipeline(StandardScaler(), LogisticRegression())
    classifier.fit(train_x, train_y)
    model = convert_sklearn(
        classifier, initial_types=[("measurements", FloatTensorType([None, features.shape[1]]))]
    )
    data = model.SerializeToString()
    session = ort.InferenceSession(data, providers=["CPUExecutionProvider"])
    result = session.run(None, {"measurements": test_x})[0]
    np.testing.assert_array_equal(result, classifier.predict(test_x))

    artifact = Path(__file__).parent / "artifacts" / "iris.onnx"
    artifact.parent.mkdir(exist_ok=True)
    artifact.write_bytes(data)
    print(f"Holdout accuracy {np.mean(result == test_y):.1%}")
    print(f"ONNX predictions match scikit-learn. Saved {artifact}")


if __name__ == "__main__":
    main()
