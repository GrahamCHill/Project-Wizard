import argparse
from pathlib import Path

import numpy as np
import onnxruntime as ort


def main():
    parser = argparse.ArgumentParser(description="Classify Iris measurements with ONNX Runtime.")
    parser.add_argument("measurements", type=float, nargs=4, metavar="CM",
                        help="Sepal length, sepal width, petal length, and petal width")
    args = parser.parse_args()
    artifact = Path(__file__).parent / "artifacts" / "iris.onnx"
    if not artifact.is_file():
        parser.error("Run export_model.py to generate the ONNX model first.")
    values = np.array([args.measurements], dtype=np.float32)
    if not np.isfinite(values).all():
        parser.error("Enter four finite measurements.")
    session = ort.InferenceSession(str(artifact), providers=["CPUExecutionProvider"])
    labels = session.run(None, {"measurements": values})[0]
    names = ("setosa", "versicolor", "virginica")
    print(f"Predicted {names[int(labels[0])]}")


if __name__ == "__main__":
    main()
