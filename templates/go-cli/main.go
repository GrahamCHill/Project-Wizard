package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

const defaultName = "__PROJECT_NAME__"

// greeting returns the message printed by the program. A blank name selects
// the default message.
func greeting(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "Hello from " + defaultName + "!"
	}
	return "Hello, " + name + "!"
}

// run executes the command and returns the process exit code. It takes its
// arguments and output streams as parameters so tests can call it directly.
func run(args []string, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet(defaultName, flag.ContinueOnError)
	flags.SetOutput(stderr)
	name := flags.String("name", "", "name to greet")
	if err := flags.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return 0
		}
		return 2
	}
	if flags.NArg() > 0 {
		fmt.Fprintf(stderr, "unexpected arguments: %s\n", strings.Join(flags.Args(), " "))
		return 2
	}
	fmt.Fprintln(stdout, greeting(*name))
	return 0
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}
