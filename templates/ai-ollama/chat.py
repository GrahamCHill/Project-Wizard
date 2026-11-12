import argparse
import json
from urllib.error import URLError
from urllib.request import Request, urlopen


def chat(model, prompt):
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }).encode()
    request = Request(
        "http://127.0.0.1:11434/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urlopen(request, timeout=120) as response:
        return json.load(response)["message"]["content"]


def main():
    parser = argparse.ArgumentParser(description="Send one prompt to a local Ollama model.")
    parser.add_argument("--model", required=True, help="Name shown by ollama list")
    parser.add_argument("prompt")
    args = parser.parse_args()
    try:
        print(chat(args.model, args.prompt))
    except URLError as error:
        parser.exit(1, f"Ollama request failed: {error}\nCheck that Ollama is running and the model is installed.\n")


if __name__ == "__main__":
    main()
