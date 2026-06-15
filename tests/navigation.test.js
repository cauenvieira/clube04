const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    console.log("=== INICIANDO TESTE E2E DE NAVEGAÇÃO ===");
    
    // Garantir que a pasta de screenshots existe
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Capturar logs do console do navegador
    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
        console.error(`[BROWSER ERROR] ${err.toString()}`);
    });
    
    // Habilitar a interceptação de requisições para injetar os arquivos locais da suite
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        
        if (url.includes('clube04-suite.js')) {
            console.log(`[INTERCEPT] Servindo clube04-suite.js local`);
            const filePath = path.join(__dirname, '../clube04-suite.js');
            request.respond({
                status: 200,
                contentType: 'application/javascript',
                body: fs.readFileSync(filePath)
            });
        } else if (url.includes('modules/geo/')) {
            const fileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0];
            console.log(`[INTERCEPT] Servindo modulo GEO local: ${fileName}`);
            const filePath = path.join(__dirname, '../modules/geo', fileName);
            if (fs.existsSync(filePath)) {
                request.respond({
                    status: 200,
                    contentType: 'application/javascript',
                    body: fs.readFileSync(filePath)
                });
            } else {
                request.continue();
            }
        } else {
            request.continue();
        }
    });
    
    // Auto-aceitar caixas de diálogos (alertas, confirmações) para evitar travamentos
    page.on('dialog', async dialog => {
        console.log(`[DIALOG] Tipo: ${dialog.type()} | Mensagem: ${dialog.message()}`);
        await dialog.accept();
    });
    
    try {
        console.log("Navegando para a página de login do CRM...");
        await page.goto('https://clube04.com.br/digital/', { waitUntil: 'networkidle2' });
        
        console.log("Inserindo credenciais de login...");
        await page.waitForSelector('#loginPessoaSession');
        await page.type('#loginPessoaSession', 'caue.vieira');
        await page.type('#senhaPessoaSession', '#Niver16-07@@');
        
        console.log("Enviando login...");
        await page.keyboard.press('Enter');
        
        // Aguarda a navegação e carregamento inicial do CRM
        console.log("Aguardando redirecionamento...");
        await new Promise(r => setTimeout(r, 6000));
        
        console.log("Injetando script do hub Central Central...");
        await page.evaluate(() => {
            const script = document.createElement('script');
            script.id = 'c04-suite-loader-hybrid';
            script.src = 'http://127.0.0.1:8080/clube04-suite.js';
            document.body.appendChild(script);
        });
        
        console.log("Aguardando carregamento do FAB do hub central...");
        await page.waitForSelector('#c04-fab-container', { timeout: 15000 });
        
        console.log("Abrindo menu de ferramentas central...");
        await page.click('.c04-fab-main');
        await new Promise(r => setTimeout(r, 500));
        
        console.log("Aguardando botão do módulo GEO...");
        await page.waitForSelector('button[data-tooltip="Geolocalizacao"]', { timeout: 5000 });
        
        console.log("Abrindo o módulo GEO (via evaluate para evitar problemas de animação)...");
        await page.evaluate(() => {
            const btn = document.querySelector('button[data-tooltip="Geolocalizacao"]');
            if (btn) btn.click();
            else console.error("Botao Geolocalizacao nao encontrado!");
        });
        
        console.log("Aguardando renderização do painel GEO...");
        await page.waitForSelector('#c04-geo-panel', { timeout: 15000 });
        await page.waitForSelector('#c04-start', { timeout: 5000 });
        
        console.log("Ajustando período de busca para 2 dias (01/06/2026 a 02/06/2026)...");
        await page.evaluate(() => {
            document.getElementById('c04-start').value = '2026-06-01';
            document.getElementById('c04-end').value = '2026-06-02';
            document.getElementById('c04-start').dispatchEvent(new Event('change', { bubbles: true }));
            document.getElementById('c04-end').dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        console.log("Disparando Sincronização...");
        await page.click('#c04-sync');
        
        console.log("Aguardando término da sincronização (o botão deve voltar a exibir 'Sincronizar')...");
        await page.waitForFunction(() => {
            const btn = document.getElementById('c04-sync');
            return btn && btn.textContent === 'Sincronizar';
        }, { timeout: 60000 });
        
        console.log("Sincronização concluída com sucesso!");
        
        console.log("Abrindo modal de Configurações...");
        await page.click('#c04-settings');
        await page.waitForSelector('#c04-settings-modal.open', { timeout: 5000 });
        
        // 1. Aba Personalização
        console.log("Capturando aba Personalização...");
        await page.click('.c04-tab[data-tab="c04-tab-personal"]');
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(screenshotDir, 'tab-personalizacao.png') });
        
        // 2. Aba Pendências
        console.log("Capturando aba Pendências...");
        await page.click('.c04-tab[data-tab="c04-tab-pendings"]');
        await new Promise(r => setTimeout(r, 1500));
        await page.screenshot({ path: path.join(screenshotDir, 'tab-pendencias.png') });
        
        // 3. Aba Logs
        console.log("Capturando aba Logs...");
        await page.click('.c04-tab[data-tab="c04-tab-logs"]');
        await new Promise(r => setTimeout(r, 1500));
        await page.screenshot({ path: path.join(screenshotDir, 'tab-logs.png') });
        
        // 4. Aba Diagnósticos
        console.log("Capturando aba Diagnósticos...");
        await page.click('.c04-tab[data-tab="c04-tab-diagnostics"]');
        await new Promise(r => setTimeout(r, 1500));
        await page.screenshot({ path: path.join(screenshotDir, 'tab-diagnosticos.png') });
        
        // 5. Testar botões na aba de Diagnósticos
        console.log("Rodando Diagnóstico Geral na aba de Diagnósticos...");
        await page.click('#c04-run-general-diagnostic');
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: path.join(screenshotDir, 'diagnostico-geral-resultados.png') });
        
        console.log("Testando Mapas e APIs na aba de Diagnósticos...");
        await page.click('#c04-test-map');
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(screenshotDir, 'teste-mapas-resultados.png') });
        
        console.log("Testando criação de Backup Manual na aba de Diagnósticos...");
        await page.click('#c04-create-manual-backup');
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: path.join(screenshotDir, 'backup-criado-resultados.png') });
        
        console.log("Todos os fluxos foram executados e as screenshots salvas em tests/screenshots/");
        console.log("Teste E2E finalizado com SUCESSO!");
        
    } catch (error) {
        console.error("ERRO NO TESTE E2E:", error);
        process.exitCode = 1;
    } finally {
        await browser.close();
        console.log("Puppeteer fechado.");
    }
})();
