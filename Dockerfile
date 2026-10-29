FROM node:24-alpine AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FONT_DIR=/usr/share/fonts/truetype/msttcorefonts \
    DEBIAN_FRONTEND=noninteractive

# Liberation Sans es métricamente compatible con Arial y evita montar
# C:/Windows/Fonts, que solo existe en el host de Windows.
RUN apt-get update && apt-get install -y --no-install-recommends \
        fonts-liberation \
        fontconfig \
        git \
        ca-certificates \
    && mkdir -p /usr/share/fonts/truetype/msttcorefonts \
    && ln -sf /usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf \
        /usr/share/fonts/truetype/msttcorefonts/arial.ttf \
    && ln -sf /usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf \
        /usr/share/fonts/truetype/msttcorefonts/arialbd.ttf \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend-build /app/dist ./frontend/dist

EXPOSE 5050

CMD ["python", "app.py"]
