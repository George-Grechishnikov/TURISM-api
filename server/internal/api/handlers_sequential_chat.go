package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"turizm/internal/llm"
	"turizm/internal/models"
	"turizm/internal/routeengine"
	"turizm/internal/store"
)

func placeSequentialChatPayload(p models.Place) map[string]any {
	desc := p.ShortDescription
	if len(desc) > 280 {
		desc = desc[:280] + "…"
	}
	var tags []any
	for _, t := range p.TagsSlice() {
		tags = append(tags, t)
	}
	return map[string]any{
		"place_id":          p.ID.String(),
		"name":              p.Name,
		"category":          p.Category,
		"is_winery":         p.IsWinery,
		"short_description": desc,
		"tags":              tags,
		"region":            p.Region,
	}
}

func (s *Server) handleSequentialChat(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Message        string `json:"message"`
		RoutePlaceIDs  []string `json:"route_place_ids"`
		History        []struct {
			Role string `json:"role"`
			Text string `json:"text"`
		} `json:"history"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	msg := strings.TrimSpace(body.Message)
	if msg == "" {
		writeErr(w, 400, "Пустое сообщение.")
		return
	}
	if len(msg) > 2000 {
		msg = msg[:2000]
	}

	var ids []uuid.UUID
	seen := map[uuid.UUID]struct{}{}
	for _, s := range body.RoutePlaceIDs {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		u, err := uuid.Parse(s)
		if err != nil {
			continue
		}
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		ids = append(ids, u)
		if len(ids) > 24 {
			break
		}
	}

	byID, err := store.PlacesByIDs(r.Context(), s.Pool, ids)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	routePlaces := make([]map[string]any, 0, len(ids))
	for _, id := range ids {
		if p, ok := byID[id]; ok {
			routePlaces = append(routePlaces, placeSequentialChatPayload(p))
		}
	}

	wineries, err := store.ListPublishedByCategory(r.Context(), s.Pool, routeengine.CategoryWinery)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	catalog := llm.WineriesPayloadFromModels(wineries)

	var hist []llm.ChatTurn
	for _, h := range body.History {
		role := strings.TrimSpace(strings.ToLower(h.Role))
		if role != "user" && role != "assistant" {
			continue
		}
		t := strings.TrimSpace(h.Text)
		if t == "" {
			continue
		}
		if len(t) > 1200 {
			t = t[:1200]
		}
		hist = append(hist, llm.ChatTurn{Role: role, Text: t})
		if len(hist) > 12 {
			hist = hist[len(hist)-12:]
		}
	}

	reply, used := llm.SequentialTourChat(s.Cfg.YandexFolderID, s.Cfg.YandexIAMToken, msg, hist, routePlaces, catalog)
	writeJSON(w, 200, map[string]any{"reply": reply, "used_ai": used})
}
