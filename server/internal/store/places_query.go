package store

import (
	"context"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"turizm/internal/models"
)

func FilterPublishedWineries(ctx context.Context, pool *pgxpool.Pool, include, exclude []uuid.UUID) ([]models.Place, error) {
	q := `SELECT ` + placeCols + ` FROM places_place WHERE published = true AND category = 'winery'`
	args := []any{}
	n := 1
	if len(include) > 0 {
		q += ` AND id = ANY($` + strconv.Itoa(n) + `::uuid[])`
		args = append(args, include)
		n++
	}
	if len(exclude) > 0 {
		q += ` AND NOT (id = ANY($` + strconv.Itoa(n) + `::uuid[]))`
		args = append(args, exclude)
	}
	q += ` ORDER BY name`
	rows, err := pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Place
	for rows.Next() {
		p, err := scanPlace(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func ListPublishedByCategory(ctx context.Context, pool *pgxpool.Pool, category string) ([]models.Place, error) {
	rows, err := pool.Query(ctx, `
		SELECT `+placeCols+` FROM places_place WHERE published = true AND category = $1 ORDER BY name`, category)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Place
	for rows.Next() {
		p, err := scanPlace(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}
