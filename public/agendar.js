// ============================================
// FORMULARIO DE RESERVA
// ============================================

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

if (formReserva && fechaInput && horaSelect) {

  const hoy = new Date().toISOString().split('T')[0];
  fechaInput.setAttribute('min', hoy);

  fechaInput.addEventListener("change", async function() {
    const fecha = fechaInput.value;

    if (!fecha) {
      horaSelect.innerHTML = `<option value="">Selecciona una fecha primero</option>`;
      return;
    }

    horaSelect.innerHTML = `<option value="">Cargando horas...</option>`;
    horaSelect.disabled = true;

    try {
      const respuesta = await fetch(`/horas-ocupadas?fecha=${fecha}`);

      if (!respuesta.ok) throw new Error('Error al cargar horas');

      const horasOcupadas = await respuesta.json();

      horaSelect.innerHTML = `<option value="">Selecciona una hora</option>`;

      todasLasHoras.forEach((hora) => {
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

      horaSelect.disabled = false;

    } catch (error) {
      console.error('Error:', error);
      horaSelect.innerHTML = `<option value="">Error al cargar horas</option>`;
      horaSelect.disabled = true;
    }
  });

  function validarFormulario(reserva) {
    if (!reserva.nombre.trim())
      return { valido: false, mensaje: "Por favor, ingresa tu nombre" };
    if (!reserva.servicio)
      return { valido: false, mensaje: "Por favor, selecciona un servicio" };
    if (!reserva.telefono.trim())
      return { valido: false, mensaje: "Por favor, ingresa tu teléfono" };
    if (!/^[0-9]{9}$/.test(reserva.telefono.replace(/\D/g, '')))
      return { valido: false, mensaje: "Por favor, ingresa un teléfono válido (9 dígitos)" };
    if (!reserva.fecha)
      return { valido: false, mensaje: "Por favor, selecciona una fecha" };
    if (!reserva.hora)
      return { valido: false, mensaje: "Por favor, selecciona una hora" };
    return { valido: true, mensaje: "" };
  }

  function mostrarMensaje(mensaje, tipo = "error") {
    mensajeReserva.textContent = "";
    mensajeReserva.className = `mensaje-${tipo}`;

    if (tipo === "cargando") {
      const loader = document.createElement("span");
      loader.className = "loader";
      mensajeReserva.appendChild(loader);
      mensajeReserva.appendChild(document.createTextNode(mensaje));
    } else {
      mensajeReserva.textContent = mensaje;
    }

    if (tipo === "exito") {
      setTimeout(() => {
        mensajeReserva.textContent = "";
        mensajeReserva.className = "";
      }, 3000);
    }
  }

  formReserva.addEventListener("submit", async function(event) {
    event.preventDefault();

    const reserva = {
      nombre: document.getElementById("nombre").value.trim(),
      servicio: document.getElementById("servicio").value,
      telefono: document.getElementById("telefono").value.trim(),
      fecha: document.getElementById("fecha").value,
      hora: document.getElementById("hora").value,
      comentario: document.getElementById("comentario").value.trim()
    };

    const validacion = validarFormulario(reserva);
    if (!validacion.valido) {
      mostrarMensaje(validacion.mensaje, "error");
      return;
    }

    mostrarMensaje("Procesando tu reserva...", "cargando");

    try {
      const respuesta = await fetch("/crear-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reserva)
      });

      if (!respuesta.ok) throw new Error(`Error HTTP: ${respuesta.status}`);

      const data = await respuesta.json();

      if (data.error) {
        mostrarMensaje(data.mensaje || "Error al procesar la reserva", "error");
        return;
      }

      if (data.payment_url) {
        mostrarMensaje(data.mensaje || "Redirigiendo al pago del anticipo...", "exito");
        setTimeout(() => {
          window.location.href = data.payment_url;
        }, 800);
        return;
      }

      mostrarMensaje(data.mensaje || "¡Reserva confirmada!", "exito");
      formReserva.reset();
      horaSelect.innerHTML = `<option value="">Selecciona una hora</option>`;

    } catch (error) {
      console.error('Error:', error);
      mostrarMensaje("Error al conectar con el servidor. Intenta nuevamente.", "error");
    }
  });

  const nombreInput = document.getElementById("nombre");
  if (nombreInput) {
    nombreInput.addEventListener("input", () => {
      if (mensajeReserva.className.includes("error")) {
        mensajeReserva.textContent = "";
        mensajeReserva.className = "";
      }
    });
  }
}
