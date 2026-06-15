# Módulo GEO • Geolocalização e Análise Geográfica

O módulo **GEO** da Suite Central Clube04 é uma ferramenta de inteligência geográfica que projeta os dados de faturamento e visitas de clientes do CRM (Clube04 Digital) diretamente em mapas interativos do Google Maps. Ele foi desenhado de forma 100% não-invasiva, sem alterar cadastros reais do CRM e utilizando um cache persistente robusto.

---

## 🧭 Propósito e Objetivos

*   **Inteligência de Vendas**: Visualizar a dispersão geográfica dos clientes ativos em um determinado período para identificar oportunidades de marketing local ou rotas logísticas.
*   **Segmentação Rápida**: Filtrar clientes por frequência de compra, ticket médio de serviços realizados, score geral ou número de visitas.
*   **Análise Regional e Seleção**: Permitir a seleção de áreas circulares, retangulares ou poligonais personalizadas para extrair estatísticas de faturamento regional comparadas com o faturamento geral.
*   **Auditoria de Cadastros**: Identificar inconsistências de cadastro (endereços não localizados, CEPs mal formatados, tutores sem telefone) e resolvê-los de forma auditável e auditada (overrides).

---

## 🔌 Requisitos e Instalação

Para que o módulo GEO funcione com todas as suas capacidades, as APIs e configurações abaixo são necessárias:

### 1. Google Cloud Platform (Maps & Geocoding)
1.  Acesse o Console do Google Cloud e crie/selecione um projeto.
2.  Habilite as seguintes APIs:
    *   `Maps JavaScript API`
    *   `Geocoding API`
3.  Crie uma credencial de API Key e aplique as seguintes restrições de segurança:
    *   **Restrição de HTTP (Referenciadores)**: Defina para `https://clube04.com.br/*`.
    *   **Restrição de API**: Limite a chave para usar apenas `Maps JavaScript API` e `Geocoding API`.
4.  Defina alertas de faturamento e uma cota de segurança diária inicial de **1.000 requisições** para a `Geocoding API`.
5.  O Map ID JavaScript utilizado pela suite é `4e6ccbfcdcfa97ebec8daf1e` (o estilo de mapa está associado diretamente a ele no painel do Google Cloud e não precisa ser passado via código).

### 2. Backend de Armazenamento (Supabase - Estável e Recomendado)
O Supabase é o banco de dados oficial utilizado para o cache de geocodificação, configurações e logs.
1.  Configure as credenciais de acesso no arquivo de configuração local [c04-geo-config.js](../../modules/geo/c04-geo-config.js).
2.  Certifique-se de que a estrutura DDL esteja criada executando o script de provisionamento:
    ```bash
    node scratch/setup-db.js
    ```
    *(Consulte a [Documentação de Banco de Dados](database.md) para mais detalhes).*

---

## 📈 Status de Implementação e Histórico Recente

*   **Backend Único**: Migração completa para Supabase finalizada e estável. As queries do PostgREST foram otimizadas com sanitizadores de payloads unificados.
*   **Correção de Cruzamento de Cadastros**: Resolvido o problema de duplicação de nomes provenientes do `relcliente.php`. Agora, a suite limpa e separa o nome do tutor isolando-o de quebras de linha (`<br>`) e pets associados.
*   **Preservação de Dados de Limpeza**: A função de limpar banco de dados GEO (`resetDatabase` em [c04-geo-supabase.js](../../modules/geo/c04-geo-supabase.js)) foi reestruturada para rodar de forma síncrona/sequencial, eliminando erros de restrição de chave estrangeira (FK) e garantindo a limpeza das tabelas filhas antes das tabelas principais.
*   **Visualização de Pendências**: A Central de Pendências exibe corretamente os dados originais coletados do CRM comparados com a planilha/banco para facilitar overrides manuais.

---

## 📂 Documentos Auxiliares do Módulo
*   [Guia de Funcionamento Interno e Regras de Negócio](funcionamento.md)
*   [Modelagem do Banco de Dados (DDL & Tabelas)](database.md)
*   [Ações, Botões e Interfaces (Fluxogramas Mermaid)](interfaces.md)
