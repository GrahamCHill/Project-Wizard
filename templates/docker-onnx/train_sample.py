from pathlib import Path

import numpy as np
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType


def main():
    iris = load_iris()
    model = make_pipeline(StandardScaler(), LogisticRegression())
    model.fit(iris.data.astype(np.float32), iris.target)
    onnx = convert_sklearn(model, initial_types=[("measurements", FloatTensorType([None, 4]))],
                           options={id(model.steps[-1][1]): {"zipmap": False}})
    Path("sample.onnx").write_bytes(onnx.SerializeToString())


if __name__ == "__main__":
    main()
