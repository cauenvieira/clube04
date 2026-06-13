# Decisoes do Modulo GEO

| ID | Decisao |
| --- | --- |
| GEO-D01 | `relcliente.php` e autoritativo para pertinencia e fornece `idPessoa`. |
| GEO-D02 | CSV de `cliente.php` e cruzado por tutor completo + telefone normalizado exatos. Sem telefone, exige tutor exato e cadastro CSV unico e consistente. |
| GEO-D03 | Unidade nao participa do cruzamento nem gera pendencia. |
| GEO-D04 | Somente cliente explicitamente inativo e rejeitado. |
| GEO-D05 | Resultado parcial pode ser aceito quando CEP coincide, estado e SP e distancia e ate 60 km. |
| GEO-D06 | Falha de geocodificacao somente e repetida por mudanca de endereco/CEP, override manual ou varredura completa. |
| GEO-D07 | Sincronizar reutiliza falhas; varredura completa repete somente falhas. |
| GEO-D08 | Publicacao persistente usa versao ativa e preserva as duas versoes mais recentes. |
| GEO-D09 | Overrides alteram somente o GEO e possuem auditoria. |
| GEO-D10 | Um unico Map ID e usado. Nao existem poligonos de bairros nesta versao. |
| GEO-D11 | Frequencia ausente e excluida quando existe filtro de faixa. |
| GEO-D12 | O diagnostico geral executa testes completos, inclusive escrita e geocodificacao artificial. |
| GEO-D13 | Acima de 999 geocodificacoes estimadas, a execucao exige confirmacao. |
| GEO-D14 | Somente o texto anterior ao primeiro `<br>` de `relcliente.php` e tutor; pets do relatorio sao ignorados e pets do CSV sao autoritativos. |
| GEO-D15 | Telefone usa o trecho depois do ultimo `- ` e persiste somente digitos, sem validar existencia ou tamanho. |
