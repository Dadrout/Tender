FROM python:3.12-slim
WORKDIR /app
COPY apps/api/requirements.lock.txt ./requirements.lock.txt
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY apps/api ./apps/api
COPY demo ./demo
COPY data/public-tenders ./data/public-tenders
ENV QAZBID_DATA_DIR=/data
WORKDIR /app/apps/api
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "qazbid.main:app", "--host", "0.0.0.0", "--port", "8000"]
