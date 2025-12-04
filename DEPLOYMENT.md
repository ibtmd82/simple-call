# Production Deployment Guide for Ubuntu 22.04

This guide will help you deploy the Simple Call application to an Ubuntu 22.04 server using Docker with HTTPS support.

## Prerequisites

- Ubuntu 22.04 LTS
- Docker and Docker Compose installed
- Domain name (required for HTTPS with Let's Encrypt)
- Basic knowledge of Linux commands
- Root or sudo access

## Step 1: Install Docker and Docker Compose on Ubuntu 22.04

### Install Docker

```bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository for Ubuntu 22.04 (Jammy)
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify Docker installation
sudo docker run hello-world

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Apply group changes (or log out and log back in)
newgrp docker
```

### Verify Installation

```bash
docker --version
docker compose version
```

## Step 2: Prepare the Server

### Create Application Directory

```bash
# Create directory for the application
sudo mkdir -p /opt/simple-call
sudo chown $USER:$USER /opt/simple-call
cd /opt/simple-call
```

### Clone or Upload Your Application

**Option 1: Using Git (if repository is available)**

```bash
git clone <your-repository-url> .
```

**Option 2: Upload files using SCP**

From your local machine:
```bash
scp -r /path/to/simple-call/* user@your-server:/opt/simple-call/
```

**Option 3: Using rsync**

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' /path/to/simple-call/ user@your-server:/opt/simple-call/
```

## Step 3: Configure Environment Variables

Create a `.env` file in the application directory (if needed for build-time variables):

```bash
cd /opt/simple-call
nano .env
```

Add your environment variables (if any are needed at build time):
```
VITE_SIP_DOMAIN=your-domain.com
VITE_SIP_WS_SERVER=wss://your-websocket-server.com
VITE_SIP_CALL_ID=your-call-id
```

**Note:** For runtime configuration, users will configure SIP settings through the web interface.

## Step 4: Build and Run with Docker

### Using Docker Compose (Recommended)

```bash
cd /opt/simple-call

# Build and start the container
docker compose up -d --build

# Check if container is running
docker compose ps

# View logs
docker compose logs -f
```

### Using Docker Commands Directly

```bash
cd /opt/simple-call

# Build the image
docker build -t simple-call:latest .

# Run the container
docker run -d \
  --name simple-call-app \
  --restart unless-stopped \
  -p 80:80 \
  simple-call:latest

# Check container status
docker ps

# View logs
docker logs -f simple-call-app
```

## Step 5: Configure Firewall on Ubuntu 22.04

Ubuntu 22.04 uses UFW (Uncomplicated Firewall) by default:

```bash
# Check firewall status
sudo ufw status

# Allow HTTP traffic (required for Let's Encrypt)
sudo ufw allow 80/tcp

# Allow HTTPS traffic (required for production)
sudo ufw allow 443/tcp

# If you need SSH access (if not already configured)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable

# Verify firewall rules
sudo ufw status verbose
```

**Important**: Make sure SSH (port 22) is allowed before enabling UFW, or you might lock yourself out!

## Step 6: Set Up HTTPS with Production SSL Certificates

The application supports HTTPS using your existing production SSL certificates.

### Option 1: Using the SSL Setup Script (Recommended)

```bash
cd /opt/simple-call

# Run the SSL setup script
chmod +x setup-ssl.sh
./setup-ssl.sh
```

Choose option 1 and provide paths to your:
- Certificate file (.crt, .pem, or .cer)
- Private key file (.key or .pem)

The script will:
- Validate certificate and key match
- Copy certificates to the correct location
- Set proper file permissions
- Display certificate information

### Option 2: Manual Certificate Setup

```bash
cd /opt/simple-call

# Create SSL directory
mkdir -p ssl

# Copy your production certificates
cp /path/to/your/certificate.crt ssl/cert.pem
cp /path/to/your/private.key ssl/key.pem

# Set proper permissions
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem

# Verify certificates match (optional but recommended)
openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5
openssl rsa -noout -modulus -in ssl/key.pem | openssl md5
# Both commands should output the same hash

# Start the application
docker compose up -d
```

**Note:** For detailed certificate setup instructions, including handling different certificate formats (PFX, P12, certificate chains), see [SSL_SETUP.md](./SSL_SETUP.md)

### HTTP-Only Mode (Development/Testing)

If you don't have SSL certificates or want to test without HTTPS:

```bash
# Use HTTP-only configuration
cp nginx-http-only.conf nginx.conf

# Rebuild and start
docker compose up -d --build
```

**Note:** For production, HTTPS is strongly recommended, especially for WebRTC applications. The application requires SSL certificates to be present in the `ssl/` directory for HTTPS to work.

### Verify HTTPS Setup

After setting up SSL certificates:

```bash
# Check if certificates exist
ls -la ssl/

# Should show:
# cert.pem (SSL certificate)
# key.pem (SSL private key)

# Start the application
docker compose up -d

# Check logs
docker compose logs -f

# Test HTTPS
curl -k https://localhost/health
```

### Access the Application

- **HTTPS**: `https://your-domain.com` (recommended)
- **HTTP**: `http://your-domain.com` (will redirect to HTTPS if SSL is configured)

The application automatically:
- Redirects HTTP to HTTPS when SSL certificates are present
- Serves content over HTTPS on port 443
- Maintains HTTP on port 80 for Let's Encrypt challenges

## Step 8: Maintenance Commands

### View Logs

```bash
# Using docker compose
docker compose logs -f

# Using docker
docker logs -f simple-call-app
```

### Restart the Application

```bash
# Using docker compose
docker compose restart

# Using docker
docker restart simple-call-app
```

### Update the Application

```bash
cd /opt/simple-call

# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker compose up -d --build

# Or using docker
docker stop simple-call-app
docker rm simple-call-app
docker build -t simple-call:latest .
docker run -d --name simple-call-app --restart unless-stopped -p 80:80 simple-call:latest
```

### Stop the Application

```bash
# Using docker compose
docker compose down

# Using docker
docker stop simple-call-app
docker rm simple-call-app
```

### Remove Everything

```bash
# Stop and remove container
docker compose down

# Remove image
docker rmi simple-call:latest

# Remove application files
sudo rm -rf /opt/simple-call
```

## Step 9: Monitoring and Health Checks

### Check Container Health

```bash
docker ps
docker inspect simple-call-app | grep -A 10 Health
```

### Access Health Endpoint

```bash
curl http://localhost/health
```

### Monitor Resource Usage

```bash
# Container stats
docker stats simple-call-app

# System resources
htop
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs simple-call-app

# Check if port is already in use
sudo netstat -tulpn | grep :80
sudo lsof -i :80
```

### Application Not Accessible

1. Check if container is running: `docker ps`
2. Check firewall: `sudo ufw status`
3. Check nginx (if using): `sudo systemctl status nginx`
4. Check logs: `docker logs simple-call-app`

### Build Fails

```bash
# Clean build (no cache)
docker build --no-cache -t simple-call:latest .

# Check disk space
df -h
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/simple-call
```

## Security Best Practices

1. **Keep Docker Updated**
   ```bash
   sudo apt-get update && sudo apt-get upgrade docker-ce
   ```

2. **Use Non-root User** (already configured in Dockerfile)

3. **Regular Backups**
   ```bash
   # Backup application files
   tar -czf simple-call-backup-$(date +%Y%m%d).tar.gz /opt/simple-call
   ```

4. **Monitor Logs Regularly**
   ```bash
   # Set up log rotation
   docker logs --tail 100 simple-call-app > /var/log/simple-call.log
   ```

5. **Use HTTPS** (as described in Step 6)

6. **Restrict Docker Access**
   - Only add trusted users to docker group
   - Use firewall rules to restrict access

## Performance Optimization

### Increase Nginx Worker Processes

Edit `nginx.conf` in your project:
```nginx
worker_processes auto;
worker_connections 1024;
```

### Enable HTTP/2 (with HTTPS)

In your Nginx reverse proxy config:
```nginx
listen 443 ssl http2;
```

## Backup and Recovery

### Backup

```bash
# Backup application directory
sudo tar -czf /backup/simple-call-$(date +%Y%m%d).tar.gz /opt/simple-call

# Backup Docker volumes (if any)
docker run --rm -v simple-call-data:/data -v /backup:/backup ubuntu tar czf /backup/volume-backup.tar.gz /data
```

### Recovery

```bash
# Restore application
cd /opt
sudo tar -xzf /backup/simple-call-YYYYMMDD.tar.gz

# Rebuild and start
cd simple-call
docker compose up -d --build
```

## Support

For issues or questions:
1. Check application logs: `docker logs simple-call-app`
2. Check system logs: `journalctl -u docker`
3. Review this deployment guide
4. Check Docker and Nginx documentation

## Quick Reference

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Restart
docker compose restart

# View logs
docker compose logs -f

# Rebuild
docker compose up -d --build

# Check status
docker compose ps
```

