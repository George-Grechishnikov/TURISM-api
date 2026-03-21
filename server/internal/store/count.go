package store

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func CountPublishedWineries(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM places_place WHERE published = true AND category = 'winery'`).Scan(&n)
	return n, err
}
