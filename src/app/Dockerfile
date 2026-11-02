# Use the official Python 3.11 slim image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy and install dependencies first (for better Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 7860

# Run the FastAPI/Uvicorn server
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "7860"]