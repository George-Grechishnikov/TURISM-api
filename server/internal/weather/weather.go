package weather

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const DefaultLat = 45.0355
const DefaultLon = 38.9753

type Mode string

const (
	ModeOK       Mode = "ok"
	ModeRain     Mode = "rain"
	ModeHeat     Mode = "heat"
	ModeWindCool Mode = "windy_cool"
)

func FetchSnapshot(lat, lon float64) map[string]any {
	if lat == 0 && lon == 0 {
		lat, lon = DefaultLat, DefaultLon
	}
	u := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%g&longitude=%g&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Europe/Moscow",
		lat, lon,
	)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return map[string]any{"source": "error", "error": err.Error(), "is_bad_outdoor": false}
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return map[string]any{"source": "error", "error": string(b), "is_bad_outdoor": false}
	}
	var data struct {
		Current struct {
			Temperature   *float64 `json:"temperature_2m"`
			Humidity      *float64 `json:"relative_humidity_2m"`
			WeatherCode   *int     `json:"weather_code"`
			WindSpeed     *float64 `json:"wind_speed_10m"`
		} `json:"current"`
	}
	if json.Unmarshal(b, &data) != nil {
		return map[string]any{"source": "error", "error": "parse", "is_bad_outdoor": false}
	}
	c := data.Current
	bad := isBadOutdoor(c.WeatherCode, c.WindSpeed)
	mode := detectMode(c.WeatherCode, c.Temperature, c.WindSpeed)
	out := map[string]any{
		"source":         "open-meteo",
		"is_bad_outdoor": bad,
	}
	if c.Temperature != nil {
		out["temperature_c"] = *c.Temperature
	}
	if c.Humidity != nil {
		out["humidity"] = *c.Humidity
	}
	if c.WeatherCode != nil {
		out["weather_code"] = *c.WeatherCode
	}
	if c.WindSpeed != nil {
		out["wind_speed_ms"] = *c.WindSpeed
	}
	mergeUXHints(out, mode)
	return out
}

func FetchTripWeather(lat, lon float64, startDate, endDate string) map[string]any {
	if strings.TrimSpace(startDate) == "" || strings.TrimSpace(endDate) == "" {
		return FetchSnapshot(lat, lon)
	}
	if lat == 0 && lon == 0 {
		lat, lon = DefaultLat, DefaultLon
	}
	v := url.Values{}
	v.Set("latitude", fmt.Sprintf("%g", lat))
	v.Set("longitude", fmt.Sprintf("%g", lon))
	v.Set("daily", "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max")
	v.Set("timezone", "Europe/Moscow")
	v.Set("start_date", startDate)
	v.Set("end_date", endDate)
	u := "https://api.open-meteo.com/v1/forecast?" + v.Encode()
	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		base := FetchSnapshot(lat, lon)
		base["forecast_error"] = err.Error()
		return base
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		base := FetchSnapshot(lat, lon)
		base["forecast_error"] = string(b)
		return base
	}
	var data struct {
		Daily struct {
			Time    []string   `json:"time"`
			Code    []int      `json:"weather_code"`
			TMax    []float64  `json:"temperature_2m_max"`
			TMin    []float64  `json:"temperature_2m_min"`
			WindMax []float64  `json:"wind_speed_10m_max"`
		} `json:"daily"`
	}
	if json.Unmarshal(b, &data) != nil || len(data.Daily.Time) == 0 {
		base := FetchSnapshot(lat, lon)
		base["forecast_error"] = "parse"
		return base
	}
	var maxT, minT, maxW float64
	maxT = -1000
	minT = 1000
	worstCode := 0
	for i := range data.Daily.Time {
		if i < len(data.Daily.TMax) && data.Daily.TMax[i] > maxT {
			maxT = data.Daily.TMax[i]
		}
		if i < len(data.Daily.TMin) && data.Daily.TMin[i] < minT {
			minT = data.Daily.TMin[i]
		}
		if i < len(data.Daily.WindMax) && data.Daily.WindMax[i] > maxW {
			maxW = data.Daily.WindMax[i]
		}
		if i < len(data.Daily.Code) && severityCode(data.Daily.Code[i]) > severityCode(worstCode) {
			worstCode = data.Daily.Code[i]
		}
	}
	avg := (maxT + minT) / 2
	mode := detectMode(&worstCode, &avg, &maxW)
	out := map[string]any{
		"source":           "open-meteo-forecast",
		"trip_start_date":  startDate,
		"trip_end_date":    endDate,
		"weather_code":     worstCode,
		"temperature_c":    avg,
		"temperature_min_c": minT,
		"temperature_max_c": maxT,
		"wind_speed_ms":    maxW,
		"is_bad_outdoor":   mode == ModeRain || mode == ModeWindCool,
	}
	mergeUXHints(out, mode)
	return out
}

func severityCode(code int) int {
	switch {
	case code == 95 || code == 96 || code == 99:
		return 5
	case code == 65 || code == 82:
		return 4
	case code >= 51 && code <= 67:
		return 3
	case code >= 71 && code <= 86:
		return 3
	default:
		return 1
	}
}

func detectMode(code *int, temp *float64, wind *float64) Mode {
	c := 0
	if code != nil {
		c = *code
	}
	t := 0.0
	if temp != nil {
		t = *temp
	}
	w := 0.0
	if wind != nil {
		w = *wind
	}
	rain := c >= 51 && c <= 67 || c == 80 || c == 81 || c == 82 || c == 95 || c == 96 || c == 99
	if rain {
		return ModeRain
	}
	if t >= 30 {
		return ModeHeat
	}
	if w >= 12 || t <= 12 {
		return ModeWindCool
	}
	return ModeOK
}

func mergeUXHints(out map[string]any, mode Mode) {
	out["weather_mode"] = string(mode)
	switch mode {
	case ModeRain:
		out["weather_icon"] = "rain"
		out["route_weather_level"] = "bad"
		out["route_color"] = "#dc2626"
		out["indoor_activities"] = []string{"Крытые дегустационные залы", "Музей/экспозиция при винодельне", "Сомелье-сессия в помещении"}
		out["time_advice"] = "Планируйте больше активностей в помещении и короткие переходы между точками."
		out["clothing_tips"] = "Непромокаемая куртка, удобная водостойкая обувь, зонт."
	case ModeHeat:
		out["weather_icon"] = "sun"
		out["route_weather_level"] = "normal"
		out["route_color"] = "#eab308"
		out["indoor_activities"] = []string{"Прохладные винные подвалы", "Дегустация в тени/внутри", "Короткие переезды днём"}
		out["time_advice"] = "Лучше утренние и вечерние экскурсии, днём — прохладные помещения."
		out["clothing_tips"] = "Лёгкая дышащая одежда, головной убор, вода и SPF."
	case ModeWindCool:
		out["weather_icon"] = "wind"
		out["route_weather_level"] = "normal"
		out["route_color"] = "#eab308"
		out["indoor_activities"] = []string{"Залы с камином/тёплой посадкой", "Горячие напитки и гастропары", "Закрытые дегустации"}
		out["time_advice"] = "Держите больше времени на закрытые локации и тёплые паузы."
		out["clothing_tips"] = "Ветровка/пальто по сезону, многослойность, тёплая обувь."
	default:
		out["weather_icon"] = "sun"
		out["route_weather_level"] = "excellent"
		out["route_color"] = "#16a34a"
		out["indoor_activities"] = []string{"Комбинируйте indoor и outdoor дегустации"}
		out["time_advice"] = "Условия комфортные: можно равномерно распределить активности в течение дня."
		out["clothing_tips"] = "Комфортная повседневная одежда и удобная обувь."
	}
}

func isBadOutdoor(code *int, wind *float64) bool {
	if code == nil {
		return false
	}
	c := *code
	thunderOrSnow := c == 95 || c == 96 || c == 99 || (c >= 71 && c <= 86)
	heavyRain := c == 65 || c == 82 || c == 95 || c == 96 || c == 99
	w := 0.0
	if wind != nil {
		w = *wind
	}
	windy := w > 15
	return thunderOrSnow || heavyRain || windy
}
