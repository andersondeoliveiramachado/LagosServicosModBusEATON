const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const multer = require('multer');
const ModbusRTU = require('modbus-serial');

// ============================================================
// Carrega config.json (valores padrão caso o arquivo não exista)
// ============================================================
const CONFIG_PATH = path.join(__dirname, 'config.json');
let appConfig = {
    serialPort: { port: 'COM1', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', slaveId: 1 },
    polling: { interval: 1000 },
    server: { port: 3000, host: 'localhost' }
};

try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const loaded = JSON.parse(raw);
    // Merge profundo com os defaults
    appConfig.serialPort = { ...appConfig.serialPort, ...(loaded.serialPort || {}) };
    appConfig.polling = { ...appConfig.polling, ...(loaded.polling || {}) };
    appConfig.server = { ...appConfig.server, ...(loaded.server || {}) };
    console.log('✓ config.json carregado com sucesso.');
} catch (err) {
    console.warn('⚠ config.json não encontrado ou inválido. Usando valores padrão.');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware para JSON
app.use(express.json());

// Configuração do Multer com limite de 1MB para segurança
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1 * 1024 * 1024 } // 1MB máximo
});

// Cliente Modbus
const client = new ModbusRTU();
let isConnected = false;
let registerMap = [];
let currentMapFileName = 'mapa_exemplo.json';
let pollingInterval = null;

// Controle de reconexão
let reconnectAttempts = 0;
let reconnectTimer = null;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 2000; // 2 segundos

// Limite máximo de registradores por requisição Modbus RTU
const MAX_REGISTERS_PER_READ = 125;

// Configurações da Porta Serial (inicializado pelo config.json)
let serialConfig = {
    port: appConfig.serialPort.port,
    baudRate: appConfig.serialPort.baudRate,
    dataBits: appConfig.serialPort.dataBits,
    stopBits: appConfig.serialPort.stopBits,
    parity: appConfig.serialPort.parity,
    slaveId: appConfig.serialPort.slaveId
};

app.use(express.static('public'));

// ============================================================
// Validação do schema do mapa de registradores
// ============================================================
function validateRegisterMap(data) {
    if (!Array.isArray(data)) {
        return { valid: false, message: 'O JSON deve ser um array de registradores.' };
    }

    if (data.length === 0) {
        return { valid: false, message: 'O array de registradores está vazio.' };
    }

    for (let i = 0; i < data.length; i++) {
        const reg = data[i];

        if (typeof reg !== 'object' || reg === null) {
            return { valid: false, message: `Item ${i}: deve ser um objeto.` };
        }

        if (typeof reg.address !== 'number' || !Number.isInteger(reg.address) || reg.address < 0) {
            return { valid: false, message: `Item ${i}: "address" deve ser um inteiro >= 0. Recebido: ${JSON.stringify(reg.address)}` };
        }

        if (typeof reg.name !== 'string' || reg.name.trim() === '') {
            return { valid: false, message: `Item ${i}: "name" deve ser uma string não vazia.` };
        }

        if (typeof reg.unit !== 'string') {
            return { valid: false, message: `Item ${i}: "unit" deve ser uma string.` };
        }

        if (reg.multiplier !== undefined && (typeof reg.multiplier !== 'number' || isNaN(reg.multiplier))) {
            return { valid: false, message: `Item ${i}: "multiplier" deve ser um número válido.` };
        }
    }

    // Verifica endereços duplicados
    const addresses = data.map(r => r.address);
    const unique = new Set(addresses);
    if (unique.size !== addresses.length) {
        return { valid: false, message: 'Existem endereços duplicados no mapa.' };
    }

    return { valid: true };
}

// ============================================================
// Rota para receber o upload do mapa JSON (com validação)
// ============================================================
app.post('/upload-map', upload.single('mapFile'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
        
        const jsonString = req.file.buffer.toString('utf-8');
        let parsed;

        try {
            parsed = JSON.parse(jsonString);
        } catch (parseErr) {
            return res.status(400).json({ success: false, message: 'JSON inválido — erro de sintaxe.' });
        }

        // Valida o schema
        const validation = validateRegisterMap(parsed);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: `Mapa inválido: ${validation.message}` });
        }

        registerMap = parsed;
        currentMapFileName = req.file.originalname || currentMapFileName;
        
        console.log(`✓ Novo mapa de registradores carregado (${currentMapFileName}):`, registerMap.length, 'itens.');
        res.json({ success: true, message: `Mapa carregado com sucesso! (${registerMap.length} registradores)` });
        
        io.emit('map-loaded', registerMap);
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao processar o arquivo.' });
    }
});

// ============================================================
// Rota para Atualizar Limites (Edição Direta)
// ============================================================
app.post('/api/update-limits', (req, res) => {
    try {
        const newLimits = req.body;
        
        if (!Array.isArray(newLimits)) {
            return res.status(400).json({ success: false, message: 'Formato de limites inválido. Esperado array.' });
        }

        // Aplica os limites na memória
        newLimits.forEach(update => {
            const reg = registerMap.find(r => r.address === parseInt(update.address));
            if (reg) {
                if (update.min !== '' && !isNaN(parseFloat(update.min))) reg.min = parseFloat(update.min);
                else delete reg.min;
                
                if (update.max !== '' && !isNaN(parseFloat(update.max))) reg.max = parseFloat(update.max);
                else delete reg.max;
            }
        });

        // Salvar no arquivo físico atual
        const filePath = path.join(__dirname, currentMapFileName);
        fs.writeFileSync(filePath, JSON.stringify(registerMap, null, 2), 'utf-8');

        // Notifica todos os painéis abertos para recarregarem os limites atualizados
        io.emit('map-loaded', registerMap);

        res.json({ success: true, message: `Limites gravados com sucesso em "${currentMapFileName}"!` });
    } catch (e) {
        console.error('Erro ao salvar limites:', e);
        res.status(500).json({ success: false, message: 'Falha de I/O ao gravar no arquivo JSON.' });
    }
});

// Middleware de erro do Multer (captura erros de limite de tamanho)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ success: false, message: 'Arquivo excede o limite de 1MB.' });
        }
        return res.status(400).json({ success: false, message: `Erro de upload: ${err.message}` });
    }
    next(err);
});

// ============================================================
// Rota para conectar à serial com parâmetros customizados
// ============================================================
app.post('/api/connect-serial', async (req, res) => {
    try {
        const { port, baudRate, dataBits, stopBits, parity, slaveId } = req.body;

        // Atualiza as configurações usando nullish coalescing
        serialConfig = {
            port: port ?? serialConfig.port,
            baudRate: baudRate ?? serialConfig.baudRate,
            dataBits: dataBits ?? serialConfig.dataBits,
            stopBits: stopBits ?? serialConfig.stopBits,
            parity: parity ?? serialConfig.parity,
            slaveId: slaveId ?? serialConfig.slaveId
        };

        // Reseta contagem de reconexão ao conectar manualmente
        reconnectAttempts = 0;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // Tenta conectar com as novas configurações
        await connectModbus();
        
        res.json({ success: true, message: `Conectado em ${serialConfig.port}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================
// Rota para desconectar da serial
// ============================================================
app.post('/api/disconnect-serial', async (req, res) => {
    try {
        // Cancela qualquer tentativa de reconexão pendente
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        reconnectAttempts = 0;

        await disconnectModbus();
        res.json({ success: true, message: 'Desconectado com sucesso!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================
// Lógica de Conexão Modbus RS232
// ============================================================
async function connectModbus() {
    try {
        // Se já existe uma conexão aberta, fecha primeiro
        if (isConnected) {
            try { await client.close(); } catch (e) { /* ignora */ }
            isConnected = false;
        }

        // Configuração exata para o padrão de fábrica da Eaton Card-MS
        await client.connectRTUBuffered(serialConfig.port, { 
            baudRate: serialConfig.baudRate,
            dataBits: serialConfig.dataBits,
            stopBits: serialConfig.stopBits,
            parity: serialConfig.parity
        });

        // Timeout de 3 segundos para respostas Modbus
        client.setTimeout(3000);
        
        client.setID(serialConfig.slaveId);
        isConnected = true;
        reconnectAttempts = 0; // Reset após sucesso
        console.log(`✓ Conectado à porta serial ${serialConfig.port} (Eaton Modbus)`);
        
        // Emite status de conexão para todos os clientes
        io.emit('serial-status', { connected: true });
        
        startPolling();
    } catch (error) {
        console.error(`✗ Erro ao abrir porta ${serialConfig.port}:`, error.message);
        isConnected = false;
        io.emit('serial-status', { connected: false });
        throw error;
    }
}

// ============================================================
// Reconexão automática com backoff exponencial
// ============================================================
function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`✗ Máximo de ${MAX_RECONNECT_ATTEMPTS} tentativas de reconexão atingido. Reconexão cancelada.`);
        io.emit('serial-error', { 
            message: `Reconexão falhou após ${MAX_RECONNECT_ATTEMPTS} tentativas. Reconecte manualmente.` 
        });
        return;
    }

    reconnectAttempts++;
    // Backoff exponencial: 2s, 4s, 8s, 16s, 32s (máx 30s)
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), 30000);
    
    console.log(`↻ Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em ${delay / 1000}s...`);

    reconnectTimer = setTimeout(async () => {
        try {
            await connectModbus();
            console.log('✓ Reconexão bem-sucedida!');
        } catch (error) {
            // connectModbus já logou o erro, agenda próxima tentativa
            scheduleReconnect();
        }
    }, delay);
}

// ============================================================
// Lógica de Desconexão Modbus RS232
// ============================================================
async function disconnectModbus() {
    try {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        if (isConnected) {
            await client.close();
        }
        isConnected = false;
        console.log('✓ Desconectado da porta serial');
        io.emit('serial-status', { connected: false });
    } catch (error) {
        console.error('✗ Erro ao desconectar:', error.message);
        isConnected = false;
        throw error;
    }
}

// ============================================================
// Agrupar endereços em blocos contíguos para leitura eficiente
// ============================================================
function groupAddressesIntoBlocks(addresses) {
    if (addresses.length === 0) return [];
    
    // Ordena os endereços
    const sorted = [...addresses].sort((a, b) => a - b);
    const blocks = [];
    let blockStart = sorted[0];
    let blockEnd = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        // Se o próximo endereço é contíguo ou próximo (gap <= 5), 
        // e o bloco não excede o limite Modbus, estende o bloco
        const gap = sorted[i] - blockEnd;
        const newLength = (sorted[i] - blockStart) + 1;
        
        if (gap <= 5 && newLength <= MAX_REGISTERS_PER_READ) {
            blockEnd = sorted[i];
        } else {
            blocks.push({ start: blockStart, length: (blockEnd - blockStart) + 1 });
            blockStart = sorted[i];
            blockEnd = sorted[i];
        }
    }
    // Adiciona o último bloco
    blocks.push({ start: blockStart, length: (blockEnd - blockStart) + 1 });

    return blocks;
}

// ============================================================
// Loop de leitura (Polling) com suporte a endereços esparsos
// ============================================================
let isPolling = false; // Mutex para evitar sobreposição de polling

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    const interval = appConfig.polling.interval || 1000;

    pollingInterval = setInterval(async () => {
        if (!isConnected || registerMap.length === 0 || isPolling) return;

        isPolling = true;

        try {
            const addresses = registerMap.map(r => r.address);
            const blocks = groupAddressesIntoBlocks(addresses);

            // Lê todos os blocos e monta um mapa endereço → valor
            const valueMap = {};

            for (const block of blocks) {
                const data = await client.readHoldingRegisters(block.start, block.length);
                for (let i = 0; i < block.length; i++) {
                    valueMap[block.start + i] = data.data[i];
                }
            }

            // Mapeia os dados usando o JSON carregado
            const mappedData = registerMap.map(reg => {
                const rawValue = valueMap[reg.address];
                if (rawValue === undefined) {
                    return { name: reg.name, value: '---', unit: reg.unit };
                }
                const finalValue = rawValue * (reg.multiplier ?? 1);
                
                return {
                    name: reg.name,
                    value: finalValue.toFixed(1),
                    unit: reg.unit
                };
            });

            // Envia para o Frontend via WebSocket
            io.emit('modbus-data', mappedData);

        } catch (error) {
            console.error("✗ Erro na leitura Modbus:", error.message);
            
            // Se o erro indica desconexão, tenta reconectar
            if (error.message.includes('Port Not Open') || 
                error.message.includes('Timed out') ||
                error.message.includes('EBADF')) {
                console.warn('⚠ Conexão serial perdida. Iniciando reconexão automática...');
                isConnected = false;
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                }
                io.emit('serial-status', { connected: false });
                scheduleReconnect();
            }
        } finally {
            isPolling = false;
        }
    }, interval);
}

io.on('connection', (socket) => {
    console.log('→ Novo cliente conectado na Dashboard');
    // Envia o status atual da conexão serial para o novo cliente
    socket.emit('serial-status', { connected: isConnected });
    if (registerMap && registerMap.length > 0) {
        socket.emit('map-loaded', registerMap);
    }
});

// ============================================================
// Inicia servidor usando config.json
// ============================================================
const SERVER_PORT = appConfig.server.port;
const SERVER_HOST = appConfig.server.host;

server.listen(SERVER_PORT, SERVER_HOST, () => {
    console.log('═══════════════════════════════════════════');
    console.log(`  Lagos Serviços - Modbus Dashboard`);
    console.log(`  Servidor: http://${SERVER_HOST}:${SERVER_PORT}`);
    console.log(`  Serial padrão: ${serialConfig.port} @ ${serialConfig.baudRate} baud`);
    console.log(`  Polling: ${appConfig.polling.interval}ms`);
    console.log('═══════════════════════════════════════════');
    console.log('Aguardando configuração de conexão serial...');
});
