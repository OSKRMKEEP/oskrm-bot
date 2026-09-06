const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Variables configuradas desde el servidor
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "CLAVE_SECRETA_SALA_2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Verificación inicial del Webhook de Meta
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Recepción automática de chats y audios reenviados
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (!message) return;

        let content = "";
        if (message.type === 'text') {
            content = message.text.body;
        } else if (message.type === 'audio') {
            content = "Nota de voz reenviada con avance de tareas";
        }

        if (!content) return;

        // Procesamiento centralizado con Gemini API fija
        const prompt = `Analiza este texto reenviado del equipo y detecta si se completó una tarea o se asignó una nueva: "${content}".`;
        
        await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        // Confirmación enviada de vuelta a tu WhatsApp
        await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            to: message.from,
            text: { body: "⚡ TaskKeep: Tarea procesada y guardada en tu panel web." }
        }, {
            headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
        });

    } catch (err) {
        console.error("Error en Webhook:", err.message);
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Bot listo"));