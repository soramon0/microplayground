package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"go.opentelemetry.io/otel"
	// "go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"go.opentelemetry.io/contrib/bridges/otelslog"
)

const component = "github.com/soramon0/order-service/api"

var (
	tracer  = otel.Tracer(component)
	meter   = otel.Meter(component)
	logger  = otelslog.NewLogger(component)
	callCnt metric.Int64Counter
)

func init() {
	var err error
	callCnt, err = meter.Int64Counter("orderSvc.calls",
		metric.WithDescription(fmt.Sprintf("The number of times we called %s", component)),
		metric.WithUnit("{calls}"))
	if err != nil {
		panic(err)
	}
}

type OrderSvc struct {
	Version       string
	UserSvcURL    string
	ProductSvcURL string
}

func (h *OrderSvc) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(w, "[%s] Catch-all route handled here\n", h.Version)
}

func (h *OrderSvc) CheckoutHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracer.Start(r.Context(), "CheckoutHandler")
	defer span.End()

	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	// 1. Verify User via the internal K8s network
	userResp, err := http.Get(h.UserSvcURL + "/users/verify")
	if err != nil || userResp.StatusCode != 200 {
		logger.ErrorContext(ctx, "error caling user service", "error", err)
		http.Error(w, "Unauthorized or User Service Down", http.StatusUnauthorized)
		return
	}
	defer userResp.Body.Close()

	// 2. Check Product Stock via the internal K8s network
	prodResp, err := http.Get(h.ProductSvcURL + "/products/99")
	if err != nil || prodResp.StatusCode != 200 {
		logger.ErrorContext(ctx, "error caling product service", "error", err)
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
