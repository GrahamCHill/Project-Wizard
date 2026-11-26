// Package cmd defines the command line. Each command is built by a function that takes no global
// state, so tests can create a fresh command, set its arguments and output, and run it.
package cmd

import (
	"fmt"
	"io"

	"github.com/spf13/cobra"
)

// Version is set at build time: go build -ldflags "-X example.com/__PROJECT_SLUG__/cmd.Version=1.2.3"
var Version = "dev"

// NewRootCmd builds the command tree.
func NewRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:   "__PROJECT_SLUG__",
		Short: "__PROJECT_NAME__ is a command line tool",
		Long: `__PROJECT_NAME__ is a command line tool built with Cobra.

Add commands in this package: copy greet.go, change its Use, Short, and RunE, and register it below.`,
		// Cobra prints errors and usage itself by default. Execute does both once, with exit codes.
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	root.AddCommand(newGreetCmd(), newVersionCmd())
	return root
}

// Execute runs the command line and returns the exit code: 0 on success, 1 for a failed command,
// and 2 for a usage error such as an unknown flag.
func Execute(args []string, stdout, stderr io.Writer) int {
	root := NewRootCmd()
	root.SetArgs(args)
	root.SetOut(stdout)
	root.SetErr(stderr)
	if err := root.Execute(); err != nil {
		fmt.Fprintf(stderr, "error: %v\n", err)
		var usage usageError
		if asUsage(err, &usage) {
			fmt.Fprintf(stderr, "Run '%s --help' for usage.\n", root.Name())
			return 2
		}
		return 1
	}
	return 0
}
