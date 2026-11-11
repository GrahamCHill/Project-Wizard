import tkinter as tk
from tkinter import ttk


def main() -> None:
    window = tk.Tk()
    window.title("__PROJECT_NAME__")
    window.geometry("480x280")
    ttk.Label(window, text="__PROJECT_NAME__").pack(expand=True)
    window.mainloop()


if __name__ == "__main__":
    main()
