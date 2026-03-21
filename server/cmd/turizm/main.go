package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"turizm/internal/api"
	"turizm/internal/config"
	"turizm/internal/seed"
	"turizm/internal/store"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}
	if err := store.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	n, err := store.CountPublishedWineries(ctx, pool)
	if err != nil {
		log.Fatalf("count: %v", err)
	}
	if n == 0 {
		log.Println("No published wineries — seeding demo")
		if err := seed.Run(ctx, pool); err != nil {
			log.Fatalf("seed: %v", err)
		}
	}
	srv := &api.Server{Pool: pool, Cfg: cfg}
	h := api.NewRouter(srv)
	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           h,
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		log.Printf("turizm listening on :%s", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx2, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(ctx2)
}
