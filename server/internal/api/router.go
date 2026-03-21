package api

import (
	"context"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"turizm/internal/config"
	"turizm/internal/store"
)

type Server struct {
	Pool *pgxpool.Pool
	Cfg  *config.Config
}

func NewRouter(s *Server) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.Cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))
	r.Use(s.visitorMiddleware)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"status":"ok"}`)
	})
	// Nginx проксирует legacy-пути Django; в Go-версии медиа/статика не раздаются.
	r.Handle("/media/*", http.NotFoundHandler())
	r.Handle("/static/*", http.NotFoundHandler())

	r.Route("/api/places", func(r chi.Router) {
		r.Post("/sommelier/recommend/", s.handleSommelier)
		r.Get("/", s.handlePlacesList)
		r.Get("/{id}/", s.handlePlaceDetail)
	})

	r.Route("/api/routes", func(r chi.Router) {
		r.Post("/build/", s.handleRouteBuild)
		r.Patch("/{routeID}/", s.handleRoutePatch)
	})

	r.Route("/api/profile", func(r chi.Router) {
		r.Post("/collect/", s.handleCollect)
		r.Post("/register/", s.handleRegister)
	})

	r.Post("/api/token/", s.handleToken)
	r.Post("/api/token/refresh/", s.handleTokenRefresh)

	return r
}

func (s *Server) visitorMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var vid uuid.UUID
		if c, err := r.Cookie(s.Cfg.VisitorCookieName); err == nil {
			if u, err := uuid.Parse(c.Value); err == nil {
				vid = u
			}
		}
		if vid == uuid.Nil {
			vid = uuid.New()
		}
		ctx := context.WithValue(r.Context(), visitorKey, vid)
		next.ServeHTTP(w, r.WithContext(ctx))
		http.SetCookie(w, &http.Cookie{
			Name:     s.Cfg.VisitorCookieName,
			Value:    vid.String(),
			MaxAge:   s.Cfg.VisitorCookieMaxAge,
			Path:     "/",
			SameSite: http.SameSiteLaxMode,
			HttpOnly: false,
		})
		_ = store.UpsertVisitorTouch(r.Context(), s.Pool, vid)
	})
}
