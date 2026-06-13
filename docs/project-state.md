# Estado do Projeto GEO

## Objetivo da versao estavel

Entregar uma consulta geografica reproduzivel para os clientes pertinentes ao periodo, sem alterar cadastros do Clube04 e sem publicar dados persistentes parciais.

## Fontes

| Fonte | Responsabilidade |
| --- | --- |
| `relcliente.php` | IDs pertinentes, visitas, frequencia, ultima compra e acesso aos detalhes de servicos. |
| `cliente.php` CSV | Cadastro atual, telefone, CPF, pets e endereco. |
| Google Geocoding API | Coordenadas, endereco resolvido e bairro. |
| Google Sheets + Apps Script | Dados persistentes, versoes, configuracoes, pendencias, overrides e auditoria. |

## Estado de implementacao esperado

- Um Map ID JavaScript.
- Sem poligonos de bairros.
- Publicacao por `datasetVersion` e `Meta.activeVersion`.
- Cruzamento CSV por tutor completo + telefone normalizado exatos; sem telefone, somente tutor unico e consistente.
- Falhas de geocodificacao persistidas e reutilizadas.
- Varredura completa repete somente falhas.
- Overrides GEO auditados.
- Metricas comerciais somente em memoria.

## Riscos operacionais

- A planilha publica contem dados pessoais.
- A chave Maps e visivel no navegador.
- Alteracoes no HTML do Clube04 podem interromper coletores.
- Alteracoes no Apps Script exigem nova implantacao Web App.

## Validacao autenticada de 12/06/2026

- Apps Script implantado no mesmo endpoint com `serviceVersion` `2026-06-12.7`.
- Schema validado e aba `Overrides` criada sem limpeza dos dados reais.
- Escrita artificial e staging artificial foram criados, lidos e removidos.
- Maps JavaScript, Map ID, Advanced Markers e uma geocodificacao artificial responderam corretamente.
- Pre-validacao de `11/06/2026` a `12/06/2026`: 12 pertinentes, 12 aceitos, 12 cadastros minimos, 0 enderecos validos e 24 pendencias.
- A causa dos nomes divergentes foi identificada: `textContent` concatenava tutor e pets exibidos depois do `<br>` em `relcliente.php`.
- A pre-validacao acima e um alerta operacional, nao uma sincronizacao publicada.
- `Meta.activeVersion` permanece `legacy` ate a primeira sincronizacao versionada concluida.

## Correcao aplicada antes da primeira sincronizacao

- Somente o tutor anterior ao primeiro `<br>` e coletado de `relcliente.php`.
- Pets de `relcliente.php` sao ignorados; `cliente.php` CSV e a unica fonte de pets.
- Telefones de ambas as fontes usam somente o trecho depois do ultimo `- ` e persistem somente digitos.
- Telefone isolado e nome parcial continuam proibidos.
- Tutor sem telefone cruza somente quando ambas as fontes estao sem telefone e o cadastro CSV e unico e consistente.

## Pre-validacao apos correcao

Em `11/06/2026` a `12/06/2026`, a coleta somente leitura encontrou:

- 12 tutores pertinentes e corretamente extraidos.
- 11 cruzamentos exatos por tutor + telefone.
- 1 cruzamento unico com telefone vazio nas duas fontes.
- 0 ambiguidades sem telefone.
- 1 cadastro minimo, 3 pendencias e 10 enderecos validos.

Nenhuma sincronizacao foi publicada durante essa validacao.
