package cmd

import (
	"errors"
	"strings"
)

// usageError marks a mistake in how the command was called, as opposed to a command that ran and failed.
type usageError struct{ message string }

func (e usageError) Error() string { return e.message }

func asUsage(err error, target *usageError) bool {
	if errors.As(err, target) {
		return true
	}
	// Cobra reports unknown commands and flags as plain errors, so recognize their messages.
	message := err.Error()
	for _, prefix := range []string{"unknown command", "unknown flag", "unknown shorthand flag", "invalid argument", "required flag", "accepts "} {
		if strings.HasPrefix(message, prefix) {
			*target = usageError{message}
			return true
		}
	}
	return false
}
