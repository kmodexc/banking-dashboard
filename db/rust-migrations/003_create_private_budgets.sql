create table if not exists private_budgets(
    subject varchar(255) primary key,
    budgets jsonb not null,
    updated_at timestamptz not null default now()
);
