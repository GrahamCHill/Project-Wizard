FROM python:3.13-slim-bookworm AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/opt/venv/bin:$PATH"
RUN python -m venv /opt/venv

FROM base AS train
WORKDIR /src
RUN pip install --no-cache-dir 'scikit-learn>=1.7,<2' 'skl2onnx>=1.19,<2'
COPY train_sample.py .
RUN python train_sample.py

FROM base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && printf '%s\n' '#!/bin/sh' 'exec python -c "from urllib.request import urlopen; urlopen(\"http://127.0.0.1:8080/healthz\", timeout=2).close()"' > /usr/local/bin/healthcheck \
    && chmod 755 /usr/local/bin/healthcheck
COPY --from=train /src/sample.onnx ./sample.onnx
COPY app.py .
USER 10001:10001
EXPOSE 8080
CMD ["python", "app.py"]
