package seed

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type demoRow struct {
	Name                string
	Slug                string
	Category            string
	Lat, Lon            float64
	Short, Full         string
	Tags                []string
	PhotoURLs           []string
	VideoURL            string
	TypicalVisitCostRub *int
}

// Run seeds compact demo cluster (same slugs as Django seed_demo).
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	legacy := []string{
		"abrau-durso", "bolshoy-sochi-wine", "kuban-vino-myskhako", "sauk-dere", "fanagoriya",
		"demo-hotel-krasnodar", "demo-rest-krasnodar", "demo-transfer-krasnodar",
	}
	_, _ = pool.Exec(ctx, `UPDATE places_place SET published = false WHERE slug = ANY($1::text[])`, legacy)

	c5k, c6k, c7k := 5000, 6000, 7000
	demo := []demoRow{
		{"Условная винодельня «Станица» (демо)", "compact-wine-1", "winery", 45.058, 38.985,
			"Демо: первая точка кольца недалеко от Краснодара.",
			"Условная точка для короткого маршрута. Замените реальными данными из БД.",
			[]string{"дегустация", "демо", "рядом"},
			[]string{}, "", &c5k},
		{"Условная винодельня «Лоза-2» (демо)", "compact-wine-2", "winery", 45.068, 38.998,
			"Демо: в нескольких км от соседних точек кольца.",
			"Условная винодельня в том же кластере.",
			[]string{"дегустация", "демо", "рядом"},
			[]string{}, "", &c5k},
		{"Условная винодельня «Бочка-3» (демо)", "compact-wine-3", "winery", 45.055, 39.005,
			"Демо: замыкает короткое кольцо.",
			"Условная винодельня.",
			[]string{"музей", "демо", "рядом"},
			[]string{}, "", &c6k},
		{"Условная винодельня «Рядом-4» (демо)", "compact-wine-4", "winery", 45.062, 39.015,
			"Демо: четвёртая точка, до соседей немного км.",
			"Условная винодельня.",
			[]string{"дегустация", "демо"},
			[]string{}, "", &c7k},
		{"Гостевой дом «Кластер» (демо)", "compact-hotel", "lodging", 45.060, 38.992,
			"Демо: жильё внутри кластера.",
			"Условное жильё рядом с винодельнями.",
			[]string{"жильё", "демо"},
			[]string{}, "", nil},
		{"Кафе «Между лозами» (демо)", "compact-food", "food", 45.056, 39.008,
			"Демо: обед между дегустациями.",
			"Условное питание в кластере.",
			[]string{"питание", "обед", "демо"},
			[]string{}, "", nil},
		{"Трансфер «Короткий маршрут» (демо)", "compact-transfer", "transfer", 45.059, 38.995,
			"Демо: подача авто между точками кольца.",
			"Условная служба трансфера в кластере.",
			[]string{"трансфер", "демо"},
			[]string{}, "", nil},
	}

	for _, row := range demo {
		id := uuid.New()
		tags, _ := json.Marshal(row.Tags)
		photos, _ := json.Marshal(row.PhotoURLs)
		isWinery := row.Category == "winery"
		var vurl *string
		if row.VideoURL != "" {
			vurl = &row.VideoURL
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO places_place (
				id, name, slug, latitude, longitude, region, category, is_winery,
				short_description, full_description, tags, photo_urls, video_url, typical_visit_cost_rub, published
			) VALUES ($1,$2,$3,$4,$5,'Краснодарский край',$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,true)
			ON CONFLICT (slug) DO UPDATE SET
				name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
				category = EXCLUDED.category, is_winery = EXCLUDED.is_winery,
				short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
				tags = EXCLUDED.tags, photo_urls = EXCLUDED.photo_urls, video_url = EXCLUDED.video_url,
				typical_visit_cost_rub = EXCLUDED.typical_visit_cost_rub,
				published = true, updated_at = NOW()`,
			id, row.Name, row.Slug, row.Lat, row.Lon, row.Category, isWinery,
			row.Short, row.Full, tags, photos, vurl, row.TypicalVisitCostRub)
		if err != nil {
			return err
		}
	}
	return nil
}
