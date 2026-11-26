package cmd

import (
	"bytes"
	"strings"
	"testing"
)

// run executes the command line with the given arguments and returns the exit code and both outputs.
func run(args ...string) (code int, stdout, stderr string) {
	var out, errOut bytes.Buffer
	code = Execute(args, &out, &errOut)
	return code, out.String(), errOut.String()
}

func TestGreeting(t *testing.T) {
	for _, test := range []struct {
		name  string
		input string
		shout bool
		want  string
	}{
		{"named", "Ada", false, "Hello, Ada!"},
		{"trimmed", "  Ada  ", false, "Hello, Ada!"},
		{"default", "", false, "Hello, world!"},
		{"blank", "   ", false, "Hello, world!"},
		{"shout", "Ada", true, "HELLO, ADA!"},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := Greeting(test.input, test.shout); got != test.want {
				t.Fatalf("Greeting(%q, %v) = %q, want %q", test.input, test.shout, got, test.want)
			}
		})
	}
}

func TestGreet(t *testing.T) {
	for _, test := range []struct {
		name string
		args []string
		want string
	}{
		{"default", []string{"greet"}, "Hello, world!\n"},
		{"positional name", []string{"greet", "Ada"}, "Hello, Ada!\n"},
		{"name flag", []string{"greet", "--name", "Grace"}, "Hello, Grace!\n"},
		{"short flags", []string{"greet", "-n", "Ada", "-t", "2"}, "Hello, Ada!\nHello, Ada!\n"},
		{"shout", []string{"greet", "Ada", "--shout"}, "HELLO, ADA!\n"},
	} {
		t.Run(test.name, func(t *testing.T) {
			code, stdout, stderr := run(test.args...)
			if code != 0 || stdout != test.want || stderr != "" {
				t.Fatalf("code=%d stdout=%q stderr=%q, want code 0 and stdout %q", code, stdout, stderr, test.want)
			}
		})
	}
}

func TestFailuresHaveDistinctExitCodes(t *testing.T) {
	for _, test := range []struct {
		name     string
		args     []string
		wantCode int
		wantErr  string
	}{
		{"too many repeats", []string{"greet", "--times", "11"}, 1, "--times must be between 1 and 10"},
		{"too few repeats", []string{"greet", "--times", "0"}, 1, "--times must be between 1 and 10"},
		{"unknown flag", []string{"greet", "--nope"}, 2, "unknown flag: --nope"},
		{"unknown command", []string{"dance"}, 2, "unknown command"},
		{"extra argument", []string{"greet", "a", "b"}, 2, "accepts at most 1 arg"},
		{"bad number", []string{"greet", "--times", "many"}, 2, "invalid argument"},
	} {
		t.Run(test.name, func(t *testing.T) {
			code, stdout, stderr := run(test.args...)
			if code != test.wantCode {
				t.Fatalf("exit code = %d, want %d (stderr %q)", code, test.wantCode, stderr)
			}
			if stdout != "" {
				t.Fatalf("a failed command should print nothing to stdout, got %q", stdout)
			}
			if !strings.Contains(stderr, test.wantErr) {
				t.Fatalf("stderr = %q, want it to contain %q", stderr, test.wantErr)
			}
			if test.wantCode == 2 && !strings.Contains(stderr, "--help") {
				t.Fatalf("a usage error should point to --help, got %q", stderr)
			}
		})
	}
}

func TestVersion(t *testing.T) {
	previous := Version
	t.Cleanup(func() { Version = previous })
	Version = "1.2.3"
	code, stdout, _ := run("version")
	if code != 0 || !strings.HasSuffix(stdout, " 1.2.3\n") {
		t.Fatalf("code=%d stdout=%q", code, stdout)
	}
	if code, _, _ := run("version", "extra"); code != 2 {
		t.Fatalf("version with an argument should be a usage error, got exit code %d", code)
	}
}

func TestHelpListsTheCommands(t *testing.T) {
	code, stdout, _ := run("--help")
	if code != 0 {
		t.Fatalf("exit code = %d", code)
	}
	for _, want := range []string{"greet", "version", "Available Commands"} {
		if !strings.Contains(stdout, want) {
			t.Fatalf("help output is missing %q:\n%s", want, stdout)
		}
	}
}
