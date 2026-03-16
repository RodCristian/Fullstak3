# NavyCare Scheduler MVP2

MVP full-stack para gestionar el flujo mas importante de una clinica o centro medico: reserva publica, ticketing interno, portal administrativo, portal medico, cierre de atencion y notificaciones operativas.

`MVP2` es una evolucion mas madura que `MVP1`. La idea ya no es solo demostrar pantallas, sino dejar una demo operativa que permita mostrar:

1. reserva real de una cita,
2. persistencia local,
3. correos con trazabilidad,
4. intento real de sincronizacion con Google Calendar,
5. acceso interno con roles para admin y medico.

## Que quiere hacer este MVP

El flujo pensado es este:

1. Un paciente agenda una cita desde la portada publica.
2. El sistema crea o reutiliza al paciente por correo.
3. Se guarda la cita en base de datos.
4. Se crean tickets internos para administracion y medico.
5. Si SMTP esta listo, se envian correos reales.
6. Si Google Calendar esta listo, se crea un evento real y se guarda su enlace.
7. El medico entra a su portal, completa la ficha y cierra la atencion.
8. El paciente recibe el resumen clinico por correo.

## Estado real del proyecto

### Funciona hoy

- Reserva publica de citas.
- Validacion de solapamiento por medico y horario.
- Persistencia en H2 sobre archivo local.
- Dashboard publico con estado operativo.
- Portal admin protegido con Basic Auth.
- Portal medico protegido con Basic Auth.
- Tickets internos para admin y medico.
- Registro de notificaciones con estado `SENT`, `SKIPPED` o `FAILED`.
- Envio de resumen medico al paciente cuando el medico cierra la cita.
- Integracion real con Google Calendar via service account cuando esta bien configurada.

### Requiere configuracion externa

- Gmail o cualquier SMTP compatible.
- Google Calendar API y archivo JSON de service account.

### Limites actuales

- No existe portal autenticado para pacientes.
- No hay recuperacion de password ni gestion real de usuarios finales.
- Si una cita cambia o se cancela, no se sincroniza el evento en Google Calendar.
- No hay reintentos en background para correo ni calendario.
- No se generan archivos adjuntos, PDF ni enlaces de Google Meet.
- La reserva publica no requiere login.

## Diferencias importantes vs MVP1

- `MVP2` si tiene Basic Auth para rutas internas.
- `MVP2` usa H2 en archivo, por lo que la data persiste entre reinicios.
- `MVP2` guarda trazabilidad de correos en `NotificationLog`.
- `MVP2` si intenta crear el evento real en Google Calendar.
- `MVP1` solo guarda un ID simulado para Calendar.

## Stack tecnico

### Backend

- Java 17
- Spring Boot
- Spring Web
- Spring Data JPA
- Spring Security
- Spring Mail
- H2

### Frontend

- React 19
- TypeScript
- Vite 8

## Estructura del repo

```text
MVP2/
|-- backend/
|   |-- .env.example
|   |-- .env.local        # gitignored, solo para tu maquina
|   |-- start-local.ps1
|   `-- src/
|-- frontend/
|   `-- src/
`-- README.md
```

## Seguridad y acceso

### Rutas publicas

- `GET /api/public/doctors`
- `GET /api/public/overview`
- `POST /api/public/appointments`

### Rutas protegidas

- `GET /api/auth/me`
- `GET /api/admin/dashboard`
- `GET /api/doctor/dashboard`
- `POST /api/doctor/appointments/{appointmentId}/report`

### Como se protege

- Se usa HTTP Basic Auth.
- Las rutas `/api/admin/**` requieren rol `ADMIN`.
- Las rutas `/api/doctor/**` requieren rol `DOCTOR`.
- La portada publica y la reserva quedan abiertas.

## Credenciales demo

Se crean automaticamente al iniciar el backend si la base esta vacia.

### Admin

- `admin@navycare.local`
- `Admin123!`

### Medico

- cualquier correo seed de doctor
- `Doctor123!`

Ejemplos:

- `valentina.rojas@navycare.local`
- `tomas.fuentes@navycare.local`
- `camila.soto@navycare.local`

## Base de datos

- Motor: H2 en archivo local.
- URL: `jdbc:h2:file:./data/medicare-db;AUTO_SERVER=TRUE`
- La data queda en `backend/data/`.
- `backend/data/` esta en `.gitignore`, por lo que no deberia subirse a GitHub.

## Como levantar el proyecto

### Requisitos

- Java 17 o superior
- Node.js 18 o superior
- npm

### 1. Preparar variables locales

Desde `backend/`, copia el ejemplo si hace falta:

```powershell
Copy-Item .env.example .env.local
```

`backend/.env.local` esta gitignored y es donde debes poner tus credenciales reales si quieres probar correo o Calendar.

### 2. Levantar backend

Opcion recomendada en Windows:

```powershell
cd backend
.\start-local.ps1
```

Ese script:

- carga variables desde `.env.local`,
- avisa si Gmail esta deshabilitado o incompleto,
- levanta Spring Boot con el perfil `local`.

Opcion alternativa:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

### 3. Levantar frontend

```powershell
cd frontend
npm install
npm run dev
```

### 4. URLs utiles

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- H2 Console: `http://localhost:8080/h2-console`

## Gmail / SMTP: que hace y que falta

### Lo que si hace hoy

Si SMTP esta bien configurado, el backend puede enviar correos reales para:

- confirmacion de la cita al paciente,
- ticket al administrador,
- ticket al medico,
- resumen medico al paciente al cerrar la consulta.

Ademas, cada intento queda registrado en `NotificationLog` con su estado.

### Variables necesarias

En `backend/.env.local`:

```env
APP_MAIL_ENABLED=true
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=tu_correo@gmail.com
MAIL_PASSWORD=tu_app_password_de_16_caracteres
MAIL_SMTP_AUTH=true
MAIL_SMTP_STARTTLS=true
APP_MAIL_FROM=tu_correo@gmail.com
APP_ADMIN_EMAIL=admin@navycare.local
```

### Requisitos reales para Gmail

Para que funcione con Gmail necesitas:

1. una cuenta Gmail,
2. verificacion en dos pasos activada,
3. una App Password de 16 caracteres,
4. usar esa App Password en `MAIL_PASSWORD`.

### Comportamiento si falta algo

- Si `APP_MAIL_ENABLED=false`, el sistema no intenta enviar y guarda `SKIPPED`.
- Si activas el mail pero faltan `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD` o `APP_MAIL_FROM`, tambien guarda `SKIPPED`.
- Si las variables estan completas pero SMTP falla, guarda `FAILED`.
- La reserva sigue existiendo aunque el correo no salga.

### Lo que no hace todavia

- No hay cola de reintentos.
- No hay templates versionados por negocio.
- No hay adjuntos, PDF ni ICS.
- No hay correos automaticos por cancelacion o reprogramacion.

## Google Calendar: que hace y que falta

### Lo que si hace hoy

La clase `GoogleCalendarService`:

- toma un JSON de service account,
- obtiene un access token,
- llama por REST a Google Calendar API,
- crea un evento real,
- agrega al paciente como `attendee`,
- guarda `calendarEventId` y `calendarHtmlLink` si la creacion fue exitosa.

Si falla algo, la cita igual se crea y el resultado queda marcado como `SKIPPED`.

### Variables necesarias

En `backend/.env.local`:

```env
APP_GOOGLE_CALENDAR_ENABLED=true
APP_GOOGLE_CALENDAR_ID=tu_calendar_id@group.calendar.google.com
APP_GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_PATH=C:\ruta\segura\service-account.json
APP_GOOGLE_CALENDAR_TIMEZONE=America/Santiago
```

### Requisitos reales para que funcione de verdad

No basta con prender la bandera. Necesitas completar todo esto:

1. Crear un proyecto en Google Cloud.
2. Habilitar Google Calendar API.
3. Crear una service account.
4. Descargar su archivo JSON.
5. Guardar ese JSON fuera del repo.
6. Compartir el calendario destino con el correo de la service account.
7. Darle permisos para crear y editar eventos.
8. Configurar `APP_GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_PATH` con una ruta que exista de verdad.
9. Configurar `APP_GOOGLE_CALENDAR_ID` con el ID del calendario compartido.

### Recomendacion importante

No confies en `APP_GOOGLE_CALENDAR_ID=primary` para una demo compartida. Con service accounts suele ser mucho mas seguro usar el ID de un calendario dedicado y compartido explicitamente con esa cuenta de servicio.

### Comportamiento si falta algo

- Si `APP_GOOGLE_CALENDAR_ENABLED=false`, el sistema responde que Calendar esta deshabilitado.
- Si falta la ruta al JSON, responde `SKIPPED`.
- Si la ruta no existe, responde `SKIPPED`.
- Si Google rechaza la llamada, responde `SKIPPED`.
- La reserva igual queda persistida aunque el evento no se cree.

### Lo que no hace todavia

- No actualiza el evento si cambia la hora.
- No elimina el evento si cancelas la cita.
- No crea enlaces Meet.
- No tiene cola de reintentos ni alertas operativas de sincronizacion.
- No hay soporte multi-clinica o multi-calendar.

## Variables utiles

### Backend

- `SERVER_PORT`
- `APP_MAIL_ENABLED`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `MAIL_SMTP_AUTH`
- `MAIL_SMTP_STARTTLS`
- `APP_MAIL_FROM`
- `APP_ADMIN_EMAIL`
- `APP_GOOGLE_CALENDAR_ENABLED`
- `APP_GOOGLE_CALENDAR_ID`
- `APP_GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_PATH`
- `APP_GOOGLE_CALENDAR_TIMEZONE`
- `APP_ADMIN_USER`
- `APP_ADMIN_PASSWORD`
- `APP_DOCTOR_PASSWORD`

## Datos seed

Al iniciar con base vacia se crean:

- 5 doctores
- 1 cuenta admin
- 1 cuenta de staff por cada doctor

No se siembran citas automaticamente; la app esta pensada para que la demo parta desde la primera reserva real hecha desde el frontend.

## Que deberia subir o no subir a GitHub

### Si deberias subir

- codigo fuente,
- `backend/.env.example`,
- este README.

### No deberias subir

- `backend/.env.local`,
- el JSON de service account,
- contrasenas reales,
- `backend/data/`,
- `frontend/node_modules/`,
- `backend/target/`.

## Resumen honesto del alcance

`MVP2` ya es una demo bastante presentable para mostrar operacion de agenda medica end-to-end:

- reserva publica,
- panel interno con roles,
- correo con trazabilidad,
- Google Calendar real si completas la configuracion,
- cierre de atencion y resumen post consulta.

Lo que todavia falta para una version mas cercana a produccion es principalmente:

- manejo de cambios y cancelaciones,
- automatizaciones robustas de correo y calendario,
- autenticacion mas completa,
- observabilidad y reintentos,
- separacion de ambientes y secretos.
