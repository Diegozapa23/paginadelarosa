require('dotenv').config();

console.log("=== VARIABLES DE ENTORNO ===");

console.log("============================");

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

// ============================================
// CONFIGURACIÓN KHIPU
// ============================================

const KHIPU_API_KEY = process.env.KHIPU_API_KEY;
const KHIPU_SECRET = process.env.KHIPU_SECRET;
const ANTICIPO_MONTO = Number(process.env.ANTICIPO_MONTO) || 5000;

const KHIPU_API = "https://payment-api.khipu.com/v3";
const urlBase = (process.env.SITIO_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");

// ============================================
// PROTECCIÓN PANEL ADMIN
// ============================================

function authAdmin(req, res, next) {
  const auth = req.headers['authorization'];

  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Beauty Studio"');
    return res.status(401).send('Acceso no autorizado');
  }

  const base64 = auth.split(' ')[1];
  const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');

  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Beauty Studio"');
  return res.status(401).send('Usuario o contraseña incorrectos');
}

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors());
app.use(compression());
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf.toString("utf8"); }
}));
app.use(express.urlencoded({ extended: true }));

// Archivos estaticos
// - /img y /fonts: inmutables (el nombre cambia cuando cambia el contenido)
// - videos e iconos: inmutables
// - html/css/js: se revalidan siempre (max-age=0) para que un deploy se vea al instante
const PUBLIC_DIR = path.join(__dirname, "public");
const INMUTABLE = { maxAge: "365d", immutable: true };
const ES_ESTATICO = /\.(webm|mp4|png|jpe?g|webp|gif|svg|ico|woff2?)$/i;

app.use("/img", express.static(path.join(PUBLIC_DIR, "img"), INMUTABLE));
app.use("/fonts", express.static(path.join(PUBLIC_DIR, "fonts"), INMUTABLE));
app.use(express.static(PUBLIC_DIR, {
  index: 'uno.html',
  maxAge: 0,
  setHeaders(res, filePath) {
    if (ES_ESTATICO.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "no-cache");
    }
  }
}));

// ============================================
// HELPERS
// ============================================

const HORAS_DISPONIBLES = ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00"];

function validarReserva(reserva) {
  if (!reserva || typeof reserva !== "object") {
    return "Datos de reserva inválidos";
  }

  if (!reserva.nombre || !String(reserva.nombre).trim()) {
    return "Por favor, ingresa tu nombre";
  }

  const telefono = String(reserva.telefono || "").replace(/\D/g, "");
  if (!/^[0-9]{9}$/.test(telefono)) {
    return "Por favor, ingresa un teléfono válido (9 dígitos)";
  }

  if (!reserva.servicio || !String(reserva.servicio).trim()) {
    return "Por favor, selecciona un servicio";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(reserva.fecha || "")) {
    return "Por favor, selecciona una fecha válida";
  }

  const hoyLocal = new Date();
  const hoy = [
    hoyLocal.getFullYear(),
    String(hoyLocal.getMonth() + 1).padStart(2, "0"),
    String(hoyLocal.getDate()).padStart(2, "0")
  ].join("-");

  if (reserva.fecha < hoy) {
    return "No puedes reservar para una fecha pasada";
  }

  if (!HORAS_DISPONIBLES.includes(reserva.hora)) {
    return "Por favor, selecciona una hora válida";
  }

  return null;
}

const DATABASE_URL = process.env.DATABASE_URL;

// ruta ABSOLUTA del archivo de reservas (en un hosting el cwd puede cambiar)
const ARCHIVO_RESERVAS = path.join(__dirname, "reservas.json");

let pool = null;
if (DATABASE_URL) {
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  // Neon apaga la base tras 5 min sin uso: si se cae una conexion suelta,
  // sin este handler el proceso muere. Con el handler, pg reconecta solo.
  pool.on('error', (err) => {
    console.log("AVISO Postgres (se reconecta solo):", err.message);
  });
}

function usarBaseDeDatos() {
  return pool !== null;
}

async function iniciarBaseDeDatos() {
  if (!usarBaseDeDatos()) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservas (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
}

async function leerReservas() {
  if (usarBaseDeDatos()) {
    const resultado = await pool.query("SELECT data FROM reservas");
    return resultado.rows.map(r => r.data);
  }

  if (!fs.existsSync(ARCHIVO_RESERVAS)) {
    fs.writeFileSync(ARCHIVO_RESERVAS, "[]");
  }
  const contenido = fs.readFileSync(ARCHIVO_RESERVAS, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(contenido);
}

async function guardarReservas(reservas) {
  if (usarBaseDeDatos()) {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query("DELETE FROM reservas");
      for (const r of reservas) {
        if (!r.id) {
          r.id = `reserva_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }
        await cliente.query(
          "INSERT INTO reservas (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
          [String(r.id), JSON.stringify(r)]
        );
      }
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
    return;
  }

  fs.writeFileSync(ARCHIVO_RESERVAS, JSON.stringify(reservas, null, 2));
}

// ============================================
// HEALTH CHECK (Render / Railway / VPS)
// ============================================

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    base: usarBaseDeDatos() ? "postgres" : "archivo",
    pagos: urlPublicaValida(urlBase) ? "activos" : "inactivos",
    hora: new Date().toISOString()
  });
});

// ============================================
// HELPERS KHIPU
// ============================================

// Khipu exige URLs publicas HTTPS: rechaza localhost, 127.0.0.1 y IPs privadas
function urlPublicaValida(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host.endsWith(".local") || host.endsWith(".localhost")) return false;
    return true;
  } catch (e) {
    return false;
  }
}

async function crearCobroKhipu(reserva) {
  const body = {
    amount: ANTICIPO_MONTO,
    currency: "CLP",
    subject: `Anticipo reserva ${reserva.servicio}`,
    body: `${reserva.nombre} - ${reserva.fecha} ${reserva.hora}`,
    transaction_id: reserva.id,
    return_url: `${urlBase}/confirmacion.html?reserva=${reserva.id}`,
    cancel_url: `${urlBase}/agenda.html`,
    notify_url: `${urlBase}/webhook/khipu`,
    notify_api_version: "3.0"
  };

  // cuenta receptora explicita (si esta configurada)
  if (process.env.KHIPU_RECEIVER_ID) {
    body.receiver_id = process.env.KHIPU_RECEIVER_ID;
  }

  const respuesta = await fetch(`${KHIPU_API}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": KHIPU_API_KEY
    },
    body: JSON.stringify(body)
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    const detalle = (data && data.errors && data.errors.length)
      ? data.errors.map(e => `${e.field}: ${e.message}`).join(" | ")
      : (data && data.message) || JSON.stringify(data);
    throw new Error(`Khipu error ${respuesta.status}: ${detalle}`);
  }

  return data;
}

function verificarFirmaKhipu(req) {
  const header = req.headers["x-khipu-signature"] || "";
  if (!header) return false;

  const partes = {};
  header.split(",").forEach(p => {
    const idx = p.indexOf("=");
    if (idx !== -1) {
      partes[p.slice(0, idx)] = p.slice(idx + 1);
    }
  });

  const t = partes["t"];
  const s = partes["s"];
  if (!t || !s) return false;

  const toSign = `${t}.${req.rawBody}`;
  const firmaEsperada = crypto
    .createHmac("sha256", KHIPU_SECRET)
    .update(toSign)
    .digest("base64");

  if (firmaEsperada.length !== s.length) return false;

  return crypto.timingSafeEqual(Buffer.from(firmaEsperada), Buffer.from(s));
}

// ============================================
// RATE LIMITING (protección básica)
// ============================================

function crearRateLimiter({ ventanaMs, max }) {
  const intentos = new Map();

  return function limitar(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || "desconocido";
    const ahora = Date.now();
    const lista = (intentos.get(ip) || []).filter(t => ahora - t < ventanaMs);

    if (lista.length >= max) {
      return res.status(429).json({ error: true, mensaje: "Demasiados intentos. Intenta nuevamente más tarde." });
    }

    lista.push(ahora);
    intentos.set(ip, lista);
    next();
  };
}

const limitarLogin = crearRateLimiter({ ventanaMs: 10 * 60 * 1000, max: 5 });
const limitarCrearPago = crearRateLimiter({ ventanaMs: 60 * 1000, max: 10 });

// ============================================
// RUTAS
// ============================================

app.post("/crear-pago", limitarCrearPago, async (req, res) => {
  try {
    const reserva = req.body;

    const errorValidacion = validarReserva(reserva);
    if (errorValidacion) {
      return res.json({ error: true, mensaje: errorValidacion });
    }

    const telefono = String(reserva.telefono).replace(/\D/g, "");

    const reservas = await leerReservas();

    const existe = reservas.find(r =>
      r.fecha === reserva.fecha &&
      r.hora === reserva.hora
    );

    if (existe) {
      return res.json({ error: true, mensaje: "Esa hora ya está ocupada." });
    }

    const id = Date.now().toString();

    const nuevaReserva = {
      id,
      nombre: String(reserva.nombre).trim(),
      telefono,
      servicio: reserva.servicio,
      fecha: reserva.fecha,
      hora: reserva.hora,
      comentario: String(reserva.comentario || "").trim(),
      pagado: false,
      estado: "pendiente_pago",
      metodoReserva: "Página web",
      fechaReserva: new Date().toISOString()
    };

    let cobro;
    try {
      // Khipu no acepta URLs locales: se falla antes de gastar una llamada
      if (!urlPublicaValida(urlBase)) {
        console.log(`ERROR Khipu: SITIO_URL no apunta a una URL publica (actual: ${urlBase})`);
        return res.status(503).json({
          error: true,
          mensaje: "Los pagos en linea no estan disponibles todavia. Escribenos por WhatsApp y te reservamos al instante."
        });
      }
      cobro = await crearCobroKhipu(nuevaReserva);
    } catch (error) {
      console.log("ERROR creando cobro Khipu:", error.message);
      return res.status(502).json({ error: true, mensaje: "No se pudo generar el pago. Intenta nuevamente en unos momentos." });
    }

    nuevaReserva.payment_id = cobro.payment_id;
    nuevaReserva.payment_url = cobro.payment_url;

    reservas.push(nuevaReserva);
    await guardarReservas(reservas);

    res.json({
      ok: true,
      mensaje: "Completa el pago del anticipo para confirmar tu reserva.",
      payment_url: cobro.payment_url,
      reserva_id: id
    });

  } catch (error) {
    console.log("ERROR /crear-pago:", error);
    res.status(500).json({ error: true, mensaje: "Error al crear la reserva" });
  }
});

app.get("/horas-ocupadas", async (req, res) => {
  const fecha = req.query.fecha;
  const reservas = await leerReservas();
  const horasOcupadas = reservas.filter(r => r.fecha === fecha).map(r => r.hora);
  res.json(horasOcupadas);
});

app.post("/webhook/khipu", async (req, res) => {
  try {
    if (!verificarFirmaKhipu(req)) {
      return res.status(400).json({ error: true, mensaje: "Firma inválida" });
    }

    const evento = JSON.parse(req.rawBody);

    if (!evento.transaction_id) {
      return res.status(400).json({ error: true, mensaje: "transaction_id requerido" });
    }

    const reservas = await leerReservas();
    const idx = reservas.findIndex(r => String(r.id) === String(evento.transaction_id));

    if (idx !== -1 && !reservas[idx].pagado) {
      reservas[idx].pagado = true;
      reservas[idx].estado = "pagado";
      reservas[idx].payment_id = evento.payment_id || reservas[idx].payment_id;
      reservas[idx].conciliation_date = evento.conciliation_date || null;
      reservas[idx].fechaPago = new Date().toISOString();
      await guardarReservas(reservas);
      console.log(`✅ Pago confirmado para reserva ${evento.transaction_id}`);
    }

    res.status(200).json({ ok: true });

  } catch (error) {
    console.log("ERROR webhook Khipu:", error);
    res.status(500).json({ error: true, mensaje: "Error procesando notificación" });
  }
});

app.get("/estado-reserva/:id", async (req, res) => {
  const id = String(req.params.id);
  const reservas = await leerReservas();
  const reserva = reservas.find(r => String(r.id) === id);

  if (!reserva) {
    return res.json({ error: true, mensaje: "Reserva no encontrada" });
  }

  res.json({
    id: reserva.id,
    pagado: reserva.pagado,
    estado: reserva.estado || (reserva.pagado ? "pagado" : "pendiente"),
    servicio: reserva.servicio,
    fecha: reserva.fecha,
    hora: reserva.hora,
    nombre: reserva.nombre
  });
});

app.post("/admin-login", limitarLogin, (req, res) => {
  const { usuario, clave } = req.body;
  if (usuario === process.env.ADMIN_USER && clave === process.env.ADMIN_PASS) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false });
});

app.get("/reservas", authAdmin, async (req, res) => {
  let reservas = await leerReservas();
  let cambio = false;

  reservas = reservas.map((r, index) => {
    if (!r.id) {
      cambio = true;
      return { id: Date.now().toString() + index, ...r };
    }
    return r;
  });

  if (cambio) await guardarReservas(reservas);
  res.json(reservas);
});

app.delete("/eliminar-reserva/:id", authAdmin, async (req, res) => {
  const id = String(req.params.id);
  let reservas = await leerReservas();
  reservas = reservas.filter(r => String(r.id) !== id);
  await guardarReservas(reservas);
  res.json({ mensaje: "Reserva eliminada" });
});

app.put("/editar-reserva/:id", authAdmin, async (req, res) => {
  const id = String(req.params.id);
  const datos = req.body;
  let reservas = await leerReservas();

  reservas = reservas.map(r => {
    if (String(r.id) === id) return { ...r, ...datos };
    return r;
  });

  await guardarReservas(reservas);
  res.json({ mensaje: "Reserva editada" });
});

app.post("/agregar-reserva", authAdmin, async (req, res) => {
  const nuevaReserva = {
    id: Date.now().toString(),
    ...req.body,
    pagado: req.body.pagado || false
  };

  const reservas = await leerReservas();
  reservas.push(nuevaReserva);
  await guardarReservas(reservas);
  res.json({ mensaje: "Reserva agregada correctamente" });
});

// ============================================
// AUTO-BORRAR RESERVAS PASADAS
// ============================================

async function limpiarReservasPasadas() {
  const hoy = new Date().toISOString().split('T')[0];
  let reservas = await leerReservas();
  const antes = reservas.length;
  reservas = reservas.filter(r => r.fecha >= hoy);
  if (reservas.length !== antes) {
    await guardarReservas(reservas);
    console.log(`🧹 Reservas eliminadas: ${antes - reservas.length}`);
  }
}

// Ejecutar al arrancar y cada 24 horas
(async () => {
  try {
    await iniciarBaseDeDatos();
  } catch (error) {
    console.log("ERROR inicializando base de datos:", error.message);
  }

  limpiarReservasPasadas().catch(error => {
    console.log("ERROR limpiando reservas:", error.message);
  });
})();
setInterval(() => limpiarReservasPasadas().catch(error => {
  console.log("ERROR limpiando reservas:", error.message);
}), 24 * 60 * 60 * 1000);

  app.listen(process.env.PORT || 3000, () => {
    console.log(`Servidor funcionando en puerto ${process.env.PORT || 3000}`);
    if (usarBaseDeDatos()) {
      console.log("Reservas: PostgreSQL (persistente)");
    } else {
      console.log("Reservas: archivo reservas.json (LOCAL, se pierde al reiniciar)");
      console.log("          -> configura DATABASE_URL si el disco es efimero (Render gratis)");
    }
    if (urlPublicaValida(urlBase)) {
      console.log(`Pagos Khipu: activos (${urlBase})`);
    } else {
      console.log("Pagos Khipu: INACTIVOS -> define SITIO_URL con tu dominio publico https://");
      console.log("               (Khipu rechaza URLs locales en el webhook)");
    }
  });
