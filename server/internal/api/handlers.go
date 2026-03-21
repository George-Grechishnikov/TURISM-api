package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"turizm/internal/auth"
	"turizm/internal/llm"
	"turizm/internal/models"
	"turizm/internal/routeengine"
	"turizm/internal/store"
	"turizm/internal/weather"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]any{"detail": msg})
}

func parseUUIDs(ss []string) []uuid.UUID {
	var out []uuid.UUID
	for _, x := range ss {
		if u, err := uuid.Parse(strings.TrimSpace(x)); err == nil {
			out = append(out, u)
		}
	}
	return out
}

func (s *Server) handlePlacesList(w http.ResponseWriter, r *http.Request) {
	places, err := store.ListPublishedPlaces(r.Context(), s.Pool)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	out := make([]map[string]any, 0, len(places))
	for i := range places {
		out = append(out, placeListJSON(&places[i]))
	}
	writeJSON(w, 200, out)
}

func (s *Server) handlePlaceDetail(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimSuffix(chi.URLParam(r, "id"), "/")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeErr(w, 400, "bad id")
		return
	}
	p, err := store.GetPublishedPlace(r.Context(), s.Pool, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeErr(w, 404, "not found")
			return
		}
		writeErr(w, 500, "db error")
		return
	}
	writeJSON(w, 200, placeDetailJSON(p))
}

func (s *Server) handleSommelier(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WineType   string `json:"wine_type"`
		WineStyle  string `json:"wine_style"`
		VisitGoal  string `json:"visit_goal"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	okWT := map[string]bool{"red": true, "white": true, "sparkling": true}
	okWS := map[string]bool{"fruity": true, "aged": true, "dry": true}
	okVG := map[string]bool{"tasting": true, "tour": true, "purchase": true}
	if !okWT[body.WineType] || !okWS[body.WineStyle] || !okVG[body.VisitGoal] {
		writeErr(w, 400, "invalid choice")
		return
	}
	wineries, err := store.ListPublishedByCategory(r.Context(), s.Pool, routeengine.CategoryWinery)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	out := llm.SommelierRecommend(s.Cfg.YandexFolderID, s.Cfg.YandexIAMToken, body.WineType, body.WineStyle, body.VisitGoal, wineries)
	writeJSON(w, 200, out)
}

type buildBody struct {
	CompanionsTags  []string  `json:"companions_tags"`
	MoodTags        []string  `json:"mood_tags"`
	DurationTags    []string  `json:"duration_tags"`
	ExtraTags       []string  `json:"extra_tags"`
	IncludePlaceIDs []string  `json:"include_place_ids"`
	ExcludePlaceIDs []string  `json:"exclude_place_ids"`
	MaxStops        *int      `json:"max_stops"`
	RouteRadiusKm   *float64  `json:"route_radius_km"`
	MaxLegKm        *float64  `json:"max_leg_km"`
	StartDate       string    `json:"start_date"`
	EndDate         string    `json:"end_date"`
}

func (s *Server) handleRouteBuild(w http.ResponseWriter, r *http.Request) {
	vid, ok := VisitorID(r.Context())
	if !ok {
		writeErr(w, 400, "no visitor")
		return
	}
	var body buildBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	maxW := 6
	if body.MaxStops != nil && *body.MaxStops >= 1 && *body.MaxStops <= 20 {
		maxW = *body.MaxStops
	}
	radius := 55.0
	if body.RouteRadiusKm != nil && *body.RouteRadiusKm >= 10 && *body.RouteRadiusKm <= 200 {
		radius = *body.RouteRadiusKm
	}
	maxLeg := 22.0
	if body.MaxLegKm != nil && *body.MaxLegKm >= 5 && *body.MaxLegKm <= 120 {
		maxLeg = *body.MaxLegKm
	}
	inc := parseUUIDs(body.IncludePlaceIDs)
	exc := parseUUIDs(body.ExcludePlaceIDs)
	wineries, err := store.FilterPublishedWineries(r.Context(), s.Pool, inc, exc)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	lodging, _ := store.ListPublishedByCategory(r.Context(), s.Pool, routeengine.CategoryLodging)
	food, _ := store.ListPublishedByCategory(r.Context(), s.Pool, routeengine.CategoryFood)
	transfer, _ := store.ListPublishedByCategory(r.Context(), s.Pool, routeengine.CategoryTransfer)

	wsnap := weather.FetchTripWeather(weather.DefaultLat, weather.DefaultLon, body.StartDate, body.EndDate)
	bad, _ := wsnap["is_bad_outdoor"].(bool)
	weatherMode, _ := wsnap["weather_mode"].(string)
	wsnap["clothing_tips"] = llm.GenerateClothingTips(s.Cfg.YandexFolderID, s.Cfg.YandexIAMToken, wsnap)

	ordered := routeengine.ComposeRouteWithServices(
		wineries, lodging, food, transfer,
		body.ExtraTags, body.DurationTags, bad, weatherMode, maxW, radius, maxLeg,
	)
	if len(ordered) == 0 {
		writeErr(w, 400, "Нет опубликованных винодельни для маршрута (category=winery).")
		return
	}
	legs := routeengine.ComputeTransferLegs(ordered)
	legsJSON, _ := json.Marshal(legs)
	ids := make([]string, len(ordered))
	for i, p := range ordered {
		ids[i] = p.ID.String()
	}
	idsJSON, _ := json.Marshal(ids)

	prefs := map[string]any{
		"companions_tags": body.CompanionsTags,
		"mood_tags":         body.MoodTags,
		"duration_tags":     body.DurationTags,
		"extra_tags":        body.ExtraTags,
	}
	var placesPayload []map[string]any
	for _, p := range ordered {
		placesPayload = append(placesPayload, map[string]any{
			"id":        p.ID.String(),
			"name":      p.Name,
			"category":  p.Category,
			"tags":      p.TagsSlice(),
			"is_winery": p.IsWinery,
		})
	}
	narrative := llm.GenerateRouteNarrative(s.Cfg.YandexFolderID, s.Cfg.YandexIAMToken, placesPayload, prefs, wsnap, legs)
	weatherJSON, _ := json.Marshal(wsnap)

	ct, _ := json.Marshal(body.CompanionsTags)
	mt, _ := json.Marshal(body.MoodTags)
	dt, _ := json.Marshal(body.DurationTags)
	et, _ := json.Marshal(body.ExtraTags)

	rid := uuid.New()
	plan := store.RoutePlan{
		ID:              rid,
		VisitorID:       vid,
		CompanionsTags:  ct,
		MoodTags:        mt,
		DurationTags:    dt,
		ExtraTags:       et,
		OrderedPlaceIDs: idsJSON,
		Legs:            legsJSON,
		LLMNarrative:    narrative,
		WeatherSnapshot: weatherJSON,
	}
	if err := store.CreateRoutePlan(r.Context(), s.Pool, plan); err != nil {
		writeErr(w, 500, "db error")
		return
	}
	saved, err := store.GetRoutePlanForVisitor(r.Context(), s.Pool, rid, vid)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	placeObjs := make([]map[string]any, 0, len(ordered))
	for _, p := range ordered {
		obj := placeListJSON(&p)
		obj["weather_fit"] = routeengine.PlaceWeatherFit(p, weatherMode)
		placeObjs = append(placeObjs, obj)
	}
	writeJSON(w, 201, map[string]any{
		"route":  mapRoutePlan(saved),
		"places": placeObjs,
	})
}

type patchBody struct {
	AddPlaceIDs    []string `json:"add_place_ids"`
	RemovePlaceIDs []string `json:"remove_place_ids"`
}

func (s *Server) handleRoutePatch(w http.ResponseWriter, r *http.Request) {
	vid, ok := VisitorID(r.Context())
	if !ok {
		writeErr(w, 400, "no visitor")
		return
	}
	ridStr := strings.TrimSuffix(chi.URLParam(r, "routeID"), "/")
	routeID, err := uuid.Parse(ridStr)
	if err != nil {
		writeErr(w, 400, "bad route id")
		return
	}
	plan, err := store.GetRoutePlanForVisitor(r.Context(), s.Pool, routeID, vid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeErr(w, 404, "not found")
			return
		}
		writeErr(w, 500, "db error")
		return
	}
	var body patchBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	add := parseUUIDs(body.AddPlaceIDs)
	remove := make(map[uuid.UUID]struct{})
	for _, x := range parseUUIDs(body.RemovePlaceIDs) {
		remove[x] = struct{}{}
	}
	var current []uuid.UUID
	_ = json.Unmarshal(plan.OrderedPlaceIDs, &current)
	var merged []uuid.UUID
	seen := make(map[uuid.UUID]struct{})
	for _, x := range current {
		if _, bad := remove[x]; bad {
			continue
		}
		if _, ok := seen[x]; ok {
			continue
		}
		merged = append(merged, x)
		seen[x] = struct{}{}
	}
	for _, a := range add {
		if _, ok := seen[a]; !ok {
			merged = append(merged, a)
			seen[a] = struct{}{}
		}
	}
	byID, err := store.PlacesByIDs(r.Context(), s.Pool, merged)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	var orderedModels []models.Place
	for _, id := range merged {
		if p, ok := byID[id]; ok {
			orderedModels = append(orderedModels, p)
		}
	}
	wsnap := map[string]any{}
	_ = json.Unmarshal(plan.WeatherSnapshot, &wsnap)
	if len(wsnap) == 0 {
		wsnap = weather.FetchSnapshot(0, 0)
	}
	weatherMode, _ := wsnap["weather_mode"].(string)
	if _, ok := wsnap["clothing_tips"]; !ok {
		wsnap["clothing_tips"] = llm.GenerateClothingTips(s.Cfg.YandexFolderID, s.Cfg.YandexIAMToken, wsnap)
	}
	legs := routeengine.ComputeTransferLegs(orderedModels)
	legsJSON, _ := json.Marshal(legs)
	newIDs := make([]string, len(orderedModels))
	for i, p := range orderedModels {
		newIDs[i] = p.ID.String()
	}
	idsJSON, _ := json.Marshal(newIDs)

	var companions, mood, duration, extra []any
	_ = json.Unmarshal(plan.CompanionsTags, &companions)
	_ = json.Unmarshal(plan.MoodTags, &mood)
	_ = json.Unmarshal(plan.DurationTags, &duration)
	_ = json.Unmarshal(plan.ExtraTags, &extra)
	prefs := map[string]any{
		"companions_tags": companions,
		"mood_tags":       mood,
		"duration_tags":   duration,
		"extra_tags":      extra,
	}
	var placesPayload []map[string]any
	for _, p := range orderedModels {
		placesPayload = append(placesPayload, map[string]any{
			"id": p.ID.String(), "name": p.Name, "category": p.Category,
			"tags": p.TagsSlice(), "is_winery": p.IsWinery,
		})
	}
	narrative := llm.GenerateRouteNarrative(s.Cfg.YandexFolderID, s.Cfg.YandexIAMToken, placesPayload, prefs, wsnap, legs)
	weatherJSON, _ := json.Marshal(wsnap)

	plan.OrderedPlaceIDs = idsJSON
	plan.Legs = legsJSON
	plan.LLMNarrative = narrative
	plan.WeatherSnapshot = weatherJSON
	if err := store.UpdateRoutePlan(r.Context(), s.Pool, *plan); err != nil {
		writeErr(w, 500, "db error")
		return
	}
	saved, err := store.GetRoutePlanForVisitor(r.Context(), s.Pool, routeID, vid)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	placeObjs := make([]map[string]any, 0, len(orderedModels))
	for _, p := range orderedModels {
		obj := placeListJSON(&p)
		obj["weather_fit"] = routeengine.PlaceWeatherFit(p, weatherMode)
		placeObjs = append(placeObjs, obj)
	}
	writeJSON(w, 200, map[string]any{"route": mapRoutePlan(saved), "places": placeObjs})
}

func (s *Server) handleCollect(w http.ResponseWriter, r *http.Request) {
	vid, ok := VisitorID(r.Context())
	if !ok {
		writeErr(w, 400, "no visitor")
		return
	}
	var raw map[string]any
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	signals, ok := raw["signals"].(map[string]any)
	if !ok {
		signals = raw
	}
	merged, err := store.MergeVisitorSignals(r.Context(), s.Pool, vid, signals)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	writeJSON(w, 200, map[string]any{"visitor_id": vid.String(), "signals": merged})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	u := strings.TrimSpace(body.Username)
	if u == "" || len(body.Password) < 6 {
		writeErr(w, 400, "Нужны username и password (мин. 6 символов).")
		return
	}
	exists, err := store.UserExists(r.Context(), s.Pool, u)
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	if exists {
		writeErr(w, 400, "Пользователь уже существует.")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, 500, "hash error")
		return
	}
	id, err := store.CreateUser(r.Context(), s.Pool, u, string(hash))
	if err != nil {
		writeErr(w, 500, "db error")
		return
	}
	access, refresh, err := auth.IssuePair(s.Cfg.JWTSecret, id)
	if err != nil {
		writeErr(w, 500, "token error")
		return
	}
	writeJSON(w, 201, map[string]any{
		"user_id": id, "username": u, "access": access, "refresh": refresh,
	})
}

func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	id, hash, err := store.GetUserPasswordHash(r.Context(), s.Pool, strings.TrimSpace(body.Username))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeErr(w, 401, "Неверные учётные данные.")
			return
		}
		writeErr(w, 500, "db error")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		writeErr(w, 401, "Неверные учётные данные.")
		return
	}
	access, refresh, err := auth.IssuePair(s.Cfg.JWTSecret, id)
	if err != nil {
		writeErr(w, 500, "token error")
		return
	}
	writeJSON(w, 200, map[string]any{"access": access, "refresh": refresh})
}

func (s *Server) handleTokenRefresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Refresh string `json:"refresh"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}
	uid, err := auth.ParseRefresh(s.Cfg.JWTSecret, body.Refresh)
	if err != nil {
		writeErr(w, 401, "invalid refresh")
		return
	}
	access, err := auth.NewAccessOnly(s.Cfg.JWTSecret, uid)
	if err != nil {
		writeErr(w, 500, "token error")
		return
	}
	writeJSON(w, 200, map[string]any{"access": access})
}
