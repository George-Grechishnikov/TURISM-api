// fetchplacephotos подставляет photo_urls в krasnodar_wineries.json через API Википедии / Викисклада.
// Запуск из каталога server: go run ./cmd/fetchplacephotos -write
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const wikiUA = "TurizmFetchPlacePhotos/1.0 (educational demo; +https://github.com/George-Grechishnikov/TURISM-api)"

type fileDoc struct {
	SourceArticle string       `json:"source_article"`
	NoteRU        string       `json:"note_ru"`
	Places        []placeEntry `json:"places"`
}

type placeEntry struct {
	Name                string   `json:"name"`
	Slug                string   `json:"slug"`
	Category            string   `json:"category"`
	Lat                 float64  `json:"lat"`
	Lon                 float64  `json:"lon"`
	Short               string   `json:"short"`
	Tags                []string `json:"tags"`
	TypicalVisitCostRub *int     `json:"typical_visit_cost_rub,omitempty"`
	PhotoURLs           []string `json:"photo_urls,omitempty"`
}

type wikiThumbResp struct {
	Query *struct {
		Pages map[string]struct {
			Thumbnail *struct {
				Source string `json:"source"`
			} `json:"thumbnail"`
		} `json:"pages"`
	} `json:"query"`
}

type commonsInfoResp struct {
	Query *struct {
		Pages map[string]struct {
			ImageInfo []struct {
				ThumbURL string `json:"thumburl"`
				URL      string `json:"url"`
			} `json:"imageinfo"`
		} `json:"pages"`
	} `json:"query"`
}

func main() {
	defaultPath := filepath.Join("internal", "seed", "krasnodar_wineries.json")
	path := flag.String("f", defaultPath, "путь к JSON")
	write := flag.Bool("write", false, "записать файл (иначе только stdout)")
	skipExisting := flag.Bool("skip-existing", false, "не трогать записи, у которых уже есть photo_urls")
	delay := flag.Duration("delay", 400*time.Millisecond, "пауза между HTTP-запросами")
	flag.Parse()

	raw, err := os.ReadFile(*path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read: %v\n", err)
		os.Exit(1)
	}
	var doc fileDoc
	if err := json.Unmarshal(raw, &doc); err != nil {
		fmt.Fprintf(os.Stderr, "json: %v\n", err)
		os.Exit(1)
	}

	client := &http.Client{Timeout: 25 * time.Second}
	changed := 0

	for i := range doc.Places {
		p := &doc.Places[i]
		if *skipExisting && len(p.PhotoURLs) > 0 {
			continue
		}
		q := searchQuery(p.Name, p.Category)
		if q == "" {
			continue
		}
		time.Sleep(*delay)

		img, src := fetchWikiThumb(client, q)
		if img == "" {
			time.Sleep(*delay)
			img, src = fetchCommonsThumb(client, q)
		}
		if img == "" {
			fmt.Fprintf(os.Stderr, "нет фото: %s (%s)\n", p.Slug, q)
			continue
		}
		p.PhotoURLs = []string{img}
		changed++
		fmt.Fprintf(os.Stderr, "ok %s <- %s (%s)\n", p.Slug, src, q)
	}

	out, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "marshal: %v\n", err)
		os.Exit(1)
	}
	out = append(out, '\n')

	if *write {
		if err := os.WriteFile(*path, out, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "write: %v\n", err)
			os.Exit(1)
		}
		fmt.Fprintf(os.Stderr, "записано %d фото в %s\n", changed, *path)
	} else {
		os.Stdout.Write(out)
	}
}

func searchQuery(name, category string) string {
	s := strings.TrimSpace(name)
	repl := []string{
		" (ориентир)", " (демо)", "«", "»",
		"Гостиница ", "Гостевой дом ", "Мини-отель ", "Отель ", "Кафе ", "Ресторан ",
		"Столовая / ", "Закусочная ", "Трансфер ",
	}
	for _, r := range repl {
		s = strings.ReplaceAll(s, r, "")
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return name
	}
	// Уточнение запроса для сервисных точек и трансфера
	switch category {
	case "lodging":
		return s + " Краснодарский край отель"
	case "food":
		return s + " ресторан Кубань"
	case "transfer":
		return "Краснодар автобус транспорт"
	default:
		return s + " винодельня"
	}
}

func fetchWikiThumb(client *http.Client, q string) (imgURL, source string) {
	u := "https://ru.wikipedia.org/w/api.php?" + url.Values{
		"action":       {"query"},
		"generator":    {"search"},
		"gsrsearch":    {q},
		"gsrlimit":     {"1"},
		"gsrnamespace": {"0"},
		"prop":         {"pageimages"},
		"pithumbsize":  {"900"},
		"format":       {"json"},
	}.Encode()
	body, err := wikiGet(client, u)
	if err != nil {
		return "", ""
	}
	var wr wikiThumbResp
	if json.Unmarshal(body, &wr) != nil || wr.Query == nil {
		return "", ""
	}
	for _, page := range wr.Query.Pages {
		if page.Thumbnail != nil && page.Thumbnail.Source != "" {
			return page.Thumbnail.Source, "ru.wikipedia"
		}
	}
	return "", ""
}

func fetchCommonsThumb(client *http.Client, q string) (imgURL, source string) {
	u := "https://commons.wikimedia.org/w/api.php?" + url.Values{
		"action":       {"query"},
		"generator":    {"search"},
		"gsrsearch":    {q},
		"gsrlimit":     {"1"},
		"gsrnamespace": {"6"},
		"prop":         {"imageinfo"},
		"iiprop":       {"url"},
		"iiurlwidth":   {"900"},
		"format":       {"json"},
	}.Encode()
	body, err := wikiGet(client, u)
	if err != nil {
		return "", ""
	}
	var cr commonsInfoResp
	if json.Unmarshal(body, &cr) != nil || cr.Query == nil {
		return "", ""
	}
	for _, page := range cr.Query.Pages {
		for _, ii := range page.ImageInfo {
			if ii.ThumbURL != "" {
				return ii.ThumbURL, "commons"
			}
			if ii.URL != "" {
				return ii.URL, "commons"
			}
		}
	}
	return "", ""
}

func wikiGet(client *http.Client, rawURL string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", wikiUA)
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		io.Copy(io.Discard, res.Body)
		return nil, fmt.Errorf("status %d", res.StatusCode)
	}
	return io.ReadAll(io.LimitReader(res.Body, 2<<20))
}
