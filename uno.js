const formReserva = document.getElementById("formReserva");
const mensajeReserva = document.getElementById("mensajeReserva");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");

const todasLasHoras = [
    "10:00",
    "11:00",
    "12:00",
    "15:00",
    "16:00",
    "17:00"
];

fechaInput.addEventListener("change", async function() {
    const fecha = fechaInput.value;

    horaSelect.innerHTML = `<option value="">Cargando horas...</option>`;

    const respuesta = await fetch(`http://localhost:3000/horas-ocupadas?fecha=${fecha}`);
    const horasOcupadas = await respuesta.json();

    horaSelect.innerHTML = `<option value="">Hora</option>`;

    todasLasHoras.forEach(hora => {
        if (!horasOcupadas.includes(hora)) {
            const option = document.createElement("option");
            option.value = hora;
            option.textContent = hora;
            horaSelect.appendChild(option);
        }
    });

    if (horaSelect.options.length === 1) {
        horaSelect.innerHTML = `<option value="">No hay horas disponibles</option>`;
    }
});

formReserva.addEventListener("submit", async function(event) {
    event.preventDefault();

    const reserva = {
        nombre: document.getElementById("nombre").value,
        servicio: document.getElementById("servicio").value,
        telefono: document.getElementById("telefono").value,
        fecha: document.getElementById("fecha").value,
        hora: document.getElementById("hora").value,
        comentario: document.getElementById("comentario").value
    };

    mensajeReserva.textContent = "Conectando con Webpay...";

    try {
        const respuesta = await fetch("http://localhost:3000/crear-pago", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(reserva)
        });

        const data = await respuesta.json();

        if (data.error) {
            mensajeReserva.textContent = data.mensaje;
            return;
        }

        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.url;

        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "token_ws";
        input.value = data.token;

        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();

    } catch (error) {
        console.log(error);
        mensajeReserva.textContent = "Error al conectar con Webpay.";
    }
});