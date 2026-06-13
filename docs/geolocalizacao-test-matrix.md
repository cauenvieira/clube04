# Matriz de Regressao GEO

| Requisito | Cenario obrigatorio | Evidencia |
| --- | --- | --- |
| GEO-D02 | Nome ou telefone isolado nao cruza; tutor + telefone exatos cruzam; tutor unico sem telefone cruza somente com CSV consistente. | `tests/geo-data.test.js` |
| GEO-D03 | CSV sem unidade ou com unidade divergente nao gera pendencia. | `tests/geo-data.test.js` |
| GEO-D05 | Parcial com CEP coerente e aceito como `postal_code_confirmed`. | `tests/geo-map.test.js` |
| GEO-D06 | Falha persistida nao chama geocoder na sincronizacao comum. | `tests/geo-map.test.js` |
| GEO-D07 | Varredura repete falhas e preserva coordenadas validas. | `tests/geo-map.test.js` |
| GEO-D08 | Versao ativa somente muda apos snapshot completo validado. | `tests/apps-script-syntax.test.js` e roteiro Apps Script |
| GEO-D09 | Resolucao cria override auditado e reutilizavel. | `tests/apps-script-syntax.test.js` |
| GEO-D11 | Faixa de frequencia exclui valor ausente. | `tests/geo-core.test.js` |
| UX | Pins reaparecem, resumos comparam geral/selecao e padroes restauram. | `tests/geo-ui-contract.test.js` e roteiro visual |
| Diagnostico | Requisito ausente nunca retorna resultado geral OK. | `tests/geo-ui-contract.test.js` |
| Diagnostico | Consistencia identifica IDs duplicados e pets, geocodificacoes ou overrides orfaos. | `tests/apps-script-syntax.test.js` e diagnostico autenticado |
| Diagnostico | Coleta somente com cadastros minimos, pendencias ou sem endereco valido retorna atencao. | `tests/geo-ui-contract.test.js` e diagnostico autenticado |
| Diagnostico | Incompatibilidade de cruzamento informa linhas e correspondencias agregadas sem expor dados pessoais. | `tests/geo-ui-contract.test.js` e diagnostico autenticado |
| CSV | Cabecalho real `telefones` e reconhecido sem correspondencia parcial de coluna. | `tests/geo-core.test.js` |
| GEO-D14 | Tutor e extraido antes do primeiro `<br>`; pets do relatorio sao ignorados e pets persistidos vem somente do CSV. | `tests/geo-data.test.js` |
| GEO-D15 | Descricao do telefone e removida pelo separador `- ` e somente digitos sao persistidos. | `tests/geo-core.test.js` e `tests/geo-data.test.js` |
| Mapa | Namespace parcial e inicializacao assincrona da Maps API nao bloqueiam a abertura. | `tests/geo-map.test.js` e roteiro visual |
| UX | Janela baixa mantem mapa, barra de progresso e atribuicao do Google visiveis. | `tests/geo-ui-contract.test.js` e roteiro visual |

## Bateria final

1. `npm run verify:all`
2. Diagnostico geral autenticado.
3. Coleta sem escrita.
4. Sincronizacao curta.
5. Cancelamento antes da publicacao.
6. Varredura completa com falha persistida artificial.
7. Validacao visual de mapa, filtros, selecoes, resumos, modais e fullscreen.
