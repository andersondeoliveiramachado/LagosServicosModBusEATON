# 📡 Lagos Serviços - Modbus EATON Dashboard

Um dashboard web em tempo real para monitoramento de dispositivos através de conexão serial Modbus RTU, projetado originalmente com foco nos nobreaks/UPS Modbus Card-MS da Eaton. Possibilita o mapeamento dinâmico de registradores através de arquivos JSON, oferecendo extrema flexibilidade para leitura de qualquer equipamento escravo em rede Modbus RTU através de RS-232, USB-Serial, etc.

## 🚀 Funcionalidades

*   **Tempo Real**: Utiliza WebSocket (`socket.io`) para espelhar as comunicações da porta Serial na interface web na hora que acontecem.
*   **Mapeamento Dinâmico**: Faça o upload de um simples arquivo JSON (o mapa) e o dashboard adequará a leitura (endereço, multiplicação, nome, e unidade) do seu equipamento na hora.
*   **Leitura Flexível**: Algoritmo robusto agrupa requisições contíguas e previne sobrecarga.
*   **Gestão de Falha (Backoff Exponencial)**: Mecanismo de resiliência tenta restabelecer comunicação autonomamente caso o cabo da via serial saia do lugar.
*   **Acessibilidade e Customização**: Alternador para Modo Claro e Escuro (Theme Toggle) salvo na cache, além de inserção oficial do logotipo corporativo.

## 🛠️ Tecnologias

*   **Backend**: Node.js + Express 5
*   **Comunicação I/O**: `modbus-serial` para porta Serial/RTU
*   **Realtime**: Socket.IO
*   **Interface**: HTML/CSS Vanilha + JS (Single Page, sem dependência pesada de empacotadores visuais)

---

## ⚙️ Uso & Instalação

1.  **Requisitos**: Ter o Node.js v18 ou superior instalado.
2.  Descompacte ou clone o banco deste projeto na sua máquina local.
3.  Abra o terminal em cima do diretório e instale como bibliotecas base:

    ```bash
    npm install
    ```
4.  Inicie a aplicação utilizando o script de comando base:

    ```bash
    npm start
    ```
5.  Acesse o IP da sua máquina na porta 3000 ou através do link padrão local:
    [http://localhost:3000](http://localhost:3000)

## 📄 O Mapa JSON

Um mapa ModBus define de onde, e o quê, nosso painel deverá ler antes de jogar as strings visualmente.
Exemplo (`mapa_exemplo.json`):

```json
[
  { "address": 0, "name": "Tensão de Entrada", "unit": "V", "multiplier": 0.1 },
  { "address": 1, "name": "Carga da Bateria", "unit": "%", "multiplier": 1 },
  { "address": 2, "name": "Temperatura Interna", "unit": "°C", "multiplier": 0.1 }
]
```

---

## 📦 Log de Melhorias - Changelog (v1.1)

### 🛡️ Segurança (Security)
*   **Sanitização contra XSS:**
   A renderização do HTML no frontend (`public/index.html`) não usa mais `innerHTML` diretamente com dados vindo do JSON. A tabela agora é montada em memória na DOM via `document.createElement()` e os dados são preenchidos por `textContent`. O risco de injeção de scripts (XSS) através do upload de arquivos JSON maliciosos foi eliminado.
*   **Limite de Upload no Multer:**
   Implementado um limite estrito de 1MB para mapas através de limite interno do multer e retorno padronizado (`413 Payload Too Large`), protegendo contrapressão de IO e vetores de recusa de base.
*   **Validação Estrita do Arquivo de Mapa:**
   A rota de upload confere não se a string é decodificavel, mas se a estruturação confere com uma lista obrigatória. Não passa array vazios, strings como integer ou repetições de endereçamento lógicos.

### ⚙️ Robustez
*   **Reconexão Automática (Backoff Exponencial):**
   Adicionado agendador de reconexão (`scheduleReconnect()`). Se a comunicação for perdida via Serial/USB, o Back-end retestará as chamadas de maneira compassada para não queimar blocos pendentes de request IO: após 2s, depois 4s, até um teto num máximo de 10 tentativas totais para sinalizar e descansar chamadas (preservando ciclos em caso de quebra definitiva).
*   **Integração do Arquivo `config.json`:**
   O arquivo ignorado define de forma padronizada todas as taxas (Baud), endereços slaves (IDs) e polling limitados já na ignição.
*   **Leitura de Bloco Dinâmica de Endereços Esparsos:**
   Uma chamada gigante que estouraria de forma leiga os bounds oficiais (que prega pacote teto em 125 registradores para o padrão Modbus RTU por ciclo poll), foi seccionado prevendo janelas dinâmicas.
*   **Sincronia Estrita (Mutex e Latência)**:
   Foram travados em variáveis e promises timeouts (3s) e um mecanismo anticolisão de polling, que bloqueia engomar uma leitura repetindo sobre o esqueleto de outra ainda com latências retidas na placa e demorando.

### 🎨 Visual e Experiência do Usuário (UI/UX)
*   **Modo Claro/Escuro Dinâmico**: Implementação de variáveis `:root` baseadas no CSS para trocar as paletas com um único botão. A escolha de tema é lida e guardada localmente utilizando API de `localStorage` para navegação ininterrupta.
*   **Identidade Visual e Logo**: Customizado o Navbar/Header para exibir de forma centralizadora o logotipo estático `logo.png` respeitando a padronização oficial da marca.
