(function (root) {
    "use strict";

    let activeRunId = null;

    async function writeAuditLog(type, visibleUser, error = null, telemetry = null) {
        const runId = `run-${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const row = {
            run_id: runId,
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            status: error ? "error" : "success",
            type: type,
            period_start: "1970-01-01",
            period_end: "1970-01-01",
            visible_user: visibleUser || "",
            error: error ? String(error.message || error) : null,
            telemetry: telemetry || null
        };
        try {
            await request("c04_logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(row)
            });
        } catch (err) {
            console.error("Erro ao gravar log de auditoria:", err);
        }
        return runId;
    }

    function configured() {
        const config = root.C04GeoConfig || {};
        return !!(config.supabaseUrl && config.supabaseAnonKey && 
                 !config.supabaseUrl.includes("SUA_URL_AQUI") &&
                 !config.supabaseAnonKey.includes("SEU_ANON_KEY_AQUI"));
    }

    async function request(path, options = {}) {
        if (!configured()) {
            throw new Error("Configure a URL e o Anon Key do Supabase no c04-geo-config.js.");
        }
        const config = root.C04GeoConfig;
        const url = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`;
        
        const method = (options.method || "GET").toUpperCase();
        if (method !== "GET" || options.countOnly) {
            const headers = Object.assign({
                "apikey": config.supabaseAnonKey,
                "Authorization": `Bearer ${config.supabaseAnonKey}`
            }, options.headers || {});

            const res = await root.fetch(url, Object.assign({}, options, { headers }));
            if (!res.ok) {
                const errText = await res.text();
                let errMsg = `Supabase HTTP ${res.status}`;
                try {
                    const errObj = JSON.parse(errText);
                    errMsg = errObj.message || errObj.hint || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }
            
            if (options.countOnly) {
                const contentRange = res.headers.get("content-range") || "";
                const count = contentRange.split("/")[1];
                return count ? parseInt(count, 10) : 0;
            }

            const text = await res.text();
            return text ? JSON.parse(text) : null;
        }

        let allResults = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const startRange = page * pageSize;
            const endRange = startRange + pageSize - 1;
            const headers = Object.assign({
                "apikey": config.supabaseAnonKey,
                "Authorization": `Bearer ${config.supabaseAnonKey}`,
                "Range": `${startRange}-${endRange}`
            }, options.headers || {});

            const res = await root.fetch(url, Object.assign({}, options, { headers }));
            if (!res.ok) {
                const errText = await res.text();
                let errMsg = `Supabase HTTP ${res.status}`;
                try {
                    const errObj = JSON.parse(errText);
                    errMsg = errObj.message || errObj.hint || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }

            const text = await res.text();
            const data = text ? JSON.parse(text) : null;

            if (Array.isArray(data)) {
                allResults = allResults.concat(data);
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                return data;
            }
        }
        return allResults;
    }

    // Helper para converter snake_case do banco para camelCase do JS
    function toCamel(obj) {
        if (!obj || typeof obj !== "object") return obj;
        if (Array.isArray(obj)) return obj.map(toCamel);
        const result = {};
        for (const key of Object.keys(obj)) {
            const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            result[camel] = toCamel(obj[key]);
        }
        return result;
    }

    // Helper para converter camelCase do JS para snake_case do banco
    function toSnake(obj) {
        if (!obj || typeof obj !== "object") return obj;
        if (Array.isArray(obj)) return obj.map(toSnake);
        const result = {};
        for (const key of Object.keys(obj)) {
            const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snake] = toSnake(obj[key]);
        }
        return result;
    }

    const CUSTOMER_FIELDS = [
        "id_cliente", "status", "nome", "telefone", "cpf", "doguinhos", "id_localizacao", "run_id"
    ];

    const GEOCODE_FIELDS = [
        "id_localizacao", "cep", "numero", "longitude", "latitude", "rua", "bairro", "cidade", "estado", "pais", "run_id"
    ];

    const PENDING_FIELDS = [
        "pendingId", "source", "reason", "idPessoa", "customerName", "message", "status",
        "createdAt", "resolvedAt", "resolvedBy", "justification", "record", "runId"
    ];

    const DAILY_SALES_FIELDS = [
        "id_cliente", "data", "total_gasto", "run_id"
    ];

    function sanitizeCustomer(obj) {
        if (!obj || typeof obj !== "object") return obj;
        return {
            id_cliente: String(obj.idPessoa || obj.id_cliente || "0"),
            status: obj.status !== undefined ? obj.status : null,
            nome: obj.name || obj.nome || ("Cliente " + (obj.idPessoa || obj.id_cliente || "Sem Nome")),
            telefone: obj.phone || obj.telefone || null,
            cpf: obj.document || obj.cpf || null,
            doguinhos: obj.doguinhos || null,
            id_localizacao: obj.idLocalizacao !== undefined && obj.idLocalizacao !== null ? Number(obj.idLocalizacao) : (obj.id_local_izacao !== undefined ? Number(obj.id_local_izacao) : null),
            run_id: obj.runId || obj.run_id || activeRunId || null
        };
    }

    function sanitizeGeocode(obj) {
        if (!obj || typeof obj !== "object") return obj;
        const row = {
            cep: obj.zip || obj.cep || "",
            numero: obj.number || obj.numero || null,
            longitude: obj.lng !== undefined ? Number(obj.lng) : (obj.longitude !== undefined ? Number(obj.longitude) : 0.0),
            latitude: obj.lat !== undefined ? Number(obj.lat) : (obj.latitude !== undefined ? Number(obj.latitude) : 0.0),
            rua: obj.street || obj.rua || null,
            bairro: obj.neighborhood || obj.bairro || null,
            cidade: obj.city || obj.cidade || null,
            estado: obj.state || obj.estado || null,
            pais: obj.country || obj.pais || null,
            run_id: obj.runId || obj.run_id || activeRunId || null
        };
        if (obj.idLocalizacao !== undefined && obj.idLocalizacao !== null) {
            row.id_localizacao = Number(obj.idLocalizacao);
        } else if (obj.id_local_izacao !== undefined && obj.id_local_izacao !== null) {
            row.id_localizacao = Number(obj.id_local_izacao);
        }
        return row;
    }

    function sanitizePending(obj) {
        if (!obj || typeof obj !== "object") return obj;
        const clean = {};
        for (const k of PENDING_FIELDS) {
            if (k === "pendingId") {
                clean[k] = (obj[k] !== undefined && obj[k] !== null) ? obj[k] : `pending-${Date.now()}-${Math.random()}`;
            } else if (k === "source") {
                clean[k] = (obj[k] !== undefined && obj[k] !== null) ? obj[k] : "Desconhecido";
            } else if (k === "reason") {
                clean[k] = (obj[k] !== undefined && obj[k] !== null) ? obj[k] : "Desconhecido";
            } else if (k === "status") {
                clean[k] = (obj[k] !== undefined && obj[k] !== null) ? obj[k] : "open";
            } else {
                clean[k] = obj[k] !== undefined ? obj[k] : null;
            }
        }
        if (clean.runId === null) {
            clean.runId = activeRunId;
        }
        return clean;
    }

    function sanitizeDailySale(obj) {
        if (!obj || typeof obj !== "object") return obj;
        return {
            id_cliente: String(obj.idPessoa || obj.id_cliente || "0"),
            data: obj.saleDate || obj.data || new Date().toISOString().slice(0, 10),
            total_gasto: obj.spend !== undefined ? Number(obj.spend) : (obj.total_gasto !== undefined ? Number(obj.total_gasto) : 0.0),
            run_id: obj.runId || obj.run_id || activeRunId || null
        };
    }

    root.C04GeoSheets = {
        configured,

        // snapshot: carrega configurações, clientes e geocodes do Supabase
        snapshot: async () => {
            const [customersData, geocodesData, settingsData] = await Promise.all([
                request("c04_customers?select=id_cliente,status,nome,telefone,cpf,doguinhos,id_localizacao"),
                request("c04_geocodes?select=id_localizacao,cep,numero,longitude,latitude,rua,bairro,cidade,estado,pais"),
                request('c04_settings?select=key,value&key=eq.config')
            ]);

            // Mapeia configurações salvas se existirem
            const savedConfig = settingsData && settingsData[0] ? toCamel(settingsData[0].value) : {};
            if (savedConfig.colors) Object.assign(root.C04GeoConfig.colors, savedConfig.colors);
            if (savedConfig.weights) Object.assign(root.C04GeoConfig.weights, savedConfig.weights);
            if (savedConfig.recurrenceLimits) Object.assign(root.C04GeoConfig.recurrenceLimits, savedConfig.recurrenceLimits);
            if (savedConfig.franchiseAverageTicket) root.C04GeoConfig.franchiseAverageTicket = savedConfig.franchiseAverageTicket;
            if (savedConfig.clusterRadius) root.C04GeoConfig.clusterRadius = savedConfig.clusterRadius;

            // Busca overrides a partir de pendências resolvidas
            const resolvedPendings = await request("c04_pendings?select=id_pessoa,record&status=eq.resolved&id_pessoa=not.is.null");
            const overrides = (resolvedPendings || []).map(p => {
                const rec = p.record || {};
                return {
                    idPessoa: p.id_pessoa,
                    correctedAddress: rec.correctedAddress || "",
                    retryGeocode: rec.action === "retry_geocode"
                };
            });

            // Map customers
            const customersMapped = (customersData || []).map(c => ({
                idPessoa: c.id_cliente,
                status: c.status,
                name: c.nome,
                phone: c.telefone,
                document: c.cpf,
                doguinhos: c.doguinhos,
                idLocalizacao: c.id_localizacao,
                address: "", // compatibility
                addressHash: "", // compatibility
                zip: "", // compatibility
                number: "" // compatibility
            }));

            // Map geocodes
            const geocodesMapped = (geocodesData || []).map(g => ({
                idLocalizacao: g.id_localizacao,
                zip: g.cep,
                number: g.numero,
                lng: g.longitude,
                lat: g.latitude,
                street: g.rua,
                neighborhood: g.bairro,
                city: g.cidade,
                state: g.estado,
                country: g.pais
            }));

            return {
                customers: customersMapped,
                geocodes: geocodesMapped,
                overrides
            };
        },

        saveGeocode: async (geocode) => {
            const snake = sanitizeGeocode(geocode);
            const res = await request("c04_geocodes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify([snake])
            });
            if (res && res[0]) {
                const g = res[0];
                return {
                    idLocalizacao: g.id_localizacao,
                    zip: g.cep,
                    number: g.numero,
                    lng: g.longitude,
                    lat: g.latitude,
                    street: g.rua,
                    neighborhood: g.bairro,
                    city: g.cidade,
                    state: g.estado,
                    country: g.pais
                };
            }
            return null;
        },
        // upsert: Salva/Atualiza clientes consolidados com deduplicação
        upsert: async (payload) => {
            const rows = (payload.customers || []).map(c => sanitizeCustomer(c));
            if (!rows.length) return { ok: true };
            
            // Deduplicate by id_cliente keeping last
            const customerMap = new Map();
            for (const r of rows) {
                customerMap.set(r.id_cliente, r);
            }
            const dedupedRows = Array.from(customerMap.values());
            
            await request("c04_customers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates"
                },
                body: JSON.stringify(dedupedRows)
            });
            return { ok: true };
        },

        // stageBatch: Salva/Atualiza clientes, geocodificações e pendências no Supabase com deduplicação
        stageBatch: async (payload) => {
            const geocodes = (payload.geocodes || []).map(g => toSnake(sanitizeGeocode(g)));
            if (geocodes.length) {
                // Deduplicate geocodes by (cep, numero) keeping last
                const geocodeMap = new Map();
                for (const g of geocodes) {
                    const key = `${g.cep || ""}_${g.numero || ""}`;
                    geocodeMap.set(key, g);
                }
                const dedupedGeocodes = Array.from(geocodeMap.values());
                await request("c04_geocodes", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify(dedupedGeocodes)
                });
            }

            const customers = (payload.customers || []).map(c => toSnake(sanitizeCustomer(c)));
            if (customers.length) {
                // Deduplicate customers by id_cliente keeping last
                const customerMap = new Map();
                for (const c of customers) {
                    customerMap.set(c.id_cliente, c);
                }
                const dedupedCustomers = Array.from(customerMap.values());
                await request("c04_customers", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify(dedupedCustomers)
                });
            }

            const pendings = (payload.pendings || []).map(p => toSnake(sanitizePending(p)));
            if (pendings.length) {
                // Deduplicate pendings by pending_id keeping last
                const pendingMap = new Map();
                for (const p of pendings) {
                    pendingMap.set(p.pending_id, p);
                }
                const dedupedPendings = Array.from(pendingMap.values());
                await request("c04_pendings", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify(dedupedPendings)
                });
            }
            return { ok: true };
        },
        // startRun: Cria registro de execução de sincronização
        startRun: async (payload) => {
            const runId = payload.runId || `run-${Date.now()}`;
            activeRunId = runId;
            const row = {
                run_id: runId,
                started_at: new Date().toISOString(),
                status: "running",
                type: payload.type || "sync",
                period_start: payload.period.start,
                period_end: payload.period.end,
                visible_user: payload.visibleUser || ""
            };
            await request("c04_logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(row)
            });
            return { runId };
        },

        // finishRun: Atualiza o status e métricas da execução
        finishRun: async (payload) => {
            activeRunId = null;
            const telemetrySnake = payload.counters ? {
                sheets_snapshot_ms: payload.counters.sheetsSnapshotMs || 0,
                sales_fetch_ms: payload.counters.salesFetchMs || 0,
                product_details_fetch_ms: payload.counters.productDetailsFetchMs || 0,
                csv_fetch_ms: payload.counters.csvFetchMs || 0,
                processing_ms: payload.counters.processingMs || 0,
                geocoding_ms: payload.counters.geocodingMs || 0,
                sheets_publish_ms: payload.counters.sheetsPublishMs || 0
            } : null;

            const row = {
                finished_at: new Date().toISOString(),
                status: payload.status || "success",
                expected_sales: payload.pertinent || 0,
                pertinent_sales: payload.pertinent || 0,
                accepted_sales: payload.accepted || 0,
                rejected_sales: payload.rejected || 0,
                mapped_sales: payload.mapped || 0,
                pending_count: payload.pending || 0,
                error: payload.error || null,
                telemetry: telemetrySnake
            };
            await request(`c04_logs?run_id=eq.${payload.runId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(row)
            });
            return { ok: true };
        },

        // publishRun: Grava pendências de cruzamento de dados geradas
        publishRun: async (payload) => {
            // Em Supabase, as pendências são salvas no banco na tabela c04_pendings
            return { ok: true, result: "Supabase" };
        },

        discardRun: async (payload) => {
            activeRunId = null;
            // No staging table in Supabase. We keep the logs row so error status can be saved.
            return { ok: true };
        },

        // saveSettings: Salva preferências do usuário no Supabase
        saveSettings: async (payload) => {
            const snakeConfig = toSnake(payload.settings || {});
            const row = {
                key: "config",
                value: snakeConfig,
                updated_at: new Date().toISOString()
            };
            await request("c04_settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates"
                },
                body: JSON.stringify(row)
            });
            return { ok: true };
        },
        // logs: retorna o histórico de logs/runs e detalhes de telemetria (otimizado sem c04_pendings)
        logs: async () => {
            const logsData = await request("c04_logs?select=run_id,started_at,finished_at,status,type,period_start,period_end,visible_user,expected_sales,pertinent_sales,accepted_sales,rejected_sales,mapped_sales,pending_count,error,telemetry&order=started_at.asc");

            // Mapeia telemetrias camelCase no histórico
            const formattedExecutions = (logsData || []).map(item => {
                const telemetry = item.telemetry ? toCamel(item.telemetry) : null;
                return Object.assign({}, toCamel(item), { telemetry });
            });

            return {
                executions: formattedExecutions,
                details: []
            };
        },

        // pendings: busca todas as pendências ativas ou filtradas incluindo run_id
        pendings: async () => {
            const data = await request("c04_pendings?select=pending_id,source,reason,id_pessoa,customer_name,message,status,created_at,record,run_id&order=created_at.desc");
            return toCamel(data || []);
        },

        // resolvePending: atualiza status da pendência, insere justificativa e gera log de auditoria
        resolvePending: async (payload) => {
            const user = payload.visibleUser || (root.C04GeoCore && typeof root.C04GeoCore.visibleUser === "function" ? root.C04GeoCore.visibleUser(root.document) : "");
            const runId = await writeAuditLog("resolve_pending", user, null, { pendingId: payload.pendingId, action: payload.action });
            
            const update = {
                status: payload.action === "ignore" ? "ignored" : "resolved",
                resolved_at: new Date().toISOString(),
                resolved_by: user,
                justification: payload.justification || "",
                run_id: runId,
                record: {
                    action: payload.action,
                    correctedIdPessoa: payload.correctedIdPessoa || "",
                    correctedAddress: payload.correctedAddress || ""
                }
            };
            await request(`c04_pendings?pending_id=eq.${payload.pendingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(update)
            });
            return { ok: true };
        },

        // reopenPending: reabre pendência tratada e gera log de auditoria
        reopenPending: async (payload) => {
            const user = payload.visibleUser || (root.C04GeoCore && typeof root.C04GeoCore.visibleUser === "function" ? root.C04GeoCore.visibleUser(root.document) : "");
            const runId = await writeAuditLog("reopen_pending", user, null, { pendingId: payload.pendingId });
            
            const update = {
                status: "open",
                resolved_at: null,
                resolved_by: null,
                justification: payload.justification || "",
                run_id: runId
            };
            await request(`c04_pendings?pending_id=eq.${payload.pendingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(update)
            });
            return { ok: true };
        },
        // consumeRetries: zera marcações de retentativas
        consumeRetries: async () => {
            return { ok: true };
        },

        dbStatistics: async () => {
            const tables = [
                { name: "Clientes (c04_customers)", path: "c04_customers" },
                { name: "Geocodificações (c04_geocodes)", path: "c04_geocodes" },
                { name: "Logs de Execução (c04_logs)", path: "c04_logs" },
                { name: "Pendências (c04_pendings)", path: "c04_pendings" },
                { name: "Vendas Diárias (c04_daily_sales)", path: "c04_daily_sales" },
                { name: "Dias Sincronizados (c04_synced_days)", path: "c04_synced_days" },
                { name: "Configurações (c04_settings)", path: "c04_settings" },
                { name: "Backups de Segurança (c04_backups)", path: "c04_backups" }
            ];
            
            const counts = {};
            for (const table of tables) {
                try {
                    const count = await request(`${table.path}?select=*&limit=1`, {
                        headers: { "Prefer": "count=exact" },
                        countOnly: true
                    });
                    counts[table.name] = count;
                } catch (error) {
                    counts[table.name] = `Erro ao ler: ${error.message}`;
                }
            }
            return counts;
        },

        getDbSize: async () => {
            return await request("rpc/c04_get_db_size", { method: "POST" });
        },

        createBackup: async (payload = {}) => {
            const visibleUser = payload.visibleUser || "Auto-Backup";
            await writeAuditLog("create_backup", visibleUser);
            
            // Query all tables in parallel to build backup payload
            const [settings, customers, geocodes, dailySales, syncedDays, pendings, logs] = await Promise.all([
                request("c04_settings?select=*"),
                request("c04_customers?select=*"),
                request("c04_geocodes?select=*"),
                request("c04_daily_sales?select=*"),
                request("c04_synced_days?select=*"),
                request("c04_pendings?select=*"),
                request("c04_logs?select=*")
            ]);
            
            const backupData = {
                c04_settings: settings || [],
                c04_customers: customers || [],
                c04_geocodes: geocodes || [],
                c04_daily_sales: dailySales || [],
                c04_synced_days: syncedDays || [],
                c04_pendings: pendings || [],
                c04_logs: logs || []
            };
            
            const jsonStr = JSON.stringify(backupData);
            const sizeBytes = jsonStr.length;
            const backupId = `backup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            await request("c04_backups", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    backup_id: backupId,
                    created_at: new Date().toISOString(),
                    size_bytes: sizeBytes,
                    data: backupData,
                    visible_user: visibleUser,
                    status: "success"
                })
            });
            
            return { ok: true, backupId, sizeBytes };
        },

        getBackups: async () => {
            return toCamel(await request("c04_backups?select=backup_id,created_at,size_bytes,visible_user,status&order=created_at.desc") || []);
        },

        restoreBackup: async (payload) => {
            const visibleUser = payload.visibleUser || (root.C04GeoCore && typeof root.C04GeoCore.visibleUser === "function" ? root.C04GeoCore.visibleUser(root.document) : "");
            await writeAuditLog("restore_backup", visibleUser, null, { backupId: payload.backupId });
            const backupId = payload.backupId;
            if (!backupId) throw new Error("ID do backup nao fornecido.");
            
            const [backup] = await request(`c04_backups?select=data&backup_id=eq.${backupId}`);
            if (!backup || !backup.data) throw new Error("Backup nao encontrado.");
            
            const data = backup.data;
            
            // Delete existing tables sequentially following referential integrity order with filters
            await request("c04_daily_sales?id_cliente=not.is.null", { method: "DELETE" });
            await request("c04_customers?id_cliente=not.is.null", { method: "DELETE" });
            await request("c04_geocodes?id_localizacao=not.is.null", { method: "DELETE" });
            await request("c04_pendings?pending_id=not.is.null", { method: "DELETE" });
            await request("c04_logs?run_id=not.is.null", { method: "DELETE" });
            await request("c04_synced_days?sale_date=not.is.null", { method: "DELETE" });
            await request("c04_settings?key=not.is.null", { method: "DELETE" });
            
            // Insert settings
            if (data.c04_settings && data.c04_settings.length) {
                await request("c04_settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.c04_settings)
                });
            }
            // Insert geocodes FIRST (c04_geocodes is parent of c04_customers)
            if (data.c04_geocodes && data.c04_geocodes.length) {
                await request("c04_geocodes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.c04_geocodes)
                });
            }
            // Insert customers SECOND
            if (data.c04_customers && data.c04_customers.length) {
                await request("c04_customers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.c04_customers)
                });
            }
            // Insert sales
            if (data.c04_daily_sales && data.c04_daily_sales.length) {
                await request("c04_daily_sales", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.c04_daily_sales)
                });
            }
            // Insert synced days
            if (data.c04_synced_days && data.c04_synced_days.length) {
                await request("c04_synced_days", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.c04_synced_days)
                });
            }
            // Insert pendings
            if (data.c04_pendings && data.c04_pendings.length) {
                await request("c04_pendings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.c04_pendings)
                });
            }
            // Insert logs
            if (data.c04_logs && data.c04_logs.length) {
                await request("c04_logs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.c04_logs)
                });
            }
            
            return { ok: true };
        },

        deleteBackup: async (payload) => {
            const visibleUser = payload.visibleUser || (root.C04GeoCore && typeof root.C04GeoCore.visibleUser === "function" ? root.C04GeoCore.visibleUser(root.document) : "");
            await writeAuditLog("delete_backup", visibleUser, null, { backupId: payload.backupId });
            const backupId = payload.backupId;
            if (!backupId) throw new Error("ID do backup nao fornecido.");
            await request(`c04_backups?backup_id=eq.${backupId}`, { method: "DELETE" });
            return { ok: true };
        },

        // resetDatabase: Limpa dados controlados estruturados do GEO no Supabase
        resetDatabase: async (payload) => {
            const visibleUser = payload.visibleUser || (root.C04GeoCore && typeof root.C04GeoCore.visibleUser === "function" ? root.C04GeoCore.visibleUser(root.document) : "");
            await writeAuditLog("reset_db", visibleUser, null, { tables: payload.tables });

            const confirmVal = payload.confirmation || payload.confirm;
            if (confirmVal !== "LIMPAR BANCO GEO") throw new Error("Confirmacao invalida.");
            
            const tablesToClean = payload.tables || [];
            if (tablesToClean.length === 0) return { ok: true, message: "Nenhuma tabela selecionada." };
            
            // Delete sequentially to prevent concurrent deadlock/constraint locking issues with filters
            if (tablesToClean.includes("c04_daily_sales")) {
                await request("c04_daily_sales?id_cliente=not.is.null", { method: "DELETE" });
            }
            if (tablesToClean.includes("c04_customers")) {
                await request("c04_customers?id_cliente=not.is.null", { method: "DELETE" });
            }
            if (tablesToClean.includes("c04_geocodes")) {
                await request("c04_geocodes?id_localizacao=not.is.null", { method: "DELETE" });
            }
            if (tablesToClean.includes("c04_pendings")) {
                await request("c04_pendings?pending_id=not.is.null", { method: "DELETE" });
            }
            if (tablesToClean.includes("c04_logs")) {
                await request("c04_logs?run_id=not.is.null", { method: "DELETE" });
            }
            if (tablesToClean.includes("c04_synced_days")) {
                await request("c04_synced_days?sale_date=not.is.null", { method: "DELETE" });
            }
            if (tablesToClean.includes("c04_backups")) {
                await request("c04_backups?backup_id=not.is.null", { method: "DELETE" });
            }
            
            return { ok: true };
        },

        cleanup: async (payload) => {
            const visibleUser = payload.visibleUser || (root.C04GeoCore && typeof root.C04GeoCore.visibleUser === "function" ? root.C04GeoCore.visibleUser(root.document) : "");
            await writeAuditLog("cleanup_logs", visibleUser, null, { retentionMonths: payload.retentionMonths });

            const retentionMonths = payload.retentionMonths || 12;
            const limitDate = new Date();
            limitDate.setMonth(limitDate.getMonth() - retentionMonths);
            await request(`c04_logs?started_at=lt.${limitDate.toISOString()}`, {
                method: "DELETE"
            });
            return { ok: true };
        },

        // --- MÉTODOS ADICIONAIS DO CACHE DIÁRIO ---
        
        // Retorna dias sincronizados a partir da tabela c04_synced_days
        getSyncedDays: async (start, end) => {
            const data = await request(`c04_synced_days?select=sale_date&sale_date=gte.${start}&sale_date=lte.${end}`);
            return (data || []).map(item => item.sale_date);
        },

        // Grava as vendas diárias processadas e marca os dias como sincronizados com deduplicação
        saveDailySales: async (salesRows, syncedDates) => {
            if (salesRows.length) {
                const rows = salesRows.map(s => sanitizeDailySale(s));
                // Deduplicate by (id_cliente, data), summing total_gasto
                const salesMap = new Map();
                for (const row of rows) {
                    const key = `${row.id_cliente}_${row.data}`;
                    if (salesMap.has(key)) {
                        const existing = salesMap.get(key);
                        existing.total_gasto = (existing.total_gasto || 0) + (row.total_gasto || 0);
                    } else {
                        salesMap.set(key, { ...row });
                    }
                }
                const dedupedSales = Array.from(salesMap.values());
                await request("c04_daily_sales", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify(dedupedSales)
                });
            }
            if (syncedDates.length) {
                // Deduplicate syncedDates keeping last
                const datesMap = new Map();
                for (const d of syncedDates) {
                    datesMap.set(d, { sale_date: d });
                }
                const dedupedDates = Array.from(datesMap.values());
                await request("c04_synced_days", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify(dedupedDates)
                });
            }
        },

        // Carrega vendas consolidadas do cache para um período incluindo run_id
        getDailySales: async (start, end) => {
            const data = await request(`c04_daily_sales?select=id_cliente,data,total_gasto,run_id&data=gte.${start}&data=lte.${end}`);
            return (data || []).map(s => ({
                idPessoa: s.id_cliente,
                saleDate: s.data,
                spend: s.total_gasto,
                visits: 1,
                ticket: s.total_gasto,
                frequency: "0 dias",
                lastPurchase: s.data,
                products: [],
                runId: s.run_id
            }));
        },

        // Salva pendências geradas no cruzamento de dados com deduplicação
        savePendings: async (pendings) => {
            if (!pendings.length) return;
            const rows = pendings.map(p => toSnake(sanitizePending(p)));
            // Deduplicate by pending_id keeping last
            const pendingMap = new Map();
            for (const p of rows) {
                pendingMap.set(p.pending_id, p);
            }
            const dedupedPendings = Array.from(pendingMap.values());
            await request("c04_pendings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates"
                },
                body: JSON.stringify(dedupedPendings)
            });
        },

        healthCheck: async () => {
            const start = Date.now();
            try {
                await request("c04_settings?select=key&key=eq.config&limit=1");
                return { ok: true, latencyMs: Date.now() - start, details: "Conexão com Supabase rest/v1 estabelecida com sucesso." };
            } catch (error) {
                return { ok: false, error: error.message };
            }
        },

        testWrite: async () => {
            const runId = `test-write-${Date.now()}`;
            try {
                await request("c04_logs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        run_id: runId,
                        started_at: new Date().toISOString(),
                        status: "test",
                        type: "sync",
                        period_start: "2026-01-01",
                        period_end: "2026-01-01"
                    })
                });
                await request(`c04_logs?run_id=eq.${runId}`, {
                    method: "DELETE"
                });
                return { ok: true, details: "Operações de inserção e remoção no banco testadas com sucesso." };
            } catch (error) {
                return { ok: false, error: error.message };
            }
        },

        testStaging: async () => {
            const tables = [
                "c04_customers",
                "c04_geocodes",
                "c04_logs",
                "c04_pendings",
                "c04_settings",
                "c04_synced_days",
                "c04_daily_sales"
            ];
            const results = {};
            let allOk = true;
            for (const table of tables) {
                try {
                    await request(`${table}?select=*&limit=1`);
                    results[table] = "OK";
                } catch (error) {
                    results[table] = `Erro: ${error.message}`;
                    allOk = false;
                }
            }
            return { ok: allOk, tables: results };
        }
    };
})(window);
