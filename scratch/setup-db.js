const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const SQL = `
-- Enable UUID extension if needed
create extension if not exists "uuid-ossp";

-- 1. Configurações
create table if not exists c04_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Clientes
create table if not exists c04_customers (
    id_pessoa text primary key,
    name text not null,
    document text,
    phone text,
    status text,
    units text,
    country text,
    state text,
    city text,
    zip text,
    street text,
    number text,
    complement text,
    neighborhood text,
    address text,
    address_hash text,
    hash text,
    pets text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Geocodificação (Cache)
create table if not exists c04_geocodes (
    id_pessoa text primary key references c04_customers(id_pessoa) on delete cascade,
    address_hash text not null,
    lat double precision not null,
    lng double precision not null,
    formatted_address text,
    status text not null,
    reason text,
    distance_km double precision,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Cache Diário de Vendas
create table if not exists c04_daily_sales (
    id_pessoa text not null references c04_customers(id_pessoa) on delete cascade,
    sale_date date not null,
    visits integer not null default 0,
    spend double precision not null default 0.0,
    ticket double precision not null default 0.0,
    frequency text,
    last_purchase text,
    products jsonb not null default '[]'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (id_pessoa, sale_date)
);

-- 5. Dias Sincronizados
create table if not exists c04_synced_days (
    sale_date date primary key,
    synced_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Pendências
create table if not exists c04_pendings (
    pending_id text primary key,
    source text not null,
    reason text not null,
    id_pessoa text,
    customer_name text,
    message text,
    status text not null default 'open',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    resolved_at timestamp with time zone,
    resolved_by text,
    justification text,
    record jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Histórico de Execuções e Telemetria
create table if not exists c04_logs (
    run_id text primary key,
    started_at timestamp with time zone not null,
    finished_at timestamp with time zone,
    status text not null,
    type text not null,
    period_start date not null,
    period_end date not null,
    visible_user text,
    expected_sales integer,
    pertinent_sales integer,
    accepted_sales integer,
    rejected_sales integer,
    mapped_sales integer,
    pending_count integer,
    error text,
    telemetry jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
`;

async function main() {
    const credsPath = path.join(__dirname, "..", "supabase-credentials.json");
    if (!fs.existsSync(credsPath)) {
        console.error("Erro: arquivo supabase-credentials.json não encontrado na raiz do projeto.");
        console.error("Crie o arquivo com a estrutura:");
        console.error('{\n  "connectionString": "postgresql://postgres:[senha]@db.[ref].supabase.co:5432/postgres",\n  "supabaseUrl": "https://[ref].supabase.co",\n  "supabaseAnonKey": "..."\n}');
        process.exit(1);
    }

    const credentials = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    if (!credentials.connectionString) {
        console.error("Erro: a propriedade connectionString não está definida no supabase-credentials.json");
        process.exit(1);
    }

    console.log("Conectando ao banco PostgreSQL do Supabase...");
    const client = new Client({
        connectionString: credentials.connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Conectado com sucesso. Executando script DDL...");
        await client.query(SQL);
        console.log("Tabelas criadas ou já existentes estruturadas com sucesso!");
    } catch (error) {
        console.error("Falha ao rodar o script SQL no banco:", error);
    } finally {
        await client.end();
    }
}

main();
