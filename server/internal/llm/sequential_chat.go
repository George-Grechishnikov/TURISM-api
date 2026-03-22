package llm

import (
	"encoding/json"
	"strconv"
	"strings"
	"unicode/utf8"
)

const sequentialChatMaxOut = 1600

// ChatTurn — одно сообщение в истории диалога (для промпта).
type ChatTurn struct {
	Role string // "user" | "assistant"
	Text string
}

func trimRunes(s string, max int) string {
	if max <= 0 || s == "" {
		return s
	}
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	r := []rune(s)
	if len(r) > max {
		return string(r[:max]) + "…"
	}
	return s
}

func buildSequentialChatPrompt(userMessage string, history []ChatTurn, routePlaces, wineryCatalog []map[string]any) string {
	history = trimHistory(history, 8)
	var hb strings.Builder
	for _, t := range history {
		role := strings.TrimSpace(t.Role)
		if role != "user" && role != "assistant" {
			continue
		}
		txt := trimRunes(strings.TrimSpace(t.Text), 600)
		if txt == "" {
			continue
		}
		hb.WriteString(role)
		hb.WriteString(": ")
		hb.WriteString(txt)
		hb.WriteString("\n")
	}
	rj, _ := json.Marshal(routePlaces)
	cj, _ := json.Marshal(wineryCatalog)
	um := trimRunes(strings.TrimSpace(userMessage), 1200)
	return "Ты — дружелюбный гид по винным маршрутам Краснодарского края и соседних регионов. " +
		"Пользователь собирает маршрут вручную (последовательно добавляет остановки). " +
		"Отвечай по-русски, 2–6 коротких абзацев или список из 3–5 пунктов, без Markdown-заголовков. " +
		"Не выдумывай цены и часы работы — говори «уточните на сайте винодельни». " +
		"Если спрашивают «что добавить», предлагай 2–4 винодельни ТОЛЬКО из JSON-каталога ниже (по названию), кратко почему логично рядом по региону/стилю. " +
		"Если вопрос не про маршрут — вежливо свяжи с винным туризмом или предложи открыть карту и блок «Добавить».\n\n" +
		"Текущие остановки маршрута (по порядку, JSON):\n" + string(rj) + "\n\n" +
		"Каталог виноделен (имена и краткие описания, JSON; рекомендуй только отсюда):\n" + string(cj) + "\n\n" +
		"История диалога:\n" + hb.String() + "\n" +
		"Новое сообщение пользователя:\n" + um + "\n\n" +
		"Твой ответ:"
}

func trimHistory(history []ChatTurn, max int) []ChatTurn {
	if len(history) <= max {
		return history
	}
	return history[len(history)-max:]
}

// FallbackSequentialChat — ответ без облака.
func FallbackSequentialChat(userMessage string, routePlaces []map[string]any) string {
	n := len(routePlaces)
	msg := strings.ToLower(strings.TrimSpace(userMessage))
	switch {
	case strings.Contains(msg, "погод"):
		return "Погода и подсказки по одежде показываются на странице маршрута после появления остановок. " +
			"Если нужен прогноз на конкретные даты — откройте блок «О маршруте» и ориентируйтесь на карточку погоды."
	case strings.Contains(msg, "добав") || strings.Contains(msg, "останов") || strings.Contains(msg, "куда"):
		if n == 0 {
			return "Сейчас в маршруте нет остановок. Откройте список «Добавить» под картой и выберите первую винодельню — " +
				"после этого можно спрашивать, что логично добавить следующим."
		}
		return "Чтобы расширить маршрут, пользуйтесь списком «Добавить» на той же странице: там все доступные точки из каталога. " +
			"Спросите меня, какие винодельни обычно сочетают с уже выбранными — я подскажу по названиям из каталога."
	case strings.Contains(msg, "брон") || strings.Contains(msg, "дегустац"):
		return "Дегустации и экскурсии почти всегда по предварительной записи. Зайдите на сайт выбранной винодельни или позвоните — " +
			"в нашем сервисе только ориентир по точкам, не бронирование."
	case strings.Contains(msg, "привет") || strings.Contains(msg, "здравств"):
		if n == 0 {
			return "Здравствуйте! Когда добавите первую остановку с карты, смогу подсказать, как развить маршрут и что учесть по дороге."
		}
		return "Здравствуйте! У вас уже есть остановки в маршруте — спрашивайте, что добавить дальше, как разбить день или на что обратить внимание."
	default:
		if n == 0 {
			return "Я помогаю собирать винный маршрут: что добавить после текущих точек, как не перегрузить день, напомню про бронирование. " +
				"Сначала выберите хотя бы одну остановку в списке «Добавить», затем задайте вопрос конкретнее."
		}
		return "Кратко о вашем маршруте: остановок сейчас " + strconv.Itoa(n) + ". Могу предложить логичное продолжение из каталога виноделен, " +
			"подсказать про порядок посещений или трансфер. Уточните, что важнее — море, Тамань, предгорья или конкретный стиль вин."
	}
}

// SequentialTourChat возвращет текст ответа и флаг использования Yandex GPT.
func SequentialTourChat(folderID, token, userMessage string, history []ChatTurn, routePlaces, wineryCatalog []map[string]any) (string, bool) {
	prompt := buildSequentialChatPrompt(userMessage, history, routePlaces, wineryCatalog)
	if folderID != "" && token != "" {
		if text := strings.TrimSpace(CallYandexGPT(folderID, token, prompt, 900)); text != "" {
			return CapNarrative(text, sequentialChatMaxOut), true
		}
	}
	return CapNarrative(FallbackSequentialChat(userMessage, routePlaces), sequentialChatMaxOut), false
}
