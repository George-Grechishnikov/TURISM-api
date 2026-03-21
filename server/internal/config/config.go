package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	CORSOrigins        []string
	VisitorCookieName  string
	VisitorCookieMaxAge int
	YandexFolderID     string
	YandexIAMToken     string
}

func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		host := getenv("DB_HOST", "localhost")
		port := getenv("DB_PORT", "5432")
		user := getenv("DB_USER", "turizm")
		pass := getenv("DB_PASSWORD", "turizm")
		name := getenv("DB_NAME", "turizm")
		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s", user, pass, host, port, name)
	}
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = os.Getenv("DJANGO_SECRET_KEY")
	}
	if secret == "" {
		secret = "dev-only-change-me"
	}
	cors := os.Getenv("CORS_ALLOWED_ORIGINS")
	var origins []string
	if cors != "" {
		for _, o := range strings.Split(cors, ",") {
			if s := strings.TrimSpace(o); s != "" {
				origins = append(origins, s)
			}
		}
	} else {
		origins = []string{"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8080", "http://127.0.0.1:8080"}
	}
	maxAge, _ := strconv.Atoi(getenv("VISITOR_COOKIE_MAX_AGE", strconv.Itoa(60*60*24*365)))
	return &Config{
		Port:                getenv("PORT", "8000"),
		DatabaseURL:         dbURL,
		JWTSecret:           secret,
		CORSOrigins:         origins,
		VisitorCookieName:   getenv("VISITOR_COOKIE_NAME", "turizm_vid"),
		VisitorCookieMaxAge: maxAge,
		YandexFolderID:      os.Getenv("YANDEX_CLOUD_FOLDER_ID"),
		YandexIAMToken:      os.Getenv("YANDEX_IAM_TOKEN"),
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
