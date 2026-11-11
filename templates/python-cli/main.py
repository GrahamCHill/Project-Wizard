import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="__PROJECT_NAME__")
    parser.add_argument("name", nargs="?", default="world")
    args = parser.parse_args()
    print(f"Hello, {args.name}!")


if __name__ == "__main__":
    main()
