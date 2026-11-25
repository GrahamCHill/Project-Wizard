package greeting_test

import (
	"fmt"
	"testing"

	greeting "example.com/__PROJECT_SLUG__"
)

func TestGreet(t *testing.T) {
	for _, test := range []struct{ name, want string }{
		{"Ada", "Hello, Ada!"},
		{"", "Hello, world!"},
		{"  Ada  ", "Hello, Ada!"},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := greeting.Greet(test.name); got != test.want {
				t.Fatalf("Greet(%q) = %q, want %q", test.name, got, test.want)
			}
		})
	}
}

func ExampleGreet() {
	fmt.Println(greeting.Greet("Ada"))
	// Output: Hello, Ada!
}
