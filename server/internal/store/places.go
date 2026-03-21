package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"turizm/internal/models"
)

func scanPlace(row interface {
	Scan(dest ...any) error
}) (*models.Place, error) {
	var p models.Place
	var video *string
	err := row.Scan(
		&p.ID, &p.Name, &p.Slug, &p.Latitude, &p.Longitude, &p.Region, &p.Category,
		&p.IsWinery, &p.ShortDescription, &p.FullDescription, &p.Tags, &p.PhotoURLs,
		&video, &p.Published, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.VideoURL = video
	return &p, nil
}

const placeCols = `id, name, slug, latitude, longitude, region, category, is_winery,
  short_description, full_description, tags, photo_urls, video_url, published, created_at, updated_at`

func ListPublishedPlaces(ctx context.Context, pool *pgxpool.Pool) ([]models.Place, error) {
	rows, err := pool.Query(ctx, `
		SELECT `+placeCols+` FROM places_place WHERE published = true ORDER BY name`)
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

func GetPublishedPlace(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (*models.Place, error) {
	row := pool.QueryRow(ctx, `
		SELECT `+placeCols+` FROM places_place WHERE published = true AND id = $1`, id)
	return scanPlace(row)
}

func PlacesByIDs(ctx context.Context, pool *pgxpool.Pool, ids []uuid.UUID) (map[uuid.UUID]models.Place, error) {
	if len(ids) == 0 {
		return map[uuid.UUID]models.Place{}, nil
	}
	rows, err := pool.Query(ctx, `
		SELECT `+placeCols+` FROM places_place WHERE published = true AND id = ANY($1::uuid[])`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := make(map[uuid.UUID]models.Place)
	for rows.Next() {
		p, err := scanPlace(rows)
		if err != nil {
			return nil, err
		}
		m[p.ID] = *p
	}
	return m, rows.Err()
}