package api

import (
	"context"

	"github.com/google/uuid"
)

type ctxKey int

const visitorKey ctxKey = 1

func VisitorID(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(visitorKey).(uuid.UUID)
	return v, ok && v != uuid.Nil
}
