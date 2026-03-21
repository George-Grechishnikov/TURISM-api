package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const completionURL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
const narrativeMaxLen = 320

func CapNarrative(text string, maxLen int) string {
	if maxLen <= 0 {
		maxLen = narrativeMaxLen
	}
	s := bytes.TrimSpace([]byte(text))
	if len(s) <= maxLen {
		return string(s)
	}
	cut := s[:maxLen]
	if dot := bytes.LastIndexByte(cut, '.'); dot > 60 {
		return string(cut[:dot+1])
	}
	if sp := bytes.LastIndexByte(cut, ' '); sp > 40 {
		return string(cut[:sp]) + "…"
	}
	return string(cut) + "…"
}

func CallYandexGPT(folderID, iamToken, prompt string, maxTokens int) string {
	if maxTokens <= 0 {
		maxTokens = 220
	}
	body := map[string]any{
		"modelUri":          fmt.Sprintf("gpt://%s/yandexgpt/latest", folderID),
		"completionOptions": map[string]any{"stream": false, "temperature": 0.35, "maxTokens": maxTokens},
		"messages":          []map[string]string{{"role": "user", "text": prompt}},
	}
	j, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, completionURL, bytes.NewReader(j))
	req.Header.Set("Authorization", "Bearer "+iamToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-folder-id", folderID)
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return ""
	}
	var data struct {
		Result struct {
			Alternatives []struct {
				Message struct {
					Text string `json:"text"`
				} `json:"message"`
			} `json:"alternatives"`
		} `json:"result"`
	}
	if json.Unmarshal(b, &data) != nil || len(data.Result.Alternatives) == 0 {
		return ""
	}
	return data.Result.Alternatives[0].Message.Text
}

func BuildRoutePrompt(placesPayload, preferences, weather, legs any) string {
	pj, _ := json.Marshal(preferences)
	wj, _ := json.Marshal(weather)
	lj, _ := json.Marshal(legs)
	plj, _ := json.Marshal(placesPayload)
	return "Ты — гид по Краснодарскому краю, акцент на винодельни. " +
		"Категории точек: winery, lodging, food, transfer. " +
		"Очень кратко: ровно 2 коротких предложения (не больше ~280 символов суммарно) — суть маршрута, одна практическая рекомендация (бронь/трансфер/погода). " +
		"Без списков и без перечисления всех названий подряд.\n\n" +
		"Предпочтения (JSON): " + string(pj) + "\n" +
		"Погода (JSON): " + string(wj) + "\n" +
		"Плечи (км): " + string(lj) + "\n" +
		"Точки по порядку (JSON): " + string(plj) + "\n" +
		"Ответ: только 2 предложения на русском, без Markdown."
}

func FallbackNarrative(placesPayload []map[string]any, preferences map[string]any, weather map[string]any, legs []map[string]any) string {
	n := len(placesPayload)
	first := "старт"
	last := "финиш"
	if n > 0 {
		if s, _ := placesPayload[0]["name"].(string); s != "" {
			first = s
		}
		if s, _ := placesPayload[n-1]["name"].(string); s != "" {
			last = s
		}
	}
	who := "гости"
	if ct, ok := preferences["companions_tags"].([]any); ok && len(ct) > 0 {
		parts := make([]string, 0, len(ct))
		for _, x := range ct {
			if s, ok := x.(string); ok {
				parts = append(parts, s)
			}
		}
		if len(parts) > 0 {
			who = ""
			for i, p := range parts {
				if i > 0 {
					who += ", "
				}
				who += p
			}
		}
	}
	wshort := "Проверьте прогноз перед выездом."
	if bad, _ := weather["is_bad_outdoor"].(bool); bad {
		wshort = "Погода сегодня неровная — больше времени в помещениях."
	} else if t, ok := weather["temperature_c"].(float64); ok {
		wshort = fmt.Sprintf("Около %.0f°C на улице — удобно ехать между точками.", t)
	} else if t, ok := weather["temperature_c"].(json.Number); ok {
		wshort = fmt.Sprintf("Около %s°C на улице — удобно ехать между точками.", t.String())
	}
	legShort := ""
	if len(legs) > 0 {
		var mx float64
		for _, l := range legs {
			if d, ok := l["distance_km"].(float64); ok && d > mx {
				mx = d
			}
		}
		if mx > 0 {
			legShort = fmt.Sprintf(" Самый длинный отрезок ~%g км.", mx)
		}
	}
	return fmt.Sprintf("%d остановок: от «%s» до «%s». %s%s Бронируйте дегустации заранее; для %s — без алкоголя за рулём.",
		n, first, last, wshort, legShort, who)
}

func GenerateRouteNarrative(folderID, token string, placesPayload []map[string]any, preferences map[string]any, weather map[string]any, legs []map[string]any) string {
	prompt := BuildRoutePrompt(placesPayload, preferences, weather, legs)
	if folderID != "" && token != "" {
		if text := CallYandexGPT(folderID, token, prompt, 220); text != "" {
			return CapNarrative(text, narrativeMaxLen)
		}
	}
	return CapNarrative(FallbackNarrative(placesPayload, preferences, weather, legs), narrativeMaxLen)
}

func GenerateClothingTips(folderID, token string, weather map[string]any) string {
	mode, _ := weather["weather_mode"].(string)
	fallback := func() string {
		switch mode {
		case "rain":
			return "Возьмите непромокаемую куртку, зонт и водостойкую обувь."
		case "heat":
			return "Выберите лёгкую одежду, головной убор и обязательно воду."
		case "windy_cool":
			return "Нужны ветровка/слои, закрытая обувь и тёплый аксессуар."
		default:
			return "Подойдёт удобная повседневная одежда и комфортная обувь."
		}
	}
	if folderID == "" || token == "" {
		return fallback()
	}
	wj, _ := json.Marshal(weather)
	prompt := "Дай 1 короткий совет по одежде для винного маршрута на русском (до 110 символов, без списка). Погода JSON: " + string(wj)
	text := strings.TrimSpace(CallYandexGPT(folderID, token, prompt, 90))
	if text == "" {
		return fallback()
	}
	return CapNarrative(text, 110)
}
