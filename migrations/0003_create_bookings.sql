CREATE TABLE seat_holds (
  id         uuid PRIMARY KEY,
  show_id    uuid NOT NULL,
  user_id    uuid NOT NULL REFERENCES users (id),
  seat_ids   text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id),
  show_id    uuid NOT NULL,
  hold_id    uuid NOT NULL,
  amount     numeric(10, 2) NOT NULL,
  status     text NOT NULL,
  payment_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE booking_seats (
  booking_id uuid NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  show_id    uuid NOT NULL,
  seat_id    text NOT NULL,
  PRIMARY KEY (booking_id, seat_id)
);

CREATE INDEX bookings_pending_expiry_idx ON bookings (status, expires_at);
CREATE INDEX booking_seats_show_idx ON booking_seats (show_id);
