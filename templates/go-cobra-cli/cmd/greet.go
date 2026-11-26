package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// Greeting returns the message the greet command prints. Keeping logic in plain functions like this one
// makes it easy to test without running a command.
func Greeting(name string, shout bool) string {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "world"
	}
	message := "Hello, " + name + "!"
	if shout {
		message = strings.ToUpper(message)
	}
	return message
}

func newGreetCmd() *cobra.Command {
	var (
		name  string
		shout bool
		times int
	)
	cmd := &cobra.Command{
		Use:     "greet [name]",
		Short:   "Print a greeting",
		Example: "  __PROJECT_SLUG__ greet Ada\n  __PROJECT_SLUG__ greet --name Ada --times 3 --shout",
		Args:    cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if times < 1 || times > 10 {
				return fmt.Errorf("--times must be between 1 and 10, not %d", times)
			}
			if len(args) == 1 {
				name = args[0]
			}
			for i := 0; i < times; i++ {
				fmt.Fprintln(cmd.OutOrStdout(), Greeting(name, shout))
			}
			return nil
		},
	}
	cmd.Flags().StringVarP(&name, "name", "n", "", "who to greet (default: world)")
	cmd.Flags().BoolVar(&shout, "shout", false, "print the greeting in capital letters")
	cmd.Flags().IntVarP(&times, "times", "t", 1, "how many times to print it")
	return cmd
}
