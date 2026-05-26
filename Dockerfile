FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# main.py reads PORT from env (defaults to 8080), so the container honors
# whatever port the platform (Zeabur, Fly, Cloud Run, ...) injects.
CMD ["python", "main.py"]
