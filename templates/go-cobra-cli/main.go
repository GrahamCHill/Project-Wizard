package main

import (
	"os"

	"example.com/__PROJECT_SLUG__/cmd"
)

func main() {
	os.Exit(cmd.Execute(os.Args[1:], os.Stdout, os.Stderr))
}
