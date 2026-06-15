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

-- Drop tables to rewrite them
drop table if exists c04_daily_sales cascade;
drop table if exists c04_customers cascade;
drop table if exists c04_geocodes cascade;
drop table if exists c04_pendings cascade;
drop table if exists c04_logs cascade;
drop table if exists c04_synced_days cascade;

-- 2. Geocodificação (Cache/Localização) - Tabela Pai de Endereços
create table c04_geocodes (
    id_localizacao serial primary key,
    cep text not null,
    numero text,
    longitude double precision not null,
    latitude double precision not null,
    rua text,
    bairro text,
    cidade text,
    estado text,
    pais text,
    run_id text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint c04_geocodes_cep_numero_key unique (cep, numero)
);

-- 3. Clientes
create table c04_customers (
    id_cliente text primary key,
    status text,
    nome text not null,
    telefone text,
    cpf text,
    doguinhos text,
    id_localizacao integer references c04_geocodes(id_localizacao) on delete set null,
    run_id text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Cache Diário de Vendas
create table c04_daily_sales (
    id_cliente text not null references c04_customers(id_cliente) on delete cascade,
    data date not null,
    total_gasto double precision not null default 0.0,
    run_id text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (id_cliente, data)
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
    run_id text,
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

-- 8. Backups de Segurança
create table if not exists c04_backups (
    backup_id text primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    size_bytes integer not null,
    data jsonb not null,
    visible_user text,
    status text not null
);

-- RPC Function to get DB and table sizes
create or replace function c04_get_db_size()
returns jsonb
language plpgsql
security definer
as $$
declare
    total_size bigint;
    table_sizes jsonb;
    log_size bigint;
    log_count bigint;
    backup_size bigint;
    backup_count bigint;
begin
    total_size := pg_database_size(current_database());
    
    select jsonb_object_agg(relname, pg_total_relation_size(oid))
    into table_sizes
    from pg_class
    where relname in ('c04_settings', 'c04_customers', 'c04_geocodes', 'c04_daily_sales', 'c04_synced_days', 'c04_pendings', 'c04_logs', 'c04_backups')
      and relnamespace = 'public'::regnamespace;

    select count(*), coalesce(sum(pg_column_size(c04_logs)), 0)
    into log_count, log_size
    from c04_logs;

    select count(*), coalesce(sum(pg_column_size(c04_backups)), 0)
    into backup_count, backup_size
    from c04_backups;

    return jsonb_build_object(
        'database_size_bytes', total_size,
        'table_sizes', coalesce(table_sizes, '{}'::jsonb),
        'log_count', log_count,
        'log_size_bytes', log_size,
        'backup_count', backup_count,
        'backup_size_bytes', backup_size
    );
end;
$$;
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
