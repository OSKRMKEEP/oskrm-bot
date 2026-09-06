const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'CLAVE_SECRETA_SALA_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1360329140492856';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Endpoint corregido de Gemini (se utiliza gemini-1.5-flash directamente)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (!message) return;

        // Corregir remitente
        const from = message.from || value?.contacts?.[0]?.wa_id;
        let contents = [];

        // 1. SI ES UN MENSAJE DE TEXTO
        if (message.type === 'text') {
            console.log(`Texto recibido de ${from}: "${message.text.body}"`);
            contents = [{ parts: [{ text: message.text.body }] }];
        } 
        // 2. SI ES UN AUDIO O MENSAJE DE VOZ
        else if (message.type === 'audio') {
            console.log(`Audio recibido de ${from}. Procesando archivo...`);
            const mediaId = message.audio.id;

            // Paso A: Obtener la URL del audio desde Meta
            const mediaRes = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
            });

            // Paso B: Descargar el archivo binario del audio
            const audioBuffer = await axios.get(mediaRes.data.url, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
                responseType: 'arraybuffer'
            });

            const base64Audio = Buffer.from(audioBuffer.data).toString('base64');
            const mimeType = message.audio.mime_type || 'audio/ogg';

            // Estructura multimodal para Gemini
            contents = [{
                parts: [
                    { inline_data: { mime_type: mimeType, data: base64Audio } },
                    { text: "Escucha este audio y responde o resume lo solicitado de forma clara." }
                ]
            }];
        } else {
            return;
        }

        // Enviar consulta a Gemini
        const geminiRes = await axios.post(GEMINI_URL, { contents });
        const replyText = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude interpretar el mensaje.";

        console.log(`Respuesta enviada a ${from}: "${replyText}"`);

        // Responder al usuario en WhatsApp
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

    } catch (error) {
        console.error("Error al procesar:", error.response?.data || error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
