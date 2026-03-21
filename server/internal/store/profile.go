package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func UpsertVisitorTouch(ctx context.Context, pool *pgxpool.Pool, vid uuid.UUID) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO profiles_visitorprofile (visitor_id, signals, first_seen_at, last_seen_at)
		VALUES ($1, '{}'::jsonb, NOW(), NOW())
		ON CONFLICT (visitor_id) DO UPDATE SET last_seen_at = NOW()`, vid)
	return err
}

func MergeVisitorSignals(ctx context.Context, pool *pgxpool.Pool, vid uuid.UUID, incoming map[string]any) (map[string]any, error) {
	var prev json.RawMessage
	err := pool.QueryRow(ctx, `SELECT COALESCE(signals, '{}'::jsonb) FROM profiles_visitorprofile WHERE visitor_id = $1`, vid).Scan(&prev)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_, insErr := pool.Exec(ctx, `
				INSERT INTO profiles_visitorprofile (visitor_id, signals, first_seen_at, last_seen_at)
				VALUES ($1, $2::jsonb, NOW(), NOW())`, vid, mustJSON(incoming))
			if insErr != nil {
				return nil, insErr
			}
			return incoming, nil
		}
		return nil, err
	}
	var old map[string]any
	_ = json.Unmarshal(prev, &old)
	if old == nil {
		old = map[string]any{}
	}
	for k, v := range incoming {
		old[k] = v
	}
	merged := mustJSON(old)
	_, err = pool.Exec(ctx, `
		UPDATE profiles_visitorprofile SET signals = $2::jsonb, last_seen_at = NOW() WHERE visitor_id = $1`, vid, merged)
	if err != nil {
		return nil, err
	}
	return old, nil
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
