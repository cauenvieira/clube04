# Modelagem e Estrutura de Banco de Dados (Supabase) • Módulo GEO

Este documento apresenta a modelagem física, o DDL (Data Definition Language) de criação das tabelas, as regras de integridade física e as restrições relacionais adotadas pelo módulo GEO no backend PostgreSQL do **Supabase**.

---

## 🏗️ Modelagem Relacional (DDL)

O banco de dados é composto por tabelas integradas. A seguir, o código SQL DDL oficial para a criação e estruturação do banco de dados GEO:

```sql
-- Habilita a extensão UUID se necessário
create extension if not exists "uuid-ossp";

-- 1. Configurações de Exibição e Score
create table if not exists c04_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Cache Diário de Vendas
create table c04_daily_sales (
    id_cliente text not null references c04_customers(id_cliente) on delete cascade,
    data date not null,
    total_gasto double precision not null default 0.0,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (id_cliente, data)
);

-- 5. Registro de Controle de Dias Sincronizados
create table if not exists c04_synced_days (
    sale_date date primary key,
    synced_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Pendências de Geocodificação e Cruzamento
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

-- 7. Execuções e Telemetria (Auditoria de Runs)
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
```

---

## 🔒 Regras de Integridade Relacional e Cascade

*   **Tabelas Pai e Filho**: `c04_geocodes` é agora a tabela pai de endereços. A tabela `c04_customers` aponta para `c04_geocodes(id_localizacao)` com a regra `ON DELETE SET NULL`. A tabela `c04_daily_sales` aponta para `c04_customers(id_cliente)` com `ON DELETE CASCADE`.
*   **Ordem de Dependência**:
    1.  **Deleção/Limpeza**: Deve-se deletar os dados das tabelas na ordem inversa de integridade referencial: `c04_daily_sales` -> `c04_customers` -> `c04_geocodes`.
    2.  **Inserção/Restauração**: Deve-se inserir os dados das tabelas na ordem de prioridade referencial: `c04_geocodes` -> `c04_customers` -> `c04_daily_sales`.

---

## ⚡ Fluxo de Escrita Física e Prevenção de Bloqueios (Locking)

Para evitar erros de travamento de chaves ou transações incompletas no banco (deadlocks), a suite executa as operações de gravação e limpeza sob regras bem definidas:

### 1. Gravação síncrona/sequencial na Limpeza
Ao disparar a ação avançada de **Limpar banco GEO**, o sistema não executa requisições assíncronas paralelas. Os comandos `DELETE` são disparados de forma sequencial através de promises sequenciais com `await`, limpando as tabelas na seguinte ordem:
1.  `c04_daily_sales` (deleta o cache diário de vendas vinculadas).
2.  `c04_customers` (deleta os clientes persistentes).
3.  `c04_geocodes` (deleta as coordenadas geocodificadas).
4.  `c04_pendings` (deleta pendências operacionais).
5.  `c04_logs` (limpa o histórico de telemetria).
6.  `c04_synced_days` (remove o controle de dias sincronizados).
7.  `c04_backups` (remove backups de segurança).

Isso impede violações de FK e transações paralelas conflitantes.

### 2. Inserções Atômicas com Resolução de Duplicados
Na sincronização comum e no carregamento de lotes (`stageBatch`), o frontend envia os objetos com a propriedade HTTP `Prefer: resolution=merge-duplicates` habilitada no header. Isso ativa o recurso nativo de Upsert no banco do Supabase, atualizando registros que já existem sem lançar exceções de chave duplicada (PK Violation).

---

## 🧼 Sanitizadores e Preenchimento de Defaults

Antes de realizar requisições de inserção ou atualização no Supabase, a suite executa sanitizadores no frontend que uniformizam o payload:

*   **Uniformidade de Chaves (PostgREST)**: Para envios em lote (bulk insert), todos os objetos JavaScript devem possuir as mesmas propriedades. O sanitizador define explicitamente `null` para campos opcionais ausentes no objeto corrente, prevenindo a rejeição da API do Supabase.
*   **Tratamento de `NOT NULL`**:
    *   **Cliente sem Nome**: O campo `nome` na tabela `c04_customers` é obrigatório. Se o CRM retornar um cadastro com o campo nome nulo ou vazio, o sanitizador atribui `"Cliente " + idPessoa`.
    *   **Geocodificações Falhas**: Em endereços cuja localização falhou, os campos de latitude e longitude no banco devem ser gravados como `0.0` com status `"failed"`, evitando falhas de `NOT NULL`.
    *   **Vendas Diárias**: Campos de métricas financeiras recebem valores numéricos explícitos (`0` ou `0.0`) para evitar rejeições.
