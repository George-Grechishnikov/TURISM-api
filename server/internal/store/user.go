package store

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func UserExists(ctx context.Context, pool *pgxpool.Pool, username string) (bool, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM turizm_users WHERE username = $1`, username).Scan(&n)
	return n > 0, err
}

func CreateUser(ctx context.Context, pool *pgxpool.Pool, username, passwordHash string) (int64, error) {
	var id int64
	err := pool.QueryRow(ctx, `
		INSERT INTO turizm_users (username, password_hash) VALUES ($1, $2) RETURNING id`, username, passwordHash).Scan(&id)
	return id, err
}

func GetUserPasswordHash(ctx context.Context, pool *pgxpool.Pool, username string) (int64, string, error) {
	var id int64
	var hash string
	err := pool.QueryRow(ctx, `SELECT id, password_hash FROM turizm_users WHERE username = $1`, username).Scan(&id, &hash)
	return id, hash, err
}

func GetUserByID(ctx context.Context, pool *pgxpool.Pool, id int64) (username string, err error) {
	err = pool.QueryRow(ctx, `SELECT username FROM turizm_users WHERE id = $1`, id).Scan(&username)
	return username, err
}
