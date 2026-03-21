package llm

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/google/uuid"

	"turizm/internal/models"
)

var wineLabels = map[string]string{"red": "красное", "white": "белое", "sparkling": "игристое"}
var styleLabels = map[string]string{"fruity": "фруктовый", "aged": "выдержанный", "dry": "сухой"}
var goalLabels = map[string]string{"tasting": "дегустация", "tour": "экскурсия", "purchase": "покупка"}

func buildSommelierPrompt(wineType, wineStyle, visitGoal string, wineries []map[string]any) string {
	wt := wineLabels[wineType]
	if wt == "" {
		wt = wineType
	}
	ws := styleLabels[wineStyle]
	if ws == "" {
		ws = wineStyle
	}
	vg := goalLabels[visitGoal]
	if vg == "" {
		vg = visitGoal
	}
	wj, _ := json.Marshal(wineries)
	return "Ты — виртуальный сомелье и гид по винодельням Краснодарского края. " +
		"Пользователь указал предпочтения (условные, без медицинских советов).\n\n" +
		"Предпочтения:\n" +
		"- Тип вина: " + wt + "\n" +
		"- Стиль: " + ws + "\n" +
		"- Что ищет: " + vg + "\n\n" +
		"Ниже JSON-массив доступных виноделен. Рекомендуй ТОЛЬКО из этого списка, " +
		"3–5 точек, наиболее подходящих по смыслу (если точек меньше — все подходящие).\n" +
		"Для каждой укажи place_id точно как в данных.\n\n" +
		"Ответь ТОЛЬКО валидным JSON без Markdown и без текста вокруг:\n" +
		`{"explanation":"2–4 предложения по-русски, дружелюбно","recommendations":[` +
		`{"place_id":"uuid","name":"название из списка","reason":"1–2 предложения почему подходит"}]}` +
		"\n\nДанные виноделен (JSON):\n" + string(wj)
}

func parseLLMJSON(text string) map[string]any {
	s := strings.TrimSpace(text)
	if strings.HasPrefix(s, "```") {
		s = regexp.MustCompile(`(?s)^\x60\x60\x60\w*\s*`).ReplaceAllString(s, "")
		s = regexp.MustCompile(`(?s)\s*\x60\x60\x60\s*$`).ReplaceAllString(s, "")
	}
	start, end := strings.Index(s, "{"), strings.LastIndex(s, "}")
	if start < 0 || end <= start {
		return nil
	}
	var m map[string]any
	if json.Unmarshal([]byte(s[start:end+1]), &m) != nil {
		return nil
	}
	return m
}

func fallbackSommelier(wineType, wineStyle, visitGoal string, wineries []map[string]any) (string, []map[string]any, bool) {
	if len(wineries) == 0 {
		return "Сейчас в каталоге нет опубликованных виноделен. Загляните позже или соберите маршрут через квиз.", nil, false
	}
	goalKw := map[string][]string{
		"tasting": {"дегустац", "вино", "лоз", "бокал"},
		"tour":    {"экскурс", "музей", "тур", "демо"},
		"purchase": {"куп", "бутыл", "вин", "магазин"},
	}
	styleKw := map[string][]string{
		"fruity": {"фрукт", "ягод", "свеж", "лёгк"},
		"aged":   {"выдерж", "бочк", "баррик"},
		"dry":    {"сух", "структур", "танин"},
	}
	typeKw := map[string][]string{
		"red":       {"красн", "каберне", "мерло"},
		"white":     {"бел", "шардоне", "рислинг"},
		"sparkling": {"игрист", "шампан", "брют"},
	}
	scoreRow := func(w map[string]any) int {
		name, _ := w["name"].(string)
		sd, _ := w["short_description"].(string)
		var tags []string
		if ta, ok := w["tags"].([]any); ok {
			for _, t := range ta {
				if s, ok := t.(string); ok {
					tags = append(tags, s)
				}
			}
		}
		blob := strings.ToLower(name + " " + sd + " " + strings.Join(tags, " "))
		s := 0
		for _, kw := range goalKw[visitGoal] {
			if strings.Contains(blob, kw) {
				s += 2
			}
		}
		for _, kw := range styleKw[wineStyle] {
			if strings.Contains(blob, kw) {
				s += 1
			}
		}
		for _, kw := range typeKw[wineType] {
			if strings.Contains(blob, kw) {
				s += 1
			}
		}
		return s
	}
	ranked := append([]map[string]any(nil), wineries...)
	// sort by score descending (simple bubble for small n)
	for i := 0; i < len(ranked); i++ {
		for j := i + 1; j < len(ranked); j++ {
			if scoreRow(ranked[j]) > scoreRow(ranked[i]) {
				ranked[i], ranked[j] = ranked[j], ranked[i]
			}
		}
	}
	n := 5
	if len(ranked) < n {
		n = len(ranked)
	}
	pick := ranked[:n]
	if allZero := func() bool {
		for _, w := range pick {
			if scoreRow(w) != 0 {
				return false
			}
		}
		return true
	}(); allZero {
		pick = ranked[:n]
	}
	wt := wineLabels[wineType]
	ws := styleLabels[wineStyle]
	vg := goalLabels[visitGoal]
	expl := fmt.Sprintf("Под ваш запрос (%s, %s, интерес — %s) мы отобрали винодельни из доступного каталога. "+
		"Ниже — до пяти точек; уточните дегустации на сайтах хозяйств.", wt, ws, vg)
	var recs []map[string]any
	for _, w := range pick {
		pid, _ := w["place_id"].(string)
		name, _ := w["name"].(string)
		recs = append(recs, map[string]any{
			"place_id": pid,
			"name":     name,
			"reason":   fmt.Sprintf("Совпадение по описанию и тегам с вашими предпочтениями (%s, %s).", wt, vg),
		})
	}
	return expl, recs, false
}

func WineriesPayloadFromModels(places []models.Place) []map[string]any {
	sort.Slice(places, func(i, j int) bool { return places[i].Name < places[j].Name })
	var out []map[string]any
	for _, p := range places {
		if p.Category != "winery" {
			continue
		}
		desc := p.ShortDescription
		if len(desc) > 400 {
			desc = desc[:400]
		}
		var tags []any
		for _, t := range p.TagsSlice() {
			tags = append(tags, t)
		}
		out = append(out, map[string]any{
			"place_id":          p.ID.String(),
			"name":              p.Name,
			"short_description": desc,
			"tags":              tags,
			"region":            p.Region,
		})
		if len(out) >= 40 {
			break
		}
	}
	return out
}

func SommelierRecommend(folderID, token, wineType, wineStyle, visitGoal string, wineryPlaces []models.Place) map[string]any {
	wineries := WineriesPayloadFromModels(wineryPlaces)
	if len(wineries) == 0 {
		expl, recs, _ := fallbackSommelier(wineType, wineStyle, visitGoal, nil)
		return map[string]any{"explanation": expl, "recommendations": recs, "used_ai": false}
	}
	if folderID != "" && token != "" {
		prompt := buildSommelierPrompt(wineType, wineStyle, visitGoal, wineries)
		raw := CallYandexGPT(folderID, token, prompt, 1800)
		if parsed := parseLLMJSON(raw); parsed != nil {
			if recs, ok := parsed["recommendations"].([]any); ok {
				valid := make(map[string]struct{})
				for _, w := range wineries {
					valid[w["place_id"].(string)] = struct{}{}
				}
				var cleaned []map[string]any
				for _, item := range recs {
					m, ok := item.(map[string]any)
					if !ok {
						continue
					}
					pid, _ := m["place_id"].(string)
					pid = strings.TrimSpace(pid)
					if _, ok := valid[pid]; !ok {
						continue
					}
					if _, err := uuid.Parse(pid); err != nil {
						continue
					}
					name, _ := m["name"].(string)
					reason, _ := m["reason"].(string)
					if strings.TrimSpace(reason) == "" {
						reason = "Подходит под ваши ответы."
					}
					if strings.TrimSpace(name) == "" {
						for _, w := range wineries {
							if w["place_id"].(string) == pid {
								name, _ = w["name"].(string)
								break
							}
						}
					}
					cleaned = append(cleaned, map[string]any{"place_id": pid, "name": name, "reason": reason})
					if len(cleaned) >= 5 {
						break
					}
				}
				if len(cleaned) >= 3 {
					ex, _ := parsed["explanation"].(string)
					ex = strings.TrimSpace(ex)
					if ex == "" {
						ex = "Вот подборка по вашим предпочтениям."
					}
					return map[string]any{"explanation": ex, "recommendations": cleaned, "used_ai": true}
				}
				if len(cleaned) > 0 {
					ex, _ := parsed["explanation"].(string)
					ex = strings.TrimSpace(ex)
					if ex == "" {
						ex = "Короткая подборка по вашим ответам."
					}
					return map[string]any{"explanation": ex, "recommendations": cleaned, "used_ai": true}
				}
			}
		}
	}
	expl, recs, _ := fallbackSommelier(wineType, wineStyle, visitGoal, wineries)
	return map[string]any{"explanation": expl, "recommendations": recs, "used_ai": false}
}
