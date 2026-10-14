package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	http.HandleFunc("/orders/checkout", checkoutHandler)
	log.Println("Order service running on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func checkoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	userServiceURL := envOr("USER_SERVICE_URL", "http://user-service:3000")
	productServiceURL := envOr("PRODUCT_SERVICE_URL", "http://product-service:3000")

	// 1. Verify User via the internal K8s network
	userResp, err := http.Get(userServiceURL + "/users/verify")
	if err != nil || userResp.StatusCode != 200 {
		http.Error(w, "Unauthorized or User Service Down", http.StatusUnauthorized)
		return
	}
	defer userResp.Body.Close()

	// 2. Check Product Stock via the internal K8s network
	prodResp, err := http.Get(productServiceURL + "/products/99")
	if err != nil || prodResp.StatusCode != 200 {
		http.Error(w, "Product out of stock or Product Service Down", http.StatusBadRequest)
		return
	}
	defer prodResp.Body.Close()

	// 3. Process Order (Mocked)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Order placed successfully",
	})
}
