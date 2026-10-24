// ============================================
// FORMULARIO DE RESERVA
// ============================================

const formReserva = document.getElementById("formReserva");
const mensajeReserva = document.getElementById("mensajeReserva");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");

// Las horas las habilita la administradora desde el panel:
// el servidor solo devuelve las habilitadas que siguen libres.

function fechaLocalHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nombreCortoDia(fecha) {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short"
  });
}

if (formReserva && fechaInput && horaSelect) {

  fechaInput.setAttribute('min', fechaLocalHoy());

  async function cargarHoras() {
    const fecha = fechaInput.value;
    marcarDiaElegido(fecha);

    if (!fecha) {
      horaSelect.innerHTML = `<option value="">Elige una fecha primero</option>`;
      horaSelect.disabled = true;
      return;
    }

    horaSelect.innerHTML = `<option value="">Cargando horas...</option>`;
    horaSelect.disabled = true;

    try {
      const respuesta = await fetch(`/horas-disponibles?fecha=${encodeURIComponent(fecha)}`);
      if (!respuesta.ok) throw new Error('Error al cargar horas');

      const horas = await respuesta.json();

      if (!horas.length) {
        horaSelect.innerHTML = `<option value="">Sin horas este día, elige otro</option>`;
        return;
      }

      horaSelect.innerHTML = `<option value="">Selecciona una hora</option>`;
      horas.forEach((hora) => {
        const option = document.createElement("option");
        option.value = hora;
        option.textContent = hora;
        horaSelect.appendChild(option);
      });
      horaSelect.disabled = false;

    } catch (error) {
      console.error('Error:', error);
      horaSelect.innerHTML = `<option value="">Error al cargar horas</option>`;
    }
  }

  fechaInput.addEventListener("change", cargarHoras);

  // atajos: proximos dias que tienen horas habilitadas
  const diasCaja = document.getElementById("diasDisponibles");
  const diasLista = document.getElementById("diasLista");

  function marcarDiaElegido(fecha) {
    if (!diasLista) return;
    diasLista.querySelectorAll("button").forEach(b => {
      b.classList.toggle("activo", b.dataset.fecha === fecha);
    });
  }

  async function cargarDias() {
    if (!diasCaja || !diasLista) return;
    try {
      const respuesta = await fetch("/dias-disponibles");
      if (!respuesta.ok) return;
      const dias = (await respuesta.json()).slice(0, 12);

      diasLista.innerHTML = "";
      if (!dias.length) {
        diasLista.innerHTML = `<p class="dias-vacio">Por ahora no hay horas abiertas. Escríbenos por WhatsApp y te avisamos.</p>`;
      }
      dias.forEach(fecha => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.fecha = fecha;
        b.textContent = nombreCortoDia(fecha);
        b.addEventListener("click", () => {
          fechaInput.value = fecha;
          cargarHoras();
        });
        diasLista.appendChild(b);
      });
      diasCaja.hidden = false;
      marcarDiaElegido(fechaInput.value);
    } catch (error) {
      console.error("Error cargando días:", error);
    }
  }

  cargarDias();

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
      cargarHoras();
      cargarDias();

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
