# 🚢 Lagos Serviços - Histórico de Desenvolvimento Modbus EATON

Nesta pauta de desenvolvimento intensivo, focamos em robustecer o **Dashboard Modbus/Serial da Lagos Serviços** para torná-lo uma ferramenta de alto nível comercial e operacional para Demonstrações, focado em painéis elétricos navais da Eaton (No-breaks, geradores, baterias).

O ambiente final exige um cenário **100% Offline** (arquivamento de bibliotecas dentro da própria máquina) que atue no interior da praça de máquinas de um navio.

---

### 📋 Mapeamento de Pedidos e Implementações (Workflow)

Abaixo estão as exigências formuladas pelo Eng./Usuário perante as minhas execuções no código do projeto:

#### 1. "Impressionar o Cliente" (Interface Profissional & Dark Mode)
* **Pedido Inicial:** Sugestões e execução de recursos matadores para impressionar diretores na demonstração de amanhã via TailwindCSS. Como o ambiente não possui internet, tudo, até as fontes, teve que ser localizadas.
* **O que foi feito:** O Dashboard sofreu um *Redesign Completo*. Abandonamos interfaces clichês e implementamos o conceito de Sala de Controle (Control Room Vibe): *Dark Mode* elegante com tons cinzas, índigo e vermelho rubi. Foram inseridos Cartões de KPI dinâmicos flutuantes e um Gráfico do `Chart.js` em Tempo Real renderizando sob a malha do canvas.

#### 2. Funcionalidade de Simulação "Modo Demonstração"
* **Pedido:** O painel estava congelado em "Aguardando Comunicação". O usuário pediu um botão mágico para simular comunicação sem necessitar fechar portas num CLP serial real durante apresentações.
* **O que foi feito:** Desenvolvido um motor lógico no JavaScript (`demoInterval`) que substitui a serial por inteligência matemática. Quando o Botão Roxo **"Iniciar Simulação"** é clicado, geradores numéricos de passo-aleatório (*Random Walk*) inflam os dados falsos gradualmente causando estabilidade muito próxima ao comportamento orgânico real da máquina na bancada. 

#### 3. Curação e Restauração de Scripts Corrompidos Externos
* **Pedido:** Houve um erro recorrente de Porta `3000` em Uso quando o projeto reiniciava em Windows. A rede impedia o religamento.
* **O que foi feito:** Criação local de um Script utilitário em PowerShell (`derruba_servidor.ps1`) com poderes de super-usuário para encerramento forçado de zumbis de conexão do `node.exe`, facilitando as rotinas de teste da equipe.

#### 4. Edição Física e Direta de Limites (Min/Max) do Backend
* **Pedido:** Possibilidade de reajustar Limites (Mínimos e Máximos) para acionar alarmes durante a demonstração, além de forçar o script Node para reescrever de volta o arquivo físico json persistente.
* **O que foi feito:** 
  1. Criação do botão **[ ⚙️ Ajustar Limites ]** invocando um **Pop-Up Blur Glassmorphism** iterando as variáveis ativas em memória sem quebrar a tela.
  2. Implementação da nova Rota de Backend (`POST /api/update-limits`) no framework `Express` do NodeJS em `index.js`. Esse motor processa o pacote do cliente e sobrescreve efetivamente o sistema de arquivos via `fs.writeFileSync`. O sistema então avisa todos os outros computadores via *Broadcast webSocket* para eles reagirem ao alarme.
  3. Adicionada a leitura visual desses limites abaixo do parâmetro titular na Tabela Completa (ex: *Min: 110 | Max: 138*).

#### 5. Registro Nativo em Logger (Histórico de Alarmes)
* **Pedido:** Adição de seção nativa que rastreia problemas ao passo que eles ocorrem, mantendo registro detalhado e carimbo de tempo (*Timestamp*).
* **O que foi feito:** Introdução do Card de **"Ocorrências (Logs de Alarme)"**. Se o inversor sai de zona segura, ele pisca na tabela central e desce instantaneamente para o rodapé onde vai formatando o log informacional (`Nome do Parâmetro + Relatório + Data Exata`).
* **Adendo de Correção (Fuso Horário):** Usuário solicitou que esse horário batesse cirurgicamente com a hora do Brasil. A função original que pegava o horário frio *client-side* foi ajustada englobando a sintaxe robusta de `Intl.DateTimeFormat` forçada sob `"America/Sao_Paulo"`.

#### 6. Sistema Inteligente de "Análise Preditiva e Ranking de Falhas"
* **Pedido:** Submissão genial do usuário em capturar os alarmes mais constantes, e a eles vincular uma IA preditiva capaz de orientar os marinheiros via monitor. Além de solicitar o Rankeamento dos problemáticos.
* **O que foi feito:** O módulo Preditivo "Tirou Leis Matemáticas Baseadas na Lei de Pareto":
   - Se o sistema é saudável, ele emite placar Verde (Estável).
   - Se ocorrerem erros ele ranqueia a variável mais problemática para um lugar de extremo destaque vermelho ditando ela como o **1º Ofensor Principal** com sua "Taxa de Risco" preenchida por círculos percentuais. 
   - Logo abaixo, o *Card Secundário* empilha o **"Top 3 Outras Ocorrências"**, medindo dinamicamente a 2ª, 3ª e 4ª peças com mais problemas em tabela. Ao final de tudo o componente dita uma Análise de Recomendação Preditiva (Manutenção emergencial na parada seguinte do navio).

#### 7. Ajustes Finos (Relógio no Teto, e Disparadores Manuais do Demo)
* **Pedidos Consolidados Finais:** Inserir Live Clock no topo e transformar o estresse orgânico do cenário Simulação em um *Cenário Controlado* (Livre arbítrio da apresentação).
* **O que foi feito:**
   1. Live Clock no Cabeçalho esquerdo, piscando cada segundo nativamente em formato Brasileiro e rodando sob o Relógio mestre de SP.
   2. Adição dos botões verdes e vermelhos "Saudável" / "Forçar Erro" que interceptam a `FakeData`: permitindo o representante técnico apresentar a tela serena, e ao gosto dele, clicar um botão para aterrorizar propositalmente e mostrar com louvor a tela do software brilhando em vermelho resguardando o histórico de alarmes!

---

**Resumo da Obra - Situação Atual (D0):** O Repositório está em estado de Arte Final. Suas dependências do servidor central Node.js estão otimizadas para lidar com os arquivos locais perfeitamente. A interface funciona num painel reativo complexo provando conceito de resiliência e demonstrando que o time da Lagos é capaz de reter dados e manobrar hardware complexo das plantas propulsoras ou subestações independentemente da interface analógica padrão do equipamento.
