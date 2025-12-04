# Quick Start Guide

## Prerequisites

- Docker and Docker Compose installed on Ubuntu
- Port 80 available (or change in docker-compose.yml)

## Quick Deployment on Ubuntu 22.04

### 1. Clone/Upload the Application

```bash
# Create directory
sudo mkdir -p /opt/simple-call
cd /opt/simple-call

# Upload your files here (via SCP, rsync, or git clone)
```

### 2. Deploy with One Command

```bash
# Make scripts executable
chmod +x deploy.sh setup-ssl.sh

# Deploy the application (HTTP only)
./deploy.sh start
```

Or using Docker Compose directly:

```bash
docker compose up -d --build
```

### 3. Set Up HTTPS with Production Certificates

```bash
# Run SSL setup script
chmod +x setup-ssl.sh
./setup-ssl.sh
# Choose option 1 and provide paths to your certificate and key files
```

Or manually:

```bash
# Create SSL directory
mkdir -p ssl

# Copy your production certificates
cp /path/to/certificate.crt ssl/cert.pem
cp /path/to/private.key ssl/key.pem

# Set permissions
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem

# Start application
docker compose up -d
```

For detailed SSL setup, see [SSL_SETUP.md](./SSL_SETUP.md)

### 4. Access the Application

- **HTTPS**: `https://your-domain.com` (if SSL configured)
- **HTTP**: `http://your-server-ip` (will redirect to HTTPS if SSL is configured)

### 4. Common Commands

```bash
# View logs
./deploy.sh logs
# or
docker compose logs -f

# Stop application
./deploy.sh stop
# or
docker compose down

# Restart application
./deploy.sh restart
# or
docker compose restart

# Check status
./deploy.sh status
# or
docker compose ps

# Rebuild and restart
./deploy.sh rebuild
```

## Troubleshooting

### Port Already in Use

If port 80 is already in use, edit `docker-compose.yml`:

```yaml
ports:
  - "8080:80"  # Change to use port 8080
```

Then access via `http://your-server-ip:8080`

### Check Logs

```bash
docker compose logs -f simple-call
```

### Check Container Status

```bash
docker ps
docker inspect simple-call-app
```

## Next Steps

For production deployment with HTTPS and domain configuration, see [DEPLOYMENT.md](./DEPLOYMENT.md)

