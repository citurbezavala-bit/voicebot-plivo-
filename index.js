const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const conversationHistory = {};

const BANCO_INFO = `Eres el asistente virtual del Banco de Sangre Vida+ en Av. Insurgentes Sur 1234, CDMX. Responde en español de México, muy breve (máximo 2 oraciones), sin listas ni markdown, solo texto natural para hablar en voz alta.

HORARIO: Lunes a Viernes 7am-8pm, Sábados 8am-2pm, Domingos cerrado.
TELÉFONO: 55 1234 5678

SANGRE URGENTE: O+ y O- (reservas bajas). Disponible: A+, A-, B+, AB+. Poca disponibilidad: B-, AB-.

REQUISITOS PARA DONAR: 18-65 años, más de 50kg, buena salud, no haber donado en 3 meses, sin alcohol 48h antes, dormir 6h, identificación oficial, ayuno de 4h (solo evitar grasas).

CITAS HOY: 9:00am, 10:30am, 12:00pm, 2:00pm, 4:00pm, 5:30pm.

BENEFICIOS: análisis de sangre gratis, refrigerio, constancia de donación. Una donación salva hasta 3 vidas.

Si alguien quiere cita, pide su nombre y confirma el horario. Si preguntan por sangre urgente, menciona la urgencia con amabilidad.`;

app.get("/", (req, res) => {
  res.send("Banco de Sangre Vida+ - Voicebot activo.");
});

app.post("/voice", (req, res) => {
  const callSid = req.body.CallSid || "default";
  conversationHistory[callSid] = [];

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Mia-Neural" language="es-MX">Gracias por llamar al Banco de Sangre Vida+. Soy tu asistente virtual.</Say>
  <Gather input="speech" action="https://${req.headers.host}/responder?callSid=${callSid}" method="POST" language="es-MX" speechTimeout="auto" timeout="5">
    <Say voice="Polly.Mia-Neural" language="es-MX">En que te puedo ayudar?</Say>
  </Gather>
</Response>`;

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

app.post("/responder", async (req, res) => {
  const callSid = req.query.callSid || "default";
  const userText = req.body.SpeechResult || "";

  console.log(`[${callSid}] Usuario dijo: "${userText}"`);

  if (!conversationHistory[callSid]) {
    conversationHistory[callSid] = [];
  }

  let botReply = "Disculpa, no te escuche bien. Puedes repetir tu pregunta?";

  if (userText) {
    conversationHistory[callSid].push({ role: "user", content: userText });

    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 300,
          system: BANCO_INFO,
          messages: conversationHistory[callSid],
        }),
      });

      const data = await claudeRes.json();
      botReply = data.content?.[0]?.text || botReply;

      conversationHistory[callSid].push({
        role: "assistant",
        content: botReply,
      });

      console.log(`[${callSid}] Claude respondio: "${botReply}"`);
    } catch (err) {
      console.error("Error llamando a Claude:", err.message);
      botReply = "Tuve un problema tecnico, por favor intenta de nuevo.";
    }
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Mia-Neural" language="es-MX">${botReply}</Say>
  <Gather input="speech" action="https://${req.headers.host}/responder?callSid=${callSid}" method="POST" language="es-MX" speechTimeout="auto" timeout="5">
    <Say voice="Polly.Mia-Neural" language="es-MX">Tienes alguna otra pregunta?</Say>
  </Gather>
</Response>`;

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Banco de Sangre Vida+ - Servidor activo en puerto ${PORT}`);
});
