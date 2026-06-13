# Geolocalizacao - Setup

## Google Cloud

1. Habilite `Maps JavaScript API` e `Geocoding API`.
2. Use o Map ID JavaScript `4e6ccbfcdcfa97ebec8daf1e`.
3. O estilo `Estilo - CB04 Mapa Cliente` ja esta associado ao Map ID no Google Cloud. O Style ID nao e inserido no codigo.
4. Restrinja a chave por referenciador para `https://clube04.com.br/*`.
5. Restrinja a chave somente para as duas APIs habilitadas.
6. Configure cota diaria inicial de 1.000 consultas para Geocoding API e alertas de faturamento.

## Google Sheets e Apps Script

1. Crie uma Google Sheet.
2. Abra Extensoes > Apps Script e substitua o conteudo por `apps-script/Code.gs`.
3. Em Propriedades do script, crie `WRITE_SECRET` com um segredo forte.
4. Implante como Web App executando como proprietario e permitindo acesso publico.
5. Sempre que alterar `Code.gs`, crie uma nova versao da implantacao Web App. Apenas salvar o projeto nao atualiza a URL `/exec`.
6. Use somente o arquivo instalado `tampermonkey-suite.txt`; carregador e bridge ficam no mesmo userscript.
7. No userscript instalado, configure `APPS_SCRIPT_URL` com a URL `/exec`.
8. No userscript instalado, configure `APPS_SCRIPT_SECRET` com o mesmo segredo.
9. Confirme os `@connect script.google.com` e `@connect script.googleusercontent.com`.
10. Em Configuracoes > Diagnosticos, execute `Diagnostico geral`.
11. Confirme que as abas `Clientes`, `Pets`, `Geocodificacao`, `Overrides` e `Staging` foram criadas.
12. Em Configuracoes > Avancado, execute `Previa da reconstrucao`.
13. Para remover a estrutura antiga, use `Limpar banco GEO` e digite exatamente `LIMPAR BANCO GEO`.
14. A limpeza nao ocorre automaticamente e remove somente as abas controladas pelo modulo GEO.
15. Antes da primeira sincronizacao, use `Testar coleta sem escrita` para validar o periodo sem gravar na planilha ou consumir geocodificacao.
16. Depois de qualquer alteracao em `apps-script/Code.gs`, publique uma nova versao do Web App antes de testar a interface.

O segredo real deve existir somente no Tampermonkey e nas propriedades do Apps Script.
O teste de escrita cria, le e remove uma linha artificial na aba `Diagnostico`.
Sincronizacoes canceladas ou com erro descartam o `Staging` e preservam `Meta.activeVersion`.

## Limites geograficos

Esta versao nao desenha poligonos de bairros ou distritos. O Google Maps exibido pela API nao fornece ao modulo os mesmos poligonos mostrados na busca do produto Google Maps. Nomes de bairros continuam sendo exibidos a partir da geocodificacao.
