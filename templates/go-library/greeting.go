// Package greeting provides a small reusable greeting API.
package greeting

import "strings"

// Greet returns a greeting. A blank name defaults to "world".
func Greet(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "world"
	}
	return "Hello, " + name + "!"
}
