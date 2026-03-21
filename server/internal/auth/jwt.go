package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type claims struct {
	UserID    int64  `json:"user_id"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

func IssuePair(secret string, userID int64) (access, refresh string, err error) {
	if secret == "" {
		return "", "", errors.New("empty jwt secret")
	}
	now := time.Now()
	ac := claims{
		UserID:    userID,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(12 * time.Hour)),
		},
	}
	rc := claims{
		UserID:    userID,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
		},
	}
	at := jwt.NewWithClaims(jwt.SigningMethodHS256, ac)
	access, err = at.SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}
	rt := jwt.NewWithClaims(jwt.SigningMethodHS256, rc)
	refresh, err = rt.SignedString([]byte(secret))
	return access, refresh, err
}

func ParseRefresh(secret, token string) (userID int64, err error) {
	parsed, err := jwt.ParseWithClaims(token, &claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected method")
		}
		return []byte(secret), nil
	})
	if err != nil || !parsed.Valid {
		return 0, errors.New("invalid token")
	}
	c, ok := parsed.Claims.(*claims)
	if !ok || c.TokenType != "refresh" {
		return 0, errors.New("invalid refresh")
	}
	return c.UserID, nil
}

func NewAccessOnly(secret string, userID int64) (string, error) {
	now := time.Now()
	ac := claims{
		UserID:    userID,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(12 * time.Hour)),
		},
	}
	at := jwt.NewWithClaims(jwt.SigningMethodHS256, ac)
	return at.SignedString([]byte(secret))
}
