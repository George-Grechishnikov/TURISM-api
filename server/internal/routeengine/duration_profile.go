package routeengine

import "strings"

// DurationRouteProfile — реалистичные ограничения под ответы квиза (русские теги).
// Без «проехать весь край за день»: меньше радиус, короче плечи, меньше виноделен.
type DurationRouteProfile struct {
	MaxWineries         int
	RouteRadiusKm       float64
	MaxLegKm            float64
	WinerySlugAllowlist []string // если после фильтра ≥2 точек — узкий «коридор» заготовки
}

// винодельни в пределах ~40–50 км от Краснодара / Крымский–Молдаванка (без Тамани и Дона).
var dayTripWinerySlugs = []string{
	"kuban-vino-krasnodar",
	"chateau-le-grand-vostock",
	"lefkadia",
	"nikolaev-i-synovya",
	"imenie-sikory",
}

// выходные: побережье и предгорья в разумной дуге от Краснодара.
var weekendWinerySlugs = []string{
	"kuban-vino-krasnodar",
	"chateau-le-grand-vostock",
	"galitsky-galitsky",
	"skalisty-bereg",
	"myskhako",
	"chateau-pinot-betta",
	"shumrinka",
	"imenie-sikory",
	"nikolaev-i-synovya",
	"lefkadia",
}

// ProfileForDurationTags возвращает профиль по первому известному тегу длительности.
func ProfileForDurationTags(durationTags []string) (DurationRouteProfile, bool) {
	for _, raw := range durationTags {
		t := strings.TrimSpace(strings.ToLower(raw))
		switch t {
		case "день":
			// Компактная дуга без Тамани и без «через весь край»: узкий список slug + умеренный радиус.
			return DurationRouteProfile{
				MaxWineries:         3,
				RouteRadiusKm:       52,
				MaxLegKm:            26,
				WinerySlugAllowlist: dayTripWinerySlugs,
			}, true
		case "выходные":
			return DurationRouteProfile{
				MaxWineries:         4,
				RouteRadiusKm:       88,
				MaxLegKm:            34,
				WinerySlugAllowlist: weekendWinerySlugs,
			}, true
		case "два дня":
			return DurationRouteProfile{
				MaxWineries:   5,
				RouteRadiusKm: 105,
				MaxLegKm:      40,
			}, true
		case "три дня":
			return DurationRouteProfile{
				MaxWineries:   5,
				RouteRadiusKm: 120,
				MaxLegKm:      48,
			}, true
		case "неделя":
			return DurationRouteProfile{
				MaxWineries:   6,
				RouteRadiusKm: 140,
				MaxLegKm:      55,
			}, true
		}
	}
	return DurationRouteProfile{}, false
}
