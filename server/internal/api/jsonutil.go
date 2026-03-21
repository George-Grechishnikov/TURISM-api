package api

import (
	"encoding/json"
	"time"

	"turizm/internal/models"
	"turizm/internal/store"
)

func rawJSONArray(b []byte) any {
	var v []any
	if len(b) > 0 && json.Unmarshal(b, &v) == nil {
		return v
	}
	return []any{}
}

func placeListJSON(p *models.Place) map[string]any {
	out := map[string]any{
		"id":                p.ID.String(),
		"name":              p.Name,
		"slug":              p.Slug,
		"latitude":          p.Latitude,
		"longitude":         p.Longitude,
		"region":            p.Region,
		"category":          p.Category,
		"is_winery":         p.IsWinery,
		"short_description": p.ShortDescription,
		"tags":              rawJSONArray(p.Tags),
		"photo_urls":        rawJSONArray(p.PhotoURLs),
	}
	if p.VideoURL != nil && *p.VideoURL != "" {
		out["video_url"] = *p.VideoURL
	} else {
		out["video_url"] = nil
	}
	return out
}

func placeDetailJSON(p *models.Place) map[string]any {
	out := placeListJSON(p)
	out["full_description"] = p.FullDescription
	if !p.CreatedAt.IsZero() {
		out["created_at"] = p.CreatedAt.UTC().Format(time.RFC3339Nano)
	}
	if !p.UpdatedAt.IsZero() {
		out["updated_at"] = p.UpdatedAt.UTC().Format(time.RFC3339Nano)
	}
	return out
}

// jsonRaw декодирует JSONB в объект/массив для ответа API.
func jsonRaw(b []byte) any {
	if len(b) == 0 {
		return []any{}
	}
	var v any
	if json.Unmarshal(b, &v) != nil {
		return []any{}
	}
	return v
}

func mapRoutePlan(r *store.RoutePlan) map[string]any {
	return map[string]any{
		"id":                 r.ID.String(),
		"visitor_id":         r.VisitorID.String(),
		"companions_tags":    jsonRaw(r.CompanionsTags),
		"mood_tags":          jsonRaw(r.MoodTags),
		"duration_tags":      jsonRaw(r.DurationTags),
		"extra_tags":         jsonRaw(r.ExtraTags),
		"ordered_place_ids":  jsonRaw(r.OrderedPlaceIDs),
		"legs":               jsonRaw(r.Legs),
		"llm_narrative":      r.LLMNarrative,
		"weather_snapshot":   jsonRaw(r.WeatherSnapshot),
		"created_at":         r.CreatedAt.UTC().Format(time.RFC3339Nano),
		"updated_at":         r.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}
