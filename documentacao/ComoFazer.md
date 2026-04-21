https://gemini.google.com/app/8630a84db429275c

Excelente. Para as placas Network and Modbus Card-MS da Eaton, o manual oficial de fábrica define o seguinte padrão para a comunicação serial:

* **Baud Rate (Taxa de Transmissão):** 9600
* **Data Bits (Bits de Dados):** 8
* **Parity (Paridade):** Nenhuma (`none`)
* **Stop Bits (Bits de Parada):** 1

Para garantir que o código Node.js converse perfeitamente com a Eaton usando esses padrões exatos, você só precisa atualizar a função `connectModbus()` no arquivo `server.js` que criamos anteriormente.

Substitua a função antiga por esta:

```javascript
// Lógica de Conexão Modbus RS232
async function connectModbus() {
    try {
        // Configuração exata para o padrão de fábrica da Eaton Card-MS
        await client.connectRTUBuffered(SERIAL_PORT, { 
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        client.setID(SLAVE_ID);
        isConnected = true;
        console.log(`Conectado à porta serial ${SERIAL_PORT} (Eaton Modbus)`);
        
        startPolling();
    } catch (error) {
        console.error(`Erro ao abrir porta ${SERIAL_PORT}:`, error.message);
        // Tenta reconectar em 5 segundos caso o cabo seja desconectado
        setTimeout(connectModbus, 5000);
    }
}
```

### Duas dicas importantes sobre o hardware da Eaton:
1. **Slave ID:** Nas placas Eaton, o *Slave ID* (Endereço Modbus) padrão de fábrica geralmente é **1** ou **255**. Se o código conectar na porta serial (a mensagem "Conectado à porta serial..." aparecer), mas começar a dar erro de "Timeout" na leitura dos registradores, altere a variável `const SLAVE_ID = 1;` no topo do código para `const SLAVE_ID = 255;`.
2. **Alteração na Placa:** Se a sua placa já foi configurada por outra pessoa no passado, esses valores podem ter sido alterados via interface web da Eaton ou via terminal. Se os valores padrão não funcionarem, será necessário acessar o IP da placa Eaton no navegador e verificar na aba *Communication* > *Serial Port* quais são as configurações atuais.

===========================================================

mkdir modbus-dashboard
cd modbus-dashboard
npm init -y
npm install express socket.io serialport modbus-serial multer

modbus-dashboard/
├── public/
│   └── index.html      # Interface do usuário (Dashboard)
├── server.js           # Backend em Node.js
└── package.json

[
  { "address": 0, "name": "Tensão de Entrada", "unit": "V", "multiplier": 0.1 },
  { "address": 1, "name": "Carga da Bateria", "unit": "%", "multiplier": 1 },
  { "address": 2, "name": "Temperatura Interna", "unit": "°C", "multiplier": 0.1 }
]

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const ModbusRTU = require('modbus-serial');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuração do Multer para ler o arquivo enviado direto na memória
const upload = multer({ storage: multer.memoryStorage() });

// Cliente Modbus
const client = new ModbusRTU();
let isConnected = false;
let registerMap = [];
let pollingInterval = null;

// Configurações da Porta Serial (Ajuste conforme seu SO: 'COM3', '/dev/ttyUSB0', etc.)
const SERIAL_PORT = 'COM1'; 
const SLAVE_ID = 1;

app.use(express.static('public'));

// Rota para receber o upload do mapa JSON
app.post('/upload-map', upload.single('mapFile'), (req, res) => {
    try {
        if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
        
        const jsonString = req.file.buffer.toString('utf-8');
        registerMap = JSON.parse(jsonString);
        
        console.log('Novo mapa de registradores carregado:', registerMap.length, 'itens.');
        res.json({ success: true, message: 'Mapa carregado com sucesso!' });
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        res.status(500).json({ success: false, message: 'JSON inválido.' });
    }
});

// Lógica de Conexão Modbus RS232
async function connectModbusOld() {
    try {
        // Abre a conexão Serial RTU. Ajuste baudRate conforme seu equipamento
        await client.connectRTUBuffered(SERIAL_PORT, { baudRate: 9600 });
        client.setID(SLAVE_ID);
        isConnected = true;
        console.log(`Conectado à porta serial ${SERIAL_PORT}`);
        
        startPolling();
    } catch (error) {
        console.error(`Erro ao abrir porta ${SERIAL_PORT}:`, error.message);
        // Tenta reconectar em 5 segundos
        setTimeout(connectModbus, 5000);
    }
}

// Lógica de Conexão Modbus RS232
async function connectModbus() {
    try {
        // Configuração exata para o padrão de fábrica da Eaton Card-MS
        await client.connectRTUBuffered(SERIAL_PORT, { 
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        client.setID(SLAVE_ID);
        isConnected = true;
        console.log(`Conectado à porta serial ${SERIAL_PORT} (Eaton Modbus)`);
        
        startPolling();
    } catch (error) {
        console.error(`Erro ao abrir porta ${SERIAL_PORT}:`, error.message);
        // Tenta reconectar em 5 segundos caso o cabo seja desconectado
        setTimeout(connectModbus, 5000);
    }
}

// Loop de leitura (Polling)
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        if (!isConnected || registerMap.length === 0) return;

        try {
            // Define o range de leitura com base no mapa (do menor endereço ao maior)
            const addresses = registerMap.map(r => r.address);
            const minAddr = Math.min(...addresses);
            const maxAddr = Math.max(...addresses);
            const length = (maxAddr - minAddr) + 1;

            // Lê os registradores (Geralmente Função 03 - Holding Registers)
            const data = await client.readHoldingRegisters(minAddr, length);
            
            // Mapeia os dados brutos usando o JSON carregado
            const mappedData = registerMap.map(reg => {
                // Calcula o índice relativo ao endereço inicial da leitura
                const index = reg.address - minAddr;
                const rawValue = data.data[index];
                const finalValue = rawValue * (reg.multiplier || 1);
                
                return {
                    name: reg.name,
                    value: finalValue.toFixed(1), // Formata com 1 casa decimal
                    unit: reg.unit
                };
            });

            // Envia para o Frontend via WebSocket
            io.emit('modbus-data', mappedData);

        } catch (error) {
            console.error("Erro na leitura Modbus:", error.message);
        }
    }, 1000); // Lê a cada 1 segundo
}

io.on('connection', (socket) => {
    console.log('Novo cliente conectado na Dashboard');
});

// Inicia servidor e tenta conectar na serial
server.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
    connectModbus();
});

<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Modbus RS232</title>
    <style>
        body { font-family: Arial, sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: auto; }
        .card { background: #1e1e1e; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #333; }
        input[type="file"] { margin-bottom: 10px; }
        button { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #333; }
        th { color: #888; text-transform: uppercase; font-size: 12px; }
        .value { font-weight: bold; color: #00e676; font-size: 18px; }
    </style>
</head>
<body>

<div class="container">
    <h2>📡 Dashboard Modbus Tempo Real</h2>

    <div class="card">
        <h3>Upload do Mapa de Registradores</h3>
        <p style="font-size: 13px; color: #aaa;">Faça o upload de um arquivo JSON contendo address, name, unit e multiplier.</p>
        <form id="uploadForm">
            <input type="file" id="mapFile" accept=".json" required>
            <button type="submit">Carregar Mapa</button>
        </form>
        <div id="uploadStatus" style="margin-top: 10px; font-size: 14px; color: #00e676;"></div>
    </div>

    <div class="card">
        <h3>Monitoramento</h3>
        <table>
            <thead>
                <tr>
                    <th>Parâmetro</th>
                    <th>Valor</th>
                    <th>Unidade</th>
                </tr>
            </thead>
            <tbody id="dataTableBody">
                <tr><td colspan="3" style="text-align: center; color: #888;">Aguardando mapa de registradores e conexão serial...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
    // Gerenciamento do Upload
    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('mapFile');
        const formData = new FormData();
        formData.append('mapFile', fileInput.files[0]);

        try {
            const response = await fetch('/upload-map', { method: 'POST', body: formData });
            const result = await response.json();
            document.getElementById('uploadStatus').innerText = result.message;
        } catch (error) {
            document.getElementById('uploadStatus').innerText = 'Erro ao enviar o arquivo.';
            document.getElementById('uploadStatus').style.color = 'red';
        }
    });

    // Recepção dos Dados em Tempo Real
    const socket = io();
    const tbody = document.getElementById('dataTableBody');

    socket.on('modbus-data', (data) => {
        tbody.innerHTML = ''; // Limpa a tabela

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name}</td>
                <td class="value">${item.value}</td>
                <td>${item.unit}</td>
            `;
            tbody.appendChild(tr);
        });
    });
</script>

</body>
</html>

