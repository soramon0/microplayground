package api

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type OrderSvc struct {
	Version       string
	UserSvcURL    string
	ProductSvcURL string
}

func (h *OrderSvc) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(w, "[%s] Catch-all route handled here\n", h.Version)
}

func (h *OrderSvc) CheckoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	// 1. Verify User via the internal K8s network
	userResp, err := http.Get(h.UserSvcURL + "/users/verify")
	if err != nil || userResp.StatusCode != 200 {
		http.Error(w, "Unauthorized or User Service Down", http.StatusUnauthorized)
		return
	}
	defer userResp.Body.Close()

	// 2. Check Product Stock via the internal K8s network
	prodResp, err := http.Get(h.ProductSvcURL + "/products/99")
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
