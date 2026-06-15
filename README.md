# Clube04 • Suite Central (Híbrido)

A **Suite Central Clube04** é uma solução de automação, análise e monitoramento corporativo projetada para rodar acoplada ao sistema Clube04 Digital. Utilizando uma arquitetura híbrida, ela injeta ferramentas diretamente no navegador do usuário via **Tampermonkey** e integra-se opcionalmente a backends robustos (Google Sheets via Apps Script ou banco de dados relacional **Supabase / PostgreSQL**).

---

## 🚀 Módulos Disponíveis

A suite é dividida em três módulos principais, cada um projetado para resolver um problema operacional do negócio:

1. **🕒 Módulo Ponto (`docs/ponto/README.md`)**:
   * Otimiza a folha de ponto eletrônico corporativo ("Gerenciar Ponto").
   * Oferece fluxo ágil com atalhos de teclado, validações de inconsistência de horários, horas trabalhadas, atrasos e exportação consolidada em lote (formato ZIP/Excel).
   * Saiba mais em: [Módulo Ponto](docs/ponto/README.md)

2. **🚀 Módulo Metas (`docs/metas/README.md`)**:
   * Painel analítico de faturamento e produtividade em tempo real ("Deep Analytics").
   * Coleta dados de relatórios comerciais do CRM (`relatoriocaixa.php`, `relproduto.php`, `relproducaovenda.php`, `relvendafechada.php`) de forma assíncrona por trás do navegador.
   * Consolida indicadores chaves como faturamento líquido, quantidade de banhos/tosas e pacotes vendidos.
   * Saiba mais em: [Módulo Metas](docs/metas/README.md)

3. **🗺️ Módulo Geolocalização (GEO) (`docs/geo/README.md`)**:
   * Transforma relatórios comerciais em uma rica visualização geográfica interativa integrada ao Google Maps.
   * Cruza dados de vendas diárias do CRM com o cadastro do cliente (`cliente.csv`) para localizar endereços e computar Scores de recorrência e ticket de forma contínua.
   * Gerencia auditoria de inconsistências através de um painel de pendências e aplicação de *overrides* de endereços.
   * Saiba mais em: [Módulo GEO](docs/geo/README.md)

---

## ⚙️ Ambiente de Desenvolvimento Local

Para desenvolver ou testar alterações nos scripts JavaScript sem afetar a produção, a suite suporta carregamento local híbrido:

1. **Inicie o Servidor Local**:
   * Execute o arquivo [dev-mode.bat](dev-mode.bat).
   * Esse script solicita privilégios administrativos para rodar um servidor HTTP sem cache na porta `8080` com suporte a CORS (`npx http-server --cors -c-1 -p 8080`).
   * **Mantenha esta janela do terminal aberta** durante o desenvolvimento.

2. **Instalação do Loader**:
   * Instale a extensão **Tampermonkey** em seu navegador.
   * Adicione o script contido em [tampermonkey-loader.user.js](tampermonkey-loader.user.js).
   * O loader tentará puxar a versão em desenvolvimento direto da sua máquina local (`http://127.0.0.1:8080/clube04-suite.js`). Se o servidor local estiver desligado, ele automaticamente fará o fallback seguro para a versão de produção.
   * Um badge vermelho indicando `🔧 DEV MODE` aparecerá no canto inferior direito do painel para confirmar que você está testando alterações locais.

---

## 📦 Publicação e Deploy em Produção

Quando as alterações locais estiverem prontas e aprovadas:

1. **Commit e Push**:
   * Faça o commit das alterações na sua branch e envie para o repositório remoto do GitHub.
   ```bash
   git add .
   git commit -m "feat: sua nova feature"
   git push origin main
   ```

2. **Purge de Cache na CDN**:
   * O Tampermonkey carrega a versão de produção via CDN jsDelivr. O jsDelivr mantém os arquivos em cache por até 24 horas.
   * Para atualizar o cache instantaneamente após o push, execute o arquivo [purge-cdn.bat](purge-cdn.bat) em seu terminal.
   * O assistente listará todos os arquivos alterados e enviará as requisições de limpeza direto para a API da CDN.

---

## 🧪 Qualidade de Código e Verificação

A integridade do projeto é garantida por dois pilares de testes:

1. **Testes Unitários e Estáticos**:
   ```bash
   npm run verify:all
   ```
   Roda a suíte com **43 testes unitários** locais e valida a sintaxe de todos os arquivos JavaScript principais do hub e dos módulos para evitar falhas em tempo de execução.

2. **Testes de Navegação Ponta a Ponta (E2E)**:
   ```bash
   node tests/navigation.test.js
   ```
   Utiliza o **Puppeteer** para abrir um navegador em segundo plano, realizar o login automatizado no CRM, injetar o hub central local, simular uma consulta de geolocalização e transitar pelas abas do painel GEO, salvando capturas de tela das abas e testes em `tests/screenshots/`. Por segurança, os testes E2E nunca clicam em botões de limpeza para proteger os dados operacionais.

---

## 📁 Estrutura da Documentação

A pasta `docs/` está organizada de forma modular:
*   [docs/geo/](docs/geo/) - Documentação do módulo de geolocalização e mapas.
*   [docs/ponto/](docs/ponto/) - Documentação da otimização e controle de ponto eletrônico.
*   [docs/metas/](docs/metas/) - Documentação do painel analítico de faturamento e metas.
*   [agents.md](agents.md) - Guia de regras do repositório exclusivo para desenvolvedores de IA.
