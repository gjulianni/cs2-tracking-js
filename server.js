const express = require('express');
const { queryGameServerInfo, queryGameServerPlayer } = require('steam-server-query');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Variáveis para armazenar as informações dos servidores
let serverCache = {
    zombieEscape: {
        serverInfo: null,
        thumbnailUrl: null,
    },
/*    jailbreak: {
        serverInfo: null,
        thumbnailUrl: null,
    },
*/
};

// Configuração dos servidores para tracking
const servers = {
    zombieEscape: { ip: '169.155.126.24', port: '9065' },
   // jailbreak: { ip: '131.196.199.250', port: '27301' }, 
};

// Função para atualizar as informações de um servidor específico
const updateServerInfo = async (serverKey, serverConfig) => {
    try {
        const gameServerAddress = `${serverConfig.ip}:${serverConfig.port}`;
        const serverPlayerList = await queryGameServerPlayer(`${serverConfig.ip}:${serverConfig.port}`);
        const serverInfo = await queryGameServerInfo(gameServerAddress);
        

        const filteredInfo = {
            name: serverInfo.name,
            map: serverInfo.map,
            players: serverInfo.players,
            maxPlayers: serverInfo.maxPlayers,
            playerList: serverPlayerList.players,        
            ip: serverConfig.ip,
            port: serverConfig.port,
        };

        const mapData = JSON.parse(fs.readFileSync(path.join(__dirname, 'mapsId', 'map_ids.json'), 'utf-8'));
        const mapId = mapData[serverInfo.map];
        const thumbnailUrl = mapId ? await getThumbnailUrl(mapId) : null;

        serverCache[serverKey] = {
            serverInfo: filteredInfo,
            thumbnailUrl,
        };
    } catch (error) {
        console.error(`Erro ao atualizar informações do servidor ${serverKey}:`, error);
    }
};

// Função para buscar o thumbnail
const getThumbnailUrl = async (mapId) => {
    try {
        const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${mapId}`;
        const { data } = await axios.get(url, { timeout: 10000 });
        const $ = cheerio.load(data);
        return $('meta[property="og:image"]').attr('content');
    } catch (error) {
        console.error('Erro ao buscar thumbnail URL:', error);
        return null;
    }
};

// Rota para enviar as informações armazenadas em cache para cada servidor
app.get('/server-info/:server', (req, res) => {
    const { server } = req.params;
    const data = serverCache[server];

    if (!data || !data.serverInfo) {
        return res.status(503).send(`Informações do servidor ${server} ainda não estão disponíveis.`);
    }
    res.json(data);
});

// Iniciar o servidor e configurar a atualização de ambos os servidores
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);

    // Atualiza as informações de ambos os servidores a cada 30 segundos
    Object.entries(servers).forEach(([serverKey, serverConfig]) => {
        const update = () => updateServerInfo(serverKey, serverConfig);
        update(); // Atualiza imediatamente
        setInterval(update, 30000); // Atualiza a cada 30 segundos
    });
});