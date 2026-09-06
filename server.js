// Ruta de verificación para Meta Webhook (GET)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'CLAVE_SECRETA_SALA_2026';

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFICADO_CON_EXITO');
            // IMPORTANTE: res.status(200).send(challenge) envía el texto plano exacto que Meta exige
            return res.status(200).send(challenge);
        } else {
            console.log('TOKEN_INCORRECTO');
            return res.sendStatus(403);
        }
    }
    res.sendStatus(400);
});
