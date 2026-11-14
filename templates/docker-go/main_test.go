package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHello(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/hello?name=Docker", nil)
	response := httptest.NewRecorder()
	routes().ServeHTTP(response, request)
	var result map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK || result["message"] != "Hello, Docker!" {
		t.Fatalf("status %d, response %v", response.Code, result)
	}
}
