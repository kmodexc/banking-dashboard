create table if not exists private_categories(
    subject varchar(255) primary key,
    categories jsonb not null,
    updated_at timestamptz not null default now()
);
