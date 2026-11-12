from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def train_and_score():
    features, labels = load_iris(return_X_y=True)
    x_train, x_test, y_train, y_test = train_test_split(
        features, labels, test_size=0.25, stratify=labels, random_state=42
    )
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=500))
    model.fit(x_train, y_train)
    return model.score(x_test, y_test)


if __name__ == "__main__":
    print(f"Held-out accuracy: {train_and_score():.1%}")
