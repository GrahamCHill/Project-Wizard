import numpy as np


def train(steps=3000, learning_rate=0.2):
    rng = np.random.default_rng(42)
    features = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
    labels = np.array([[0], [1], [1], [0]], dtype=float)
    hidden_weights = rng.normal(0, 1, (2, 4))
    output_weights = rng.normal(0, 1, (4, 1))
    hidden_bias = np.zeros((1, 4))
    output_bias = np.zeros((1, 1))

    for _ in range(steps):
        hidden = np.tanh(features @ hidden_weights + hidden_bias)
        probabilities = 1 / (1 + np.exp(-(hidden @ output_weights + output_bias)))
        output_error = (probabilities - labels) / len(features)
        hidden_error = (output_error @ output_weights.T) * (1 - hidden**2)
        output_weights -= learning_rate * hidden.T @ output_error
        output_bias -= learning_rate * output_error.sum(axis=0, keepdims=True)
        hidden_weights -= learning_rate * features.T @ hidden_error
        hidden_bias -= learning_rate * hidden_error.sum(axis=0, keepdims=True)

    hidden = np.tanh(features @ hidden_weights + hidden_bias)
    logits = hidden @ output_weights + output_bias
    return (logits >= 0).astype(int).ravel().tolist()


if __name__ == "__main__":
    print("XOR predictions:", train())
