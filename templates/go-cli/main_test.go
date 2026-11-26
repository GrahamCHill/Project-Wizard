package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestGreeting(t *testing.T) {
	for _, test := range []struct{ name, input, want string }{
		{"default", "", "Hello from " + defaultName + "!"},
		{"blank", "   ", "Hello from " + defaultName + "!"},
		{"named", "Ada", "Hello, Ada!"},
		{"trimmed", "  Ada  ", "Hello, Ada!"},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := greeting(test.input); got != test.want {
				t.Fatalf("greeting(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestRun(t *testing.T) {
	for _, test := range []struct {
		name       string
		args       []string
		wantCode   int
		wantStdout string
		wantStderr string
	}{
		{"default greeting", nil, 0, "Hello from " + defaultName + "!\n", ""},
		{"named greeting", []string{"-name", "Ada"}, 0, "Hello, Ada!\n", ""},
		{"inline value", []string{"-name=Grace"}, 0, "Hello, Grace!\n", ""},
		{"help", []string{"-h"}, 0, "", "Usage of"},
		{"unknown flag", []string{"-bogus"}, 2, "", "flag provided but not defined"},
		{"extra arguments", []string{"one", "two"}, 2, "", "unexpected arguments: one two"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			if code := run(test.args, &stdout, &stderr); code != test.wantCode {
				t.Fatalf("run(%q) exit code = %d, want %d", test.args, code, test.wantCode)
			}
			if stdout.String() != test.wantStdout {
				t.Fatalf("stdout = %q, want %q", stdout.String(), test.wantStdout)
			}
			if !strings.Contains(stderr.String(), test.wantStderr) {
				t.Fatalf("stderr = %q, want it to contain %q", stderr.String(), test.wantStderr)
			}
		})
	}
}
