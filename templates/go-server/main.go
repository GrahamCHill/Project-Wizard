package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

const (
	address = "127.0.0.1:8080"
	message = "Hello from __PROJECT_NAME__!"
)

// newHandler returns the HTTP routes. It is separate from main so tests can
// exercise it with net/http/httptest without opening a port.
func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{"message": message}); err != nil {
			log.Printf("write response: %v", err)
		}
	})
	return mux
}

func main() {
	server := &http.Server{
		Addr:              address,
		Handler:           newHandler(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Print("Listening on http://" + address)
	log.Fatal(server.ListenAndServe())
}
