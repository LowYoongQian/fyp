# Whole-repo-context twin of fyp-backend/Dockerfile (Railway builds from the repo
# root; the other one is for `docker build` inside fyp-backend/). Keep them in sync.
#
# Python 3.11 is required, not preferred: tensorflow 2.14 (deepface/ArcFace) ships no
# cp312 wheels, and the first TF with them (2.16) pulls numpy 2.x, which breaks the
# deepface import. Do not bump without re-verifying face embedding extraction.
# -bookworm is pinned explicitly: the bare :3.11-slim tag follows Debian's current
# default and moved to trixie, which splits the tzdata compat aliases out.
FROM python:3.11-slim-bookworm

WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Campus timezone. The app derives offsets from the named zone (utils/timeutil.py), so
# this is a safety net, not the mechanism: it keeps log lines and any stray host-clock
# read in campus time instead of UTC, which is what a container defaults to.
ENV TZ=Asia/Kuala_Lumpur

# Install Linux system libraries required by OpenCV & TensorFlow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libxcb1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install backend dependencies
COPY fyp-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the ArcFace weights (~137 MB) into the image. deepface otherwise downloads
# them from GitHub on first use, i.e. inside a student's check-in request: a slow
# first attendance mark, or a 400 if the network blocks it. Doing it here means a
# fetch failure breaks the build instead of a live check-in.
ENV DEEPFACE_HOME=/opt/deepface
RUN mkdir -p $DEEPFACE_HOME && \
    python -c "from deepface import DeepFace; DeepFace.build_model('ArcFace')"

# Copy backend source code (after deps + weights so code edits don't invalidate them)
COPY fyp-backend/ .

# Run as non-root. The app only reads from /app (languages.json, ml/risk_model.pkl);
# everything else it touches is Postgres.
RUN useradd --create-home appuser && chown -R appuser $DEEPFACE_HOME
USER appuser

# Default container port
EXPOSE 8000

# Start uvicorn with dynamic $PORT support for Railway/Cloud deployments
# Migrations run first and must succeed: a schema failure stops the container instead
# of letting the app start against a half-migrated database.
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
