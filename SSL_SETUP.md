# SSL Certificate Setup Guide

This guide explains how to set up HTTPS using your existing production SSL certificates.

## Quick Setup

```bash
# Run the setup script
./setup-ssl.sh

# Choose option 1 (Use existing production certificates)
# Provide paths to your certificate and key files
```

## Manual Setup

### Step 1: Prepare Your Certificates

You need two files:
- **Certificate file** (.crt, .pem, or .cer)
- **Private key file** (.key or .pem)

### Step 2: Create SSL Directory

```bash
mkdir -p ssl
```

### Step 3: Copy Certificates

```bash
# Copy your certificate
cp /path/to/your/certificate.crt ssl/cert.pem

# Copy your private key
cp /path/to/your/private.key ssl/key.pem

# Set proper permissions
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem
```

### Step 4: Verify Certificates

```bash
# Check certificate details
openssl x509 -in ssl/cert.pem -text -noout

# Verify certificate and key match
openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5
openssl rsa -noout -modulus -in ssl/key.pem | openssl md5
# Both should output the same hash
```

### Step 5: Start Application

```bash
docker compose up -d
```

## Certificate File Formats

The application expects:
- Certificate: `ssl/cert.pem`
- Private Key: `ssl/key.pem`

If your certificates have different names or formats, rename them:

```bash
# Example: If you have certificate.crt and private.key
cp certificate.crt ssl/cert.pem
cp private.key ssl/key.pem
```

## Common Certificate Formats

### Single Certificate File
If you have a single certificate file:
```bash
cp your-cert.crt ssl/cert.pem
cp your-key.key ssl/key.pem
```

### Certificate Chain
If you have a certificate chain (certificate + intermediate):
```bash
# Combine certificate and chain
cat your-cert.crt your-chain.crt > ssl/cert.pem
cp your-key.key ssl/key.pem
```

### PEM Format
If your certificates are already in PEM format:
```bash
cp certificate.pem ssl/cert.pem
cp private.pem ssl/key.pem
```

### PFX/P12 Format
If you have a PFX/P12 file, extract certificates:

```bash
# Extract certificate
openssl pkcs12 -in certificate.pfx -clcerts -nokeys -out ssl/cert.pem

# Extract private key
openssl pkcs12 -in certificate.pfx -nocerts -nodes -out ssl/key.pem

# Set permissions
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem
```

## Certificate Validation

Before deploying, verify your certificates:

```bash
# Check certificate expiration
openssl x509 -in ssl/cert.pem -noout -dates

# Check certificate subject (domain name)
openssl x509 -in ssl/cert.pem -noout -subject

# Verify certificate and key match
cert_hash=$(openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5)
key_hash=$(openssl rsa -noout -modulus -in ssl/key.pem | openssl md5)

if [ "$cert_hash" == "$key_hash" ]; then
    echo "✅ Certificate and key match"
else
    echo "❌ Certificate and key do not match"
fi
```

## Troubleshooting

### Certificate Not Found Error

If you see "certificate not found" in logs:

1. **Check file names:**
   ```bash
   ls -la ssl/
   # Should show: cert.pem and key.pem
   ```

2. **Check file permissions:**
   ```bash
   chmod 644 ssl/cert.pem
   chmod 600 ssl/key.pem
   ```

3. **Verify files are readable:**
   ```bash
   cat ssl/cert.pem
   cat ssl/key.pem
   ```

### Certificate and Key Don't Match

If certificate and key don't match:

1. **Verify you're using the correct key:**
   ```bash
   openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5
   openssl rsa -noout -modulus -in ssl/key.pem | openssl md5
   ```

2. **Check certificate details:**
   ```bash
   openssl x509 -in ssl/cert.pem -text -noout | grep -A 5 "Subject:"
   ```

### Certificate Expired

Check expiration date:
```bash
openssl x509 -in ssl/cert.pem -noout -dates
```

To renew, replace the certificate files and restart:
```bash
# Replace certificates
cp new-cert.crt ssl/cert.pem
cp new-key.key ssl/key.pem

# Restart container
docker compose restart
```

### SSL Handshake Failed

If SSL handshake fails:

1. **Check certificate format:**
   ```bash
   # Should be readable PEM format
   head -1 ssl/cert.pem
   # Should show: -----BEGIN CERTIFICATE-----
   ```

2. **Check key format:**
   ```bash
   head -1 ssl/key.pem
   # Should show: -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----
   ```

3. **Verify certificate is not corrupted:**
   ```bash
   openssl x509 -in ssl/cert.pem -text -noout
   ```

## Security Best Practices

1. **Protect Private Key:**
   - Never commit private keys to version control
   - Use proper file permissions (600)
   - Store keys securely

2. **Certificate Rotation:**
   - Monitor certificate expiration
   - Renew certificates before expiration
   - Test certificate replacement process

3. **Backup:**
   - Keep secure backups of certificates and keys
   - Store backups in encrypted storage

## Testing HTTPS

After setup, test HTTPS:

```bash
# Test locally
curl -k https://localhost/health

# Test from browser
# Navigate to: https://your-domain.com

# Check SSL configuration
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

## File Structure

```
simple-call/
├── ssl/
│   ├── cert.pem    # SSL certificate
│   └── key.pem     # Private key
├── docker-compose.yml
└── nginx.conf
```

## Support

For issues:
1. Check application logs: `docker compose logs -f simple-call`
2. Verify certificate files: `ls -la ssl/`
3. Test certificate: `openssl x509 -in ssl/cert.pem -text -noout`
4. Check nginx configuration: `docker compose exec simple-call nginx -t`

