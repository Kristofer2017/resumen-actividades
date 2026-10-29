# Bitácora — Informe de Actividades

Aplicación web para redactar el informe semanal de actividades y exportarlo a PDF o Word (.docx).

- **Backend:** Python + Flask (`app.py`), SQLite (`db.py`), ReportLab/PyMuPDF (`pdf_generator.py`) y python-docx (`docx_generator.py`).
- **Frontend:** React 19 + Vite (`frontend/`), sin framework de UI adicional.
- El backend expone `/api/*`; Flask sirve el build de React desde `frontend/dist`.
- El PDF, la vista previa y el Word se generan siempre en el servidor.

## Estructura

```
app.py                     Rutas Flask y arranque del servidor
db.py                      Persistencia SQLite
pdf_generator.py           Generación del PDF y la vista previa
docx_generator.py          Generación del informe en Word (.docx)
commit_suggestions.py      Lectura de commits y sugerencias para el informe
data/bitacora.db           Base de datos local (no versionada)
.env.example               Ejemplo de configuración de IA y repositorio
static/logo-informe.png    Logo azul usado en el PDF y el Word
static/logo-light-streamline.png  Isotipo blanco del topbar y favicon
frontend/
  src/
    main.jsx               Punto de entrada y parámetros de la URL
    App.jsx                Provider + layout
    api/reportApi.js       Cliente de /api/*
    context/               Contexto del informe (provider + hook)
    hooks/
      useReportEditor.js   Estado y acciones del informe
      useSaveQueue.js      Autoguardado con debounce y envío al cerrar
      usePreview.js        Generación y cola de la vista previa
      useCommitSuggestions.js  Consulta de sugerencias al backend
    components/
      editor/              Encabezado, toolbar, paneles y acciones
      preview/             Panel de vista previa
      suggestions/         Diálogo de revisión de sugerencias
      ui/                  Botón, campo, panel, chip, etc.
    utils/                 Fechas, descargas y etiquetas
    styles/app.css         Estilos de toda la aplicación
```

## Desarrollo

```bat
dev.bat
```

Abre Flask en `http://127.0.0.1:5050` y Vite en `http://localhost:5173` (con proxy de
`/api` y `/static` al backend). Los cambios de React se recargan al instante.

> Si el contenedor de Docker está ocupando el puerto 5050, deténlo antes de usar `dev.bat`.

## Build local

```bat
run.bat
```

Instala dependencias, compila el frontend y sirve todo desde `http://127.0.0.1:5050`.

Manualmente:

```bat
cd frontend
npm install
npm run build
cd ..
python app.py
```

## Docker

```bat
docker compose up --build
```

El `Dockerfile` compila React en una etapa Node y copia `frontend/dist` a la imagen
final de Python. También incluye `git` para leer el repositorio de commits.

El `docker-compose.yml` monta el repositorio `heset` en solo lectura:

```
../heset  ->  /app/repositories/heset
```

## Sugerencias desde commits

El botón **Sugerir** del toolbar lee los commits de la semana seleccionada y abre un
diálogo para revisarlos. Solo se consideran:

- commits del autor configurado (por defecto `user.email` del repositorio `heset`),
- de lunes a viernes de la semana ISO seleccionada,
- sin commits de merge.

El diálogo permite editar cada sugerencia, ver el mensaje original del commit, copiarla,
y aplicarla a los días o al resumen semanal, agregando o reemplazando el texto existente.

Al abrir el diálogo **no se llama a la IA**: solo se leen los commits y se generan
borradores locales. La llamada al servicio de IA se hace únicamente al pulsar
**Redactar con IA** (y **Regenerar con IA** si ya se usó), para evitar consumos
accidentales al revisar la ventana.

La configuración se toma de variables de entorno (o de un archivo `.env`, ver
`.env.example`):

| Variable | Uso |
|---|---|
| `HESET_REPO_PATH` | Ruta del repositorio. Por defecto `../heset` |
| `HESET_AUTHOR_EMAIL` | Correo del autor. Por defecto `git config user.email` |
| `HESET_AUTHOR_NAME` | Nombre mostrado. Por defecto `git config user.name` |
| `HESET_LLM_API_KEY` | Llave de un servicio compatible con OpenAI |
| `HESET_LLM_BASE_URL` | URL base del servicio (por defecto `https://api.openai.com/v1`) |
| `HESET_LLM_MODEL` | Modelo a usar (por defecto `gpt-4o-mini`) |

Para **Gemini (Google AI Studio)** usa el endpoint compatible con OpenAI:

```env
HESET_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
HESET_LLM_MODEL=gemini-3.5-flash-lite
```

`gemini-3.5-flash-lite` es rápido y económico para este caso. Si prefieres
`gemini-3.8-flash`, ten en cuenta que puede responder HTTP 503 cuando Google
reporta alta demanda; en ese caso vuelve a `gemini-3.5-flash-lite`.

El archivo `.env` se carga automáticamente al iniciar la aplicación. En Docker,
`docker compose` toma esas variables y el archivo no se copia dentro de la imagen.
Si el repositorio no está en `../heset`, ajusta el volumen de `docker-compose.yml`
y `HESET_REPO_PATH`.

Sin `HESET_LLM_API_KEY`, la aplicación genera borradores automáticos localmente y el
diálogo lo indica. Con la llave configurada, solo se envían al servicio los mensajes
cortos de los commits del autor (no diffs, archivos ni datos del informe).

## Dónde editar

- **Textos y estructura de la UI:** `frontend/src/components/` (por ejemplo, los botones
  están en `components/editor/ActionsBar.jsx`).
- **Estilos:** `frontend/src/styles/app.css`.
- **Lógica de autoguardado / vista previa:** `frontend/src/hooks/`.
- **Endpoints y lectura de datos:** `app.py` y `db.py`.
- **Contenido y maquetación del PDF:** `pdf_generator.py`.
- **Contenido y maquetación del Word:** `docx_generator.py`.
- **Sugerencias desde commits:** `commit_suggestions.py` y
  `frontend/src/components/suggestions/`.
