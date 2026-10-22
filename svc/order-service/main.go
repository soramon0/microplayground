package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/soramon0/order-service/api"
	"github.com/soramon0/order-service/utils"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func newHttpHandler() http.Handler {
	api := &api.OrderSvc{
		Version:       "0.0.1",
		UserSvcURL:    utils.EnvOr("USER_SERVICE_URL", "http://user-service:3000"),
		ProductSvcURL: utils.EnvOr("PRODUCT_SERVICE_URL", "http://product-service:3000"),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/orders/checkout", api.CheckoutHandler)
	return mux
}

func run() (err error) {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	port := utils.EnvOr("SRV_PORT", ":8080")
	if port[0] != ':' {
		port = ":" + port
	}
	srv := &http.Server{
		Addr:         port,
		BaseContext:  func(l net.Listener) context.Context { return ctx },
		ReadTimeout:  time.Second,
		WriteTimeout: 10 * time.Second,
		Handler:      newHttpHandler(),
	}

	srvErr := make(chan error, 1)
	go func() {
		log.Printf("Running server on http://0.0.0.0%s", port)
		srvErr <- srv.ListenAndServe()
	}()

	select {
	case err = <-srvErr:
		return err
	case <-ctx.Done():
		stop()
	}

	err = srv.Shutdown(context.Background())
	return err
}
