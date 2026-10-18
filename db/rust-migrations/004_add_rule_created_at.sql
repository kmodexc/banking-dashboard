ALTER TABLE private_rules
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE community_rules
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
