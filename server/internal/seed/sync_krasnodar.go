package seed

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed krasnodar_wineries.json
var krasnodarWineriesJSON []byte

// demoSlugsToRetire — старые демо-точки (compact + legacy из seed.go), скрываем при синхронизации.
var demoSlugsToRetire = []string{
	"abrau-durso", "bolshoy-sochi-wine", "kuban-vino-myskhako", "sauk-dere", "fanagoriya",
	"demo-hotel-krasnodar", "demo-rest-krasnodar", "demo-transfer-krasnodar",
	"compact-wine-1", "compact-wine-2", "compact-wine-3", "compact-wine-4",
	"compact-hotel", "compact-food", "compact-transfer",
}

type krasnodarFile struct {
	SourceArticle string `json:"source_article"`
	NoteRU        string `json:"note_ru"`
	Places        []struct {
		Name   string   `json:"name"`
		Slug   string   `json:"slug"`
		Cat    string   `json:"category"`
		Lat    float64  `json:"lat"`
		Lon    float64  `json:"lon"`
		Short  string   `json:"short"`
		Tags   []string `json:"tags"`
	} `json:"places"`
}

// SyncKrasnodarBundled скрывает старые демо-остановки и upsert'ит винодельни/сервис из JSON (координаты на карте).
func SyncKrasnodarBundled(ctx context.Context, pool *pgxpool.Pool) error {
	var doc krasnodarFile
	if err := json.Unmarshal(krasnodarWineriesJSON, &doc); err != nil {
		return fmt.Errorf("krasnodar json: %w", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE places_place SET published = false WHERE slug = ANY($1::text[])`, demoSlugsToRetire); err != nil {
		return fmt.Errorf("retire demo slugs: %w", err)
	}
	// Любые оставшиеся compact-* и старые названия «(демо)» из прошлых сидов
	if _, err := pool.Exec(ctx, `
		UPDATE places_place SET published = false
		WHERE slug LIKE 'compact-%'
		   OR slug LIKE 'demo-%'
		   OR (name LIKE '%(демо)%' AND slug NOT LIKE 'svc-%')
	`); err != nil {
		return fmt.Errorf("retire demo by pattern: %w", err)
	}
	for _, row := range doc.Places {
		if row.Slug == "" || row.Name == "" {
			continue
		}
		tags, err := json.Marshal(row.Tags)
		if err != nil || len(tags) == 0 || string(tags) == "null" {
			tags = []byte("[]")
		}
		photos, _ := json.Marshal([]string{})
		isWinery := row.Cat == "winery" || row.Cat == ""
		cat := row.Cat
		if cat == "" {
			cat = "winery"
		}
		full := row.Short
		if doc.SourceArticle != "" {
			full += "\n\nИсточник подборки: " + doc.SourceArticle
		}
		if doc.NoteRU != "" {
			full += "\n\n" + doc.NoteRU
		}
		id := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO places_place (
				id, name, slug, latitude, longitude, region, category, is_winery,
				short_description, full_description, tags, photo_urls, video_url, published
			) VALUES ($1,$2,$3,$4,$5,'Краснодарский край',$6,$7,$8,$9,$10::jsonb,$11::jsonb,NULL,true)
			ON CONFLICT (slug) DO UPDATE SET
				name = EXCLUDED.name,
				latitude = EXCLUDED.latitude,
				longitude = EXCLUDED.longitude,
				category = EXCLUDED.category,
				is_winery = EXCLUDED.is_winery,
				short_description = EXCLUDED.short_description,
				full_description = EXCLUDED.full_description,
				tags = EXCLUDED.tags,
				photo_urls = EXCLUDED.photo_urls,
				published = true,
				updated_at = NOW()`,
			id, row.Name, row.Slug, row.Lat, row.Lon, cat, isWinery,
			row.Short, full, tags, photos,
		)
		if err != nil {
			return fmt.Errorf("upsert %s: %w", row.Slug, err)
		}
	}
	return nil
}
