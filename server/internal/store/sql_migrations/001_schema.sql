-- Совместимость с прежними таблицами Django + JWT-пользователи в turizm_users

CREATE TABLE IF NOT EXISTS places_place (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(280) NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    region VARCHAR(120) NOT NULL DEFAULT 'Краснодарский край',
    category VARCHAR(20) NOT NULL DEFAULT 'winery',
    is_winery BOOLEAN NOT NULL DEFAULT TRUE,
    short_description VARCHAR(500) NOT NULL DEFAULT '',
    full_description TEXT NOT NULL DEFAULT '',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    video_url VARCHAR(200) NULL,
    published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS places_plac_publish_3f9992_idx ON places_place (published, is_winery);
CREATE INDEX IF NOT EXISTS places_plac_publish_b1ebfe_idx ON places_place (published, category);

CREATE TABLE IF NOT EXISTS trips_routeplan (
    id UUID PRIMARY KEY,
    visitor_id UUID NOT NULL,
    companions_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    mood_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    extra_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ordered_place_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    legs JSONB NOT NULL DEFAULT '[]'::jsonb,
    llm_narrative TEXT NOT NULL DEFAULT '',
    weather_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trips_routeplan_visitor_id_idx ON trips_routeplan (visitor_id);

CREATE TABLE IF NOT EXISTS profiles_visitorprofile (
    id BIGSERIAL PRIMARY KEY,
    visitor_id UUID NOT NULL UNIQUE,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS turizm_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
