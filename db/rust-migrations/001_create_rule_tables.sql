-- Opt-in rule storage. Transaction CSV data is never written here.
create table if not exists global_categories(
    name varchar(80) primary key
);
insert into global_categories(name) values
    ('groceries'),
    ('restaurant'),
    ('paypal'),
    ('vacation'),
    ('items'),
    ('entertainment'),
    ('rent/insurance/elec/mobility'),
    ('bargeld'),
    ('umbuchung'),
    ('mix')
on conflict (name) do nothing;

create table if not exists private_rules(
    id bigserial primary key,
    subject varchar(255) not null,
    keyword varchar(200) not null,
    category varchar(80) not null,
    rule_column varchar(9) not null,
    confidence double precision,
    constraint private_rule_keyword_length check (length(trim(keyword)) >= 3),
    constraint private_rule_category_length check (length(trim(category)) >= 1),
    constraint private_rule_column_value check (rule_column in ('recipient', 'purpose', 'both')),
    constraint private_rule_confidence_range check (
        confidence is null or (confidence >= 0 and confidence <= 1)
    )
);

create unique index if not exists private_rule_unique_key
    on private_rules (subject, lower(keyword), lower(category), rule_column);

create table if not exists community_rules(
    id bigserial primary key,
    keyword varchar(200) not null,
    category varchar(80) not null references global_categories(name),
    rule_column varchar(9) not null,
    confidence double precision,
    constraint community_rule_keyword_length check (length(trim(keyword)) >= 3),
    constraint community_rule_category_length check (length(trim(category)) >= 1),
    constraint community_rule_column_value check (rule_column in ('recipient', 'purpose', 'both')),
    constraint community_rule_confidence_range check (
        confidence is null or (confidence >= 0 and confidence <= 1)
    )
);

create unique index if not exists community_rule_unique_key
    on community_rules (lower(keyword), lower(category), rule_column);

create table if not exists community_rule_contributors(
    rule_id bigint not null references community_rules(id) on delete cascade,
    contributor varchar(255) not null,
    primary key (rule_id, contributor)
);

create table if not exists rule_store_migrations(
    name varchar(100) primary key,
    completed_at timestamptz not null default now()
);
