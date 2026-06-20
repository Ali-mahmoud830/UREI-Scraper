# Use the official Python + Playwright image
FROM mcr.microsoft.com/playwright/python:v1.58.0-jammy

# Hugging Face Spaces require UID 1000.
# The Playwright base image already has a user with UID 1000 (pwuser).
# We set up a new HOME directory and ensure it is owned by UID 1000.
RUN mkdir -p /home/user/app && chown -R 1000:1000 /home/user
USER 1000

# Set environment variables
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/home/user/pw-browsers

# Set the working directory
WORKDIR $HOME/app

# Copy the requirements file into the container
COPY --chown=1000:1000 backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Explicitly install the Chromium browser for the exact playwright version installed by pip
RUN playwright install chromium


# Copy all the backend files to the container with correct ownership
COPY --chown=1000:1000 backend/ .

# HuggingFace requires web servers to listen on exactly port 7860
EXPOSE 7860
ENV PORT=7860

# Run the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
