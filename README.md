# Clube04 Suite

Automacoes Tampermonkey para o sistema Clube04 Digital.

O modulo GEO usa `relcliente.php` para definir os clientes pertinentes ao periodo, calcula as metricas comerciais em memoria e persiste somente cadastro, pets, geocodificacao, pendencias e overrides no Google Sheets.

O `relcliente.php` da unidade autenticada e a fonte autoritativa de pertinencia. O tutor e extraido antes do primeiro `<br>` e os pets exibidos nesse relatorio sao ignorados. O CSV exportado por `cliente.php` complementa o cadastro quando nome completo e telefone normalizado correspondem exatamente; tutor unico com telefone vazio nas duas fontes tambem pode cruzar. Unidade nao participa da validacao.

O score padrao combina recorrencia continua (60%) e ticket de servicos realizados (40%).

Consulte `docs/geolocalizacao-funcionamento.md`, `docs/geolocalizacao-setup.md`, `docs/project-state.md`, `docs/geolocalizacao-decisoes.md` e `docs/geolocalizacao-test-matrix.md`.
