# Módulo Ponto • Controle e Edição Ágil de Ponto Eletrônico

O módulo **Ponto** ("Keyboard Flow Perfected") é a ferramenta de produtividade focada em auditoria e fechamento acelerado da folha de ponto eletrônico no CRM Clube04.

---

## 🕒 Proposta do Módulo

O fechamento de ponto convencional exige que o gerente clique em cada colaborador, selecione o mês, clique em buscar, verifique inconsistências linha a linha, clique em editar, salve e repita o ciclo centenas de vezes.

O módulo Ponto centraliza e agiliza todo o fluxo em uma **interface unificada acelerada por teclado**, permitindo buscar dados de múltiplos colaboradores em lote, identificar inconsistências automaticamente e editar registros de forma imediata na mesma tela.

---

## 🚦 Regras de Negócio e Validação de Inconsistências

Durante a extração, o sistema varre todos os registros de ponto e sinaliza em vermelho as linhas que violam as regras da CLT e acordos internos:

1.  **Registros Ímpares (`Ímpar`)**: Dias com marcações incompletas (ex: entrada registrada mas saída em branco).
2.  **Intervalo Curto (`Interv < 15m`)**: Intervalos de repouso ou alimentação com menos de 15 minutos de duração (risco trabalhista).
3.  **Carga de Trabalho Reduzida (`< 6 Horas`)**: Dias úteis normais (exceto domingos) onde a carga horária total trabalhada ficou abaixo de 6 horas sem justificativa.
4.  **Horas Extras Excessivas (`Hora Extra++`)**: Jornadas diárias que extrapolaram o limite legal tolerável (geralmente $>9$ horas de trabalho no dia ou $>9$ horas em sábados).

---

## ⌨️ Atalhos de Teclado e Fluxo Ágil (Keyboard Flow)

O módulo foi projetado para ser operado inteiramente sem o mouse, acelerando a correção diária dos horários:

| Tecla / Atalho | Contexto de Ação | Efeito Operacional |
| --- | --- | --- |
| `Seta para Baixo (ArrowDown)` | Campo de Busca de Nome | Navega para baixo na lista de colaboradores. |
| `Seta para Cima (ArrowUp)` | Lista de Colaboradores | Navega para cima na lista. |
| `Enter` ou `Espaço` | Lista de Colaboradores | Marca/desmarca o colaborador selecionado para busca. |
| `Delete` | Campo de Busca / Painel | Limpa a lista de colaboradores selecionados. |
| `Enter` | Campo de Busca Vazio | Executa a busca em lote dos colaboradores selecionados (`BUSCAR DADOS`). |
| `Esc` | Qualquer lugar do painel | Fecha o módulo e limpa a memória operacional. |
| `Esc` | Overlay de Edição Aberto | Fecha a janela de edição de horários e retorna ao card. |
| `Shift` + `Seta Esquerda` ou `,` | Overlay de Edição Aberto | Salva e navega para o dia anterior do colaborador. |
| `Shift` + `Seta Direita` ou `.` | Overlay de Edição Aberto | Salva e navega para o dia posterior do colaborador. |

---

## 💾 Ações e Botões do Painel

*   **Buscar Dados (Botão Principal)**: Carrega no iframe oculto a rota `/digital/gerenciarponto.php` e executa requisições assíncronas para puxar os pontos dos colaboradores selecionados no período.
*   **Baixar ZIP**: Gera e faz o download de um arquivo comprimido contendo planilhas/registros consolidados dos pontos dos colaboradores analisados, utilizando a biblioteca JSZip.
*   **Copiar (Botão Mini)**: Atalho rápido em cada tabela de colaborador para copiar a coluna de totais de horas trabalhadas direto para o console/área de transferência, facilitando lançamento no sistema de folha.
*   **Editar (Botão Laranja Mini)**: Abre o painel overlay interno para ajuste imediato das entradas (H1, H2, H3, H4) do dia correspondente no CRM de forma transparente.
