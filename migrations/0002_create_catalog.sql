CREATE TABLE movies (
  id            uuid PRIMARY KEY,
  title         text NOT NULL,
  duration_min  integer NOT NULL CHECK (duration_min BETWEEN 1 AND 600),
  language      text NOT NULL,
  certification text NOT NULL CHECK (certification IN ('U', 'UA', 'A', 'S')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cinemas (
  id         uuid PRIMARY KEY,
  name       text NOT NULL,
  city       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE screens (
  id            uuid PRIMARY KEY,
  cinema_id     uuid NOT NULL REFERENCES cinemas (id) ON DELETE CASCADE,
  name          text NOT NULL,
  rows          integer NOT NULL CHECK (rows BETWEEN 1 AND 26),
  seats_per_row integer NOT NULL CHECK (seats_per_row BETWEEN 1 AND 50),
  UNIQUE (cinema_id, name)
);

CREATE TABLE shows (
  id         uuid PRIMARY KEY,
  movie_id   uuid NOT NULL REFERENCES movies (id),
  screen_id  uuid NOT NULL REFERENCES screens (id),
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  price      numeric(10, 2) NOT NULL CHECK (price > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX shows_movie_id_idx ON shows (movie_id);
CREATE INDEX shows_screen_starts_idx ON shows (screen_id, starts_at);
CREATE INDEX cinemas_city_idx ON cinemas (lower(city));
