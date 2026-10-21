# Crear la base de datos en Neon (gratis)

Neon es un Postgres托管 gratis: 0,5 GB, sin caducidad mientras lo uses.
Es lo que va a guardar las reservas del sitio.

## 1. Crear la cuenta

- Entra en **https://neon.tech**
- `Sign up` → continúa con **GitHub** o Google (más rápido, sin correo)
- Te pide una organización: pon `dellarosa` y dale a `Create`

## 2. Crear el proyecto

Al entrar al panel, en "Projects" clickeas **"Create project"**:

| Campo | Qué poner |
|---|---|
| Project name | `dellarosa` |
| Postgres version | la que te venga por defecto (17) |
| Region | **AWS South America (São Paulo)** ← el más cercano a Chile |
| Cloud provider | AWS |

Le das a **Create project**. En unos segundos tienes el proyecto listo.

> Si no te aparece São Paulo, elige **AWS US East (Ohio)** o **Oregon**.

## 3. Copiar la connection string

Abres el proyecto y te sale un cartel con la conexión. Clickeas **"Connect"**
(o el botón `Connect` arriba a la derecha) y se abre una ventana con dos
opciones:

- **Connection string** → **Connection Pooling: "Pooled"** ← **copia esta**

Se ve así:

```
postgresql://neondb_owner:AbCdEf123456@ep-cool-name-a1b2c3d4-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Guárdala en un bloc de notas, la vas a pegar en Render.

**¿Por qué "Pooled" y no la directa?**
- La directa se corta sola tras 5 minutos sin uso y hay que reconectar.
- La "pooled" (PgBouncer) mantiene la conexión viva y aguanta picos de visitas.
- Además tu plan gratis de Neon tiene límite de conexiones: el pooler te protege.

## 4. (Opcional) Probar que funciona

En la misma ventana de "Connect" hay una pestaña **"Web/MCP"** o puedes
usar el **SQL Editor** de Neon (la pestaña "Neon Console" del panel) y escribir:

```sql
CREATE TABLE IF NOT EXISTS reservas (
  id   TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
```

Esto es opcional: el propio sitio crea la tabla sola al arrancar
(`iniciarBaseDeDatos()` en `server.js`). Pero si lo haces a mano, la ves
creada y confirmas que la base está viva.

## 5. Pegarla en Render

En Render, abre tu servicio → `Environment` → `Add`:

- Key: `DATABASE_URL`
- Value: la connection string completa (con `?sslmode=require&channel_binding=require`)

Guarda. Render reinicia el servicio y en el log deberías ver:

```
Reservas: PostgreSQL (persistente)
Pagos Khipu: activos (https://paginadelarosa.onrender.com)
```

Y en `https://paginadelarosa.onrender.com/health`:
```json
{ "ok": true, "base": "postgres", "pagos": "activos" }
```

## Resumen de lo que necesitas

1. Cuenta en neon.tech (GitHub)
2. Proyecto `dellarosa` en São Paulo
3. Connection string **pooled**
4. Pegarla en Render como `DATABASE_URL`

Sin esto, el sitio funciona igual pero las reservas se guardan en un archivo
que Render borra en cada reinicio.
