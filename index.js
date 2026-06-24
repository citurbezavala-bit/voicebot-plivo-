const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const conversationHistory = {};

const BANCO_INFO = `
Eres el asistente virtual del Banco de Sangre "Vida+" ubicado en Av. Insurgentes 1234, 
Ciudad de México. Tu trabajo es atender llamadas y responder preguntas.

INFORMACIÓN DEL BANCO:
- Nombre: Banco de Sangre Vida+
- Dirección: Av. Insurgentes Sur 1234, Col. Del Valle, CDMX
- Teléfono: 55 1234 5678
- Horario: Lunes a Viernes 7:00am - 8:00pm, Sábados 8:00am - 2:00pm, Domingos cerrado

TIPOS DE SANGRE DISPONIBLES HOY:
- O+ : URGENTE (reservas bajas)
- O- : URGENTE (reservas muy bajas)
- A+ : Disponible
- A- : Disponible
- B+ : Disponible
- B- : Poca disponibilidad
- AB+: Disponible
- AB-: Poca disponibilidad

REQUISITOS PARA DONAR:
- Tener entre 18 y 65 años
- Pesar más de 50 kg
- Estar en buen estado de salud
- No haber donado sangre en los últimos 3 meses
- No haber consumido alcohol 48 horas antes
- Haber dormido al menos 6 horas
- Presentar identificación oficial vigente
- Ayuno de 4 horas (solo evitar grasas, se puede tomar agua)

CITAS DISPONIBLES HOY:
- 9:00am, 10:30am, 12:00pm, 2:00pm, 4:00pm, 5:30pm

BENEFICIOS DE DONAR:
- Análisis de sangre gratuito
- Refresco y galletas después de donar
- Constancia de donación
- Una donación puede salvar hasta 3 vidas

INSTRUCCIONES:
- Responde en español de México, de forma cálida y motivadora
- Sé muy breve (máximo 2 oraciones) porque tu voz se convierte a audio
- Si alguien quiere agendar cita, pide su nombre y confirma el horario
- Si preguntan por un tipo de sangre urgente, menciona la urgencia con amabilidad
- Sin listas, sin markdown, solo texto natural para hablar
`;

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
    <Say voice="Polly.Mia-Neural" language="es-MX">¿En qué te puedo ayudar?</Say>
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

  let botReply = "Disculpa, no te escuché bien.";

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
