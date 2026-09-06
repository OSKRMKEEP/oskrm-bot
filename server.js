const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'CLAVE_SECRETA_SALA_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1360329140492856';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 1. Ruta de verificación para Meta (GET)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// 2. Ruta para recibir y procesar mensajes de WhatsApp (POST)
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (!message) return;

        // Obtener número del remitente correctamente
        const from = message.from || value?.contacts?.[0]?.wa_id;
        let userText = "";

        if (message.type === 'text') {
            userText = message.text.body;
        } else {
            userText = "Hola, he recibido un archivo o mensaje multimedia.";
        }

        console.log(`Mensaje entrante de ${from}: "${userText}"`);

        // Endpoint corregido de la API de Gemini (v1beta con gemini-1.5-flash)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const geminiRes = await axios.post(
            geminiUrl,
            {
                contents: [{ parts: [{ text: userText }] }]
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const replyText = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar una respuesta.";

        console.log(`Respuesta de Gemini: "${replyText}"`);

        // Enviar respuesta por WhatsApp
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

        console.log("Respuesta enviada a WhatsApp exitosamente.");

    } catch (error) {
        console.error("Error al procesar la petición:", error.response?.data || error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de OSKRM corriendo en el puerto ${PORT}`));
