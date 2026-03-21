package routeengine

import (
	"math"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"turizm/internal/models"
)

const (
	CategoryWinery    = "winery"
	CategoryLodging   = "lodging"
	CategoryFood      = "food"
	CategoryTransfer  = "transfer"
	DefaultStartLat   = 45.0355
	DefaultStartLon   = 38.9753
)

func HaversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const r = 6371.0
	p1, p2 := lat1*math.Pi/180, lat2*math.Pi/180
	dphi := (lat2 - lat1) * math.Pi / 180
	dl := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dphi/2)*math.Sin(dphi/2) + math.Cos(p1)*math.Cos(p2)*math.Sin(dl/2)*math.Sin(dl/2)
	return 2 * r * math.Asin(math.Sqrt(math.Min(1.0, a)))
}

func scorePlace(p *models.Place, allTags map[string]struct{}, preferIndoor bool, weatherMode string) float64 {
	score := 0.0
	if p.Category == CategoryWinery || p.IsWinery {
		score += 2.0
	}
	ptags := make(map[string]struct{})
	for _, t := range p.TagsSlice() {
		ptags[strings.ToLower(t)] = struct{}{}
	}
	for t := range allTags {
		if _, ok := ptags[t]; ok {
			score += 2.0
		}
	}
	if preferIndoor {
		indoor := []string{"дегустация", "интерьер", "зал", "музей", "крыто"}
		for _, kw := range indoor {
			if _, ok := ptags[kw]; ok {
				score += 1.5
				break
			}
		}
	}
	score += weatherScoreByTags(ptags, weatherMode)
	return score
}

func weatherScoreByTags(ptags map[string]struct{}, weatherMode string) float64 {
	hasAny := func(words ...string) bool {
		for _, w := range words {
			if _, ok := ptags[w]; ok {
				return true
			}
		}
		return false
	}
	switch weatherMode {
	case "rain":
		if hasAny("крыто", "зал", "дегустация", "интерьер", "музей") {
			return 2.0
		}
	case "heat":
		if hasAny("подвал", "погреб", "прохладно", "утро", "вечер", "тень") {
			return 2.0
		}
	case "windy_cool":
		if hasAny("камин", "уют", "тёпло", "горячий напиток", "глинтвейн", "чай") {
			return 2.0
		}
	}
	return 0
}

func orderPlacesMaxLeg(places []models.Place, extraTags []string, badOutdoor bool, weatherMode string, startLat, startLon, maxLegKm float64) []models.Place {
	if len(places) == 0 {
		return nil
	}
	tagsNorm := make(map[string]struct{})
	for _, t := range extraTags {
		tagsNorm[strings.ToLower(t)] = struct{}{}
	}
	_, hasRain := tagsNorm["дождь"]
	preferIndoor := badOutdoor || hasRain
	slat, slon := startLat, startLon
	if slat == 0 && slon == 0 {
		slat, slon = DefaultStartLat, DefaultStartLon
	}
	remaining := append([]models.Place(nil), places...)
	var ordered []models.Place
	curLat, curLon := slat, slon

	for len(remaining) > 0 {
		var candidates []models.Place
		if len(ordered) == 0 {
			candidates = remaining
		} else {
			for _, p := range remaining {
				if HaversineKm(curLat, curLon, p.Latitude, p.Longitude) <= maxLegKm {
					candidates = append(candidates, p)
				}
			}
			if len(candidates) == 0 {
				break
			}
		}
		bestI := 0
		bestKey0, bestKey1 := 1e18, -1.0
		for i, p := range candidates {
			d := HaversineKm(curLat, curLon, p.Latitude, p.Longitude)
			sc := scorePlace(&p, tagsNorm, preferIndoor, weatherMode)
			key0, key1 := d, -sc
			if key0 < bestKey0 || (key0 == bestKey0 && key1 < bestKey1) {
				bestKey0, bestKey1 = key0, key1
				bestI = i
			}
		}
		nxt := candidates[bestI]
		ordered = append(ordered, nxt)
		for i, p := range remaining {
			if p.ID == nxt.ID {
				remaining = append(remaining[:i], remaining[i+1:]...)
				break
			}
		}
		curLat, curLon = nxt.Latitude, nxt.Longitude
	}
	return ordered
}

func filterPlacesWithinRadius(places []models.Place, centerLat, centerLon, radiusKm float64) []models.Place {
	if radiusKm <= 0 {
		return append([]models.Place(nil), places...)
	}
	var out []models.Place
	for _, p := range places {
		if HaversineKm(centerLat, centerLon, p.Latitude, p.Longitude) <= radiusKm {
			out = append(out, p)
		}
	}
	return out
}

func centroidPlaces(places []models.Place) (float64, float64) {
	if len(places) == 0 {
		return DefaultStartLat, DefaultStartLon
	}
	var la, lo float64
	for _, p := range places {
		la += p.Latitude
		lo += p.Longitude
	}
	return la / float64(len(places)), lo / float64(len(places))
}

func filterServicesForCluster(candidates []models.Place, clusterLat, clusterLon, radiusKm float64) []models.Place {
	if len(candidates) == 0 {
		return nil
	}
	var near []models.Place
	for _, p := range candidates {
		if HaversineKm(clusterLat, clusterLon, p.Latitude, p.Longitude) <= radiusKm {
			near = append(near, p)
		}
	}
	if len(near) > 0 {
		return near
	}
	return append([]models.Place(nil), candidates...)
}

func dedupePlaces(places []models.Place) []models.Place {
	seen := make(map[uuid.UUID]struct{})
	var out []models.Place
	for _, p := range places {
		if _, ok := seen[p.ID]; ok {
			continue
		}
		seen[p.ID] = struct{}{}
		out = append(out, p)
	}
	return out
}

func nearestTo(candidates []models.Place, lat, lon float64) *models.Place {
	if len(candidates) == 0 {
		return nil
	}
	best := &candidates[0]
	bd := HaversineKm(lat, lon, best.Latitude, best.Longitude)
	for i := 1; i < len(candidates); i++ {
		p := &candidates[i]
		d := HaversineKm(lat, lon, p.Latitude, p.Longitude)
		if d < bd {
			bd = d
			best = p
		}
	}
	return best
}

func pickService(fromUser, fromDB []models.Place, anchorLat, anchorLon float64, skip bool) *models.Place {
	if skip {
		return nil
	}
	pool := dedupePlaces(append(append([]models.Place{}, fromUser...), fromDB...))
	return nearestTo(pool, anchorLat, anchorLon)
}

func skipLodgingForDuration(durationTags []string) bool {
	norm := make(map[string]struct{})
	for _, t := range durationTags {
		norm[strings.ToLower(t)] = struct{}{}
	}
	_, a := norm["на день"]
	_, b := norm["только вечер"]
	return a || b
}

func longestLegMidpoint(coords [][2]float64) (float64, float64, bool) {
	if len(coords) < 2 {
		return 0, 0, false
	}
	bestD := -1.0
	var midLat, midLon float64
	for i := 0; i < len(coords)-1; i++ {
		a, b := coords[i], coords[i+1]
		d := HaversineKm(a[0], a[1], b[0], b[1])
		if d > bestD {
			bestD = d
			midLat = (a[0] + b[0]) / 2
			midLon = (a[1] + b[1]) / 2
		}
	}
	return midLat, midLon, true
}

// ComposeRouteWithServices mirrors Django route_engine.compose_route_with_services.
func ComposeRouteWithServices(
	wineries, lodgingCandidates, foodCandidates, transferCandidates []models.Place,
	extraTags, durationTags []string,
	badOutdoor bool,
	weatherMode string,
	maxWineries int,
	routeRadiusKm, maxLegKm float64,
) []models.Place {
	slat, slon := DefaultStartLat, DefaultStartLon
	pool := filterPlacesWithinRadius(wineries, slat, slon, routeRadiusKm)
	if len(pool) == 0 {
		pool = filterPlacesWithinRadius(wineries, slat, slon, routeRadiusKm*2)
	}
	if len(pool) == 0 {
		pool = append([]models.Place{}, wineries...)
	}
	serviceRadius := math.Max(routeRadiusKm, maxLegKm*2.5)
	clat, clon := centroidPlaces(pool)
	lodgingCandidates = filterServicesForCluster(lodgingCandidates, clat, clon, serviceRadius)
	foodCandidates = filterServicesForCluster(foodCandidates, clat, clon, serviceRadius)
	transferCandidates = filterServicesForCluster(transferCandidates, clat, clon, serviceRadius)

	orderedW := orderPlacesMaxLeg(pool, extraTags, badOutdoor, weatherMode, slat, slon, maxLegKm)
	if maxWineries > 0 && len(orderedW) > maxWineries {
		orderedW = orderedW[:maxWineries]
	}
	if len(orderedW) == 0 {
		return nil
	}
	skipLodging := skipLodgingForDuration(durationTags)
	w1 := orderedW[0]
	midW := orderedW[(len(orderedW)-1)/2]
	lodging := pickService(nil, lodgingCandidates, w1.Latitude, w1.Longitude, skipLodging)
	food := pickService(nil, foodCandidates, midW.Latitude, midW.Longitude, false)
	coords := [][2]float64{{slat, slon}}
	for _, w := range orderedW {
		coords = append(coords, [2]float64{w.Latitude, w.Longitude})
	}
	tlat, tlon, ok := longestLegMidpoint(coords)
	if !ok {
		tlat, tlon = slat, slon
	}
	transfer := pickService(nil, transferCandidates, tlat, tlon, false)

	var result []models.Place
	seen := make(map[uuid.UUID]struct{})
	add := func(p *models.Place) {
		if p == nil {
			return
		}
		if _, ok := seen[p.ID]; ok {
			return
		}
		seen[p.ID] = struct{}{}
		result = append(result, *p)
	}
	add(lodging)
	add(transfer)
	foodInsert := (len(orderedW) - 1) / 2
	for i, w := range orderedW {
		add(&w)
		if food != nil && i == foodInsert {
			if _, ok := seen[food.ID]; !ok {
				add(food)
			}
		}
	}
	if food != nil {
		if _, ok := seen[food.ID]; !ok {
			add(food)
		}
	}
	return result
}

func PlaceWeatherFit(p models.Place, weatherMode string) map[string]any {
	icon := "sun"
	level := "excellent"
	reason := "Хорошо подходит под текущие условия."
	score := 2
	tags := make(map[string]struct{})
	for _, t := range p.TagsSlice() {
		tags[strings.ToLower(t)] = struct{}{}
	}
	matches := weatherScoreByTags(tags, weatherMode)
	if weatherMode == "rain" {
		icon = "rain"
		if matches < 1 {
			level, score, reason = "normal", 1, "Лучше выбрать закрытый зал или музейную часть."
		} else {
			reason = "Есть indoor-формат: комфортно в дождь."
		}
	}
	if weatherMode == "heat" {
		icon = "sun"
		if matches < 1 {
			level, score, reason = "normal", 1, "Лучше планировать визит утром/вечером."
		} else {
			reason = "Подходит для жары: есть прохладные/теневые активности."
		}
	}
	if weatherMode == "windy_cool" {
		icon = "wind"
		if matches < 1 {
			level, score, reason = "normal", 1, "Добавьте тёплую паузу или indoor-активность."
		} else {
			reason = "Есть тёплые indoor-активности для прохладной погоды."
		}
	}
	if weatherMode == "rain" && matches < 0.5 && p.Category == CategoryWinery {
		level, score = "bad", 0
	}
	return map[string]any{
		"icon":   icon,
		"level":  level,
		"score":  score,
		"reason": reason,
	}
}

// ComputeTransferLegs builds leg dicts for JSON (matches Django).
func ComputeTransferLegs(ordered []models.Place) []map[string]any {
	var legs []map[string]any
	for i := 0; i < len(ordered)-1; i++ {
		a, b := ordered[i], ordered[i+1]
		km := math.Round(HaversineKm(a.Latitude, a.Longitude, b.Latitude, b.Longitude)*10) / 10
		legs = append(legs, map[string]any{
			"from_id":     a.ID.String(),
			"to_id":       b.ID.String(),
			"from_name":   a.Name,
			"to_name":     b.Name,
			"distance_km": km,
			"hint":        formatHint(km),
		})
	}
	return legs
}

func formatHint(km float64) string {
	s := strconv.FormatFloat(km, 'f', -1, 64)
	return "~" + s + " км — свой транспорт или заказать трансфер."
}
