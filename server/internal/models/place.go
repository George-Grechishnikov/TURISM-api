package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Place struct {
	ID               uuid.UUID       `json:"id"`
	Name             string          `json:"name"`
	Slug             string          `json:"slug"`
	Latitude         float64         `json:"latitude"`
	Longitude        float64         `json:"longitude"`
	Region           string          `json:"region"`
	Category         string          `json:"category"`
	IsWinery         bool            `json:"is_winery"`
	ShortDescription string          `json:"short_description"`
	FullDescription  string          `json:"full_description,omitempty"`
	Tags             json.RawMessage `json:"tags"`
	PhotoURLs        json.RawMessage `json:"photo_urls"`
	VideoURL         *string         `json:"video_url"`
	Published        bool            `json:"-"`
	CreatedAt        time.Time       `json:"created_at,omitempty"`
	UpdatedAt        time.Time       `json:"updated_at,omitempty"`
}

func (p *Place) TagsSlice() []string {
	var s []string
	if len(p.Tags) > 0 {
		_ = json.Unmarshal(p.Tags, &s)
	}
	return s
}

func (p *Place) PhotoURLsSlice() []string {
	var s []string
	if len(p.PhotoURLs) > 0 {
		_ = json.Unmarshal(p.PhotoURLs, &s)
	}
	return s
}
