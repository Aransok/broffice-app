FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# fonts-dejavu-core provides /usr/share/fonts/truetype/dejavu/DejaVuSans*.ttf
# - common/fonts.py already looks for it there, but nothing ever installed
# it in this image, so the PDF generator was silently falling back to
# Helvetica (no Cyrillic glyphs at all - the actual cause of Cyrillic
# rendering as tofu/boxes in every generated PDF).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
