FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for build (if needed by cryptography/bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential \
	libffi-dev \
	&& rm -rf /var/lib/apt/lists/*

# Create a requirements.txt for pip fallback and caching simplicity
COPY requirements.txt ./

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

# Default to uvicorn
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
