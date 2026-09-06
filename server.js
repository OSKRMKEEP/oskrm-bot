const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'CLAVE_SECRETA_SALA_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1360329140492856';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Endpoint actualizado utilizando gemini-2.0-flash (v1beta)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// 1. Verificación para Meta (GET)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// 2. Recepción de mensajes (POST)
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (!message) return;

        // Extraer remitente (soporta estructura estándar y de la API empresarial)
        const from = message.from || value?.contacts?.[0]?.wa_id || value?.metadata?.display_phone_number;
        let contents = [];

        // 1. TEXTO
        if (message.type === 'text') {
            console.log(`Texto recibido de ${from}: "${message.text.body}"`);
            contents = [{ parts: [{ text: message.text.body }] }];
        } 
        // 2. AUDIO / NOTA DE VOZ
        else if (message.type === 'audio') {
            console.log(`Audio recibido de ${from}. Descargando...`);
            const mediaId = message.audio.id;

            const mediaRes = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
            });

            const audioBuffer = await axios.get(mediaRes.data.url, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
                responseType: 'arraybuffer'
            });

            const base64Audio = Buffer.from(audioBuffer.data).toString('base64');
            const mimeType = message.audio.mime_type || 'audio/ogg';

            contents = [{
                parts: [
                    { inline_data: { mime_type: mimeType, data: base64Audio } },
                    { text: "Escucha este audio y responde de manera clara." }
                ]
            }];
        } else {
            return;
        }

        // Petición a Gemini
        const geminiRes = await axios.post(
            GEMINI_URL,
            { contents },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const replyText = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo interpretar el mensaje.";

        console.log(`Respuesta para ${from}: "${replyText}"`);

        // Respuesta a WhatsApp
        await axios.post(
            `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: from,
                text: { body: replyText }
            },
            {
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("Enviado con éxito a WhatsApp.");

    } catch (error) {
        console.error("Error al procesar:", error.response?.data || error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
