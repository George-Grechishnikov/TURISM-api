package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RoutePlan struct {
	ID                uuid.UUID       `json:"id"`
	VisitorID         uuid.UUID       `json:"visitor_id"`
	CompanionsTags    json.RawMessage `json:"companions_tags"`
	MoodTags          json.RawMessage `json:"mood_tags"`
	DurationTags      json.RawMessage `json:"duration_tags"`
	ExtraTags         json.RawMessage `json:"extra_tags"`
	OrderedPlaceIDs   json.RawMessage `json:"ordered_place_ids"`
	Legs              json.RawMessage `json:"legs"`
	LLMNarrative      string          `json:"llm_narrative"`
	WeatherSnapshot   json.RawMessage `json:"weather_snapshot"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

func CreateRoutePlan(ctx context.Context, pool *pgxpool.Pool, p RoutePlan) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO trips_routeplan (
			id, visitor_id, companions_tags, mood_tags, duration_tags, extra_tags,
			ordered_place_ids, legs, llm_narrative, weather_snapshot, created_at, updated_at
		) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10::jsonb,NOW(),NOW())`,
		p.ID, p.VisitorID, p.CompanionsTags, p.MoodTags, p.DurationTags, p.ExtraTags,
		p.OrderedPlaceIDs, p.Legs, p.LLMNarrative, p.WeatherSnapshot,
	)
	return err
}

func GetRoutePlanForVisitor(ctx context.Context, pool *pgxpool.Pool, routeID, visitorID uuid.UUID) (*RoutePlan, error) {
	row := pool.QueryRow(ctx, `
		SELECT id, visitor_id, companions_tags, mood_tags, duration_tags, extra_tags,
			ordered_place_ids, legs, llm_narrative, weather_snapshot, created_at, updated_at
		FROM trips_routeplan WHERE id = $1 AND visitor_id = $2`, routeID, visitorID)
	var r RoutePlan
	err := row.Scan(&r.ID, &r.VisitorID, &r.CompanionsTags, &r.MoodTags, &r.DurationTags, &r.ExtraTags,
		&r.OrderedPlaceIDs, &r.Legs, &r.LLMNarrative, &r.WeatherSnapshot, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func UpdateRoutePlan(ctx context.Context, pool *pgxpool.Pool, p RoutePlan) error {
	_, err := pool.Exec(ctx, `
		UPDATE trips_routeplan SET
			ordered_place_ids = $2::jsonb, legs = $3::jsonb, llm_narrative = $4, weather_snapshot = $5::jsonb,
			updated_at = NOW()
		WHERE id = $1`, p.ID, p.OrderedPlaceIDs, p.Legs, p.LLMNarrative, p.WeatherSnapshot)
	return err
}
