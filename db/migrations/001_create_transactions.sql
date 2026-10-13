-- Schema only. Transaction data is imported by db_init.py in a transaction.
-- Keeping this script idempotent lets the Postgres container start safely
-- before a DKB export has been mounted.
create table if not exists umsaetze(
    id bigserial primary key,
    buchungstag varchar(255) not null,
    wertstellung varchar(255),
    bstatus varchar(255),
    zahlungspflichtige varchar(255),
    zahlungsempfaenger varchar(255),
    verwendungszweck varchar(1024),
    umsatztyp varchar(255),
    iban varchar(255),
    betrag numeric(14, 2) not null,
    glaubiger varchar(255),
    mandatsreferenz varchar(255),
    kundenreferenz varchar(255)
);

create index if not exists idx_umsaetze_buchungstag
    on umsaetze (buchungstag);
