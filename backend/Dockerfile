# Use the official Python + Playwright image (Crucial for headless browsers)
FROM mcr.microsoft.com/playwright/python:v1.58.0-jammy

# Set the working directory
WORKDIR /app

# Copy python requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies rapidly without cache
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the backend files to the container
COPY . .

# HuggingFace requires web servers to listen on exactly port 7860
EXPOSE 7860

# Ensure environment variable $PORT overrides default to 7860
ENV PORT=7860

# Run the FastAPI server gracefully
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
