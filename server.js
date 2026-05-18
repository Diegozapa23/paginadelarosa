const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
const fs = require("fs");

const {
    WebpayPlus,
    Options,
    IntegrationApiKeys,
    IntegrationCommerceCodes,
    Environment
} = require("transbank-sdk");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const reservasPendientes = {};

const tx = new WebpayPlus.Transaction(
    new Options(
        IntegrationCommerceCodes.WEBPAY_PLUS,
        IntegrationApiKeys.WEBPAY,
        Environment.Integration
    )
);

app.post("/crear-pago", async (req, res) => {
    try {
        const reserva = req.body;

        const reservas = JSON.parse(fs.readFileSync("reservas.json", "utf8"));

        const existe = reservas.find(r =>
            r.fecha === reserva.fecha &&
            r.hora === reserva.hora
        );

        if (existe) {
            return res.json({
                error: true,
                mensaje: "Esa hora ya está ocupada."
            });
        }

        const idReserva = Date.now().toString();

        reservasPendientes[idReserva] = reserva;

        const amount = 5000;
        const buyOrder = "orden-" + idReserva;
        const sessionId = "sesion-" + idReserva;
        const returnUrl = "http://localhost:3000/webpay-respuesta";

        const response = await tx.create(
            buyOrder,
            sessionId,
            amount,
            returnUrl
        );

        res.json({
            url: response.url,
            token: response.token,
            idReserva
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            error: true,
            mensaje: "Error al crear pago"
        });
    }
});
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "TU_CORREO@gmail.com",
        pass: "TU_CLAVE_DE_APLICACION"
    }
});

app.post("/webpay-respuesta", async (req, res) => {
    try {
        const token = req.body.token_ws;

        const response = await tx.commit(token);

        const buyOrder = response.buy_order;
        const idReserva = buyOrder.replace("orden-", "");
        const reserva = reservasPendientes[idReserva];

        if (!reserva) {
            return res.send("Reserva pendiente no encontrada.");
        }

        if (response.status === "AUTHORIZED") {
            const reservas = JSON.parse(fs.readFileSync("reservas.json", "utf8"));

            reservas.push({
                id: Date.now().toString(),
                ...reserva,
                pagado: true,
                montoReserva: 5000,
                fechaPago: new Date().toISOString(),
                transactionId: response.authorization_code
            });

            fs.writeFileSync("reservas.json", JSON.stringify(reservas, null, 2));

            delete reservasPendientes[idReserva];

            return res.send(`
                <h1>Pago aprobado ✅</h1>
                <p>Tu hora quedó reservada correctamente.</p>
            `);
        }

        return res.send(`
            <h1>Pago rechazado ❌</h1>
            <p>No se pudo confirmar la reserva.</p>
        `);

    } catch (error) {
        console.log(error);
        res.send("Error procesando Webpay");
    }
});

app.get("/horas-ocupadas", (req, res) => {
    const fecha = req.query.fecha;

    const reservas = JSON.parse(fs.readFileSync("reservas.json", "utf8"));

    const horasOcupadas = reservas
        .filter(r => r.fecha === fecha)
        .map(r => r.hora);

    res.json(horasOcupadas);
});

app.get("/reservas", (req, res) => {
    let reservas = JSON.parse(fs.readFileSync("reservas.json", "utf8"));

    let cambio = false;

    reservas = reservas.map((r, index) => {
        if (!r.id) {
            cambio = true;

            return {
                id: Date.now().toString() + index,
                ...r
            };
        }

        return r;
    });

    if (cambio) {
        fs.writeFileSync("reservas.json", JSON.stringify(reservas, null, 2));
    }

    res.json(reservas);
});

app.delete("/eliminar-reserva/:id", (req, res) => {
    const id = String(req.params.id);

    let reservas = JSON.parse(fs.readFileSync("reservas.json", "utf8"));

    reservas = reservas.filter(r => String(r.id) !== id);

    fs.writeFileSync("reservas.json", JSON.stringify(reservas, null, 2));

    res.json({
        mensaje: "Reserva eliminada"
    });
});

app.put("/editar-reserva/:id", (req, res) => {
    const id = String(req.params.id);
    const datos = req.body;

    let reservas = JSON.parse(fs.readFileSync("reservas.json", "utf8"));

    reservas = reservas.map(r => {
        if (String(r.id) === id) {
            return {
                ...r,
                ...datos
            };
        }

        return r;
    });

    fs.writeFileSync("reservas.json", JSON.stringify(reservas, null, 2));

    res.json({
        mensaje: "Reserva editada"
    });
});
app.post("/agregar-reserva", (req, res) => {
    const nuevaReserva = {
        id: Date.now().toString(),
        ...req.body,
        pagado: req.body.pagado || false
    };

    const reservas = JSON.parse(fs.readFileSync("reservas.json", "utf8"));

    reservas.push(nuevaReserva);

    fs.writeFileSync("reservas.json", JSON.stringify(reservas, null, 2));

    res.json({
        mensaje: "Reserva agregada correctamente"
    });
});

app.listen(3000, () => {
    console.log("Servidor funcionando en puerto 3000");
});