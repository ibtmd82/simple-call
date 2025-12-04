#!/bin/bash

# SSL Certificate Setup Script for Simple Call
# For use with existing production SSL certificates

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 SSL Certificate Setup for Simple Call${NC}"
echo "=========================================="
echo ""

# Create SSL directory
SSL_DIR="./ssl"
mkdir -p "$SSL_DIR"

echo "Choose SSL certificate setup method:"
echo "1) Use existing production certificates (Recommended)"
echo "2) Generate self-signed certificate (for testing only)"
echo "3) Skip SSL setup (HTTP only)"
echo ""
read -p "Enter your choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}📋 Using Existing Production Certificates${NC}"
        echo ""
        echo "Please provide the paths to your SSL certificate files."
        echo "Common formats: .crt, .pem, .cer for certificates"
        echo "Common formats: .key, .pem for private keys"
        echo ""
        read -p "Path to certificate file: " cert_path
        
        # Check if certificate file exists
        if [ ! -f "$cert_path" ]; then
            echo -e "${RED}❌ Certificate file not found: $cert_path${NC}"
            exit 1
        fi
        
        read -p "Path to private key file: " key_path
        
        # Check if key file exists
        if [ ! -f "$key_path" ]; then
            echo -e "${RED}❌ Private key file not found: $key_path${NC}"
            exit 1
        fi
        
        # Check if certificate and key match (basic validation)
        echo ""
        echo -e "${YELLOW}Validating certificate and key...${NC}"
        
        cert_modulus=$(openssl x509 -noout -modulus -in "$cert_path" 2>/dev/null | openssl md5)
        key_modulus=$(openssl rsa -noout -modulus -in "$key_path" 2>/dev/null | openssl md5)
        
        if [ "$cert_modulus" != "$key_modulus" ]; then
            echo -e "${YELLOW}⚠️  Warning: Certificate and key moduli don't match.${NC}"
            echo "This might indicate the certificate and key don't belong together."
            read -p "Continue anyway? (y/N): " continue_anyway
            if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
                echo -e "${RED}❌ Setup cancelled${NC}"
                exit 1
            fi
        else
            echo -e "${GREEN}✅ Certificate and key match${NC}"
        fi
        
        # Copy certificates
        echo ""
        echo -e "${YELLOW}Copying certificates...${NC}"
        cp "$cert_path" "$SSL_DIR/cert.pem"
        cp "$key_path" "$SSL_DIR/key.pem"
        
        # Set proper permissions
        chmod 644 "$SSL_DIR/cert.pem"
        chmod 600 "$SSL_DIR/key.pem"
        
        # Display certificate information
        echo ""
        echo -e "${GREEN}✅ Certificates copied to $SSL_DIR/${NC}"
        echo ""
        echo "Certificate Information:"
        openssl x509 -in "$SSL_DIR/cert.pem" -noout -subject -issuer -dates 2>/dev/null || echo "Could not read certificate details"
        echo ""
        ;;
        
    2)
        echo ""
        echo -e "${YELLOW}⚠️  Self-Signed Certificate (Testing Only)${NC}"
        echo "This will generate a self-signed certificate for testing."
        echo "Browsers will show a security warning!"
        echo ""
        read -p "Enter domain name or IP (default: localhost): " domain
        domain=${domain:-localhost}
        
        echo ""
        echo -e "${YELLOW}Generating self-signed certificate...${NC}"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$SSL_DIR/key.pem" \
            -out "$SSL_DIR/cert.pem" \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=$domain"
        
        chmod 600 "$SSL_DIR/key.pem"
        chmod 644 "$SSL_DIR/cert.pem"
        
        echo -e "${GREEN}✅ Self-signed certificate generated in $SSL_DIR/${NC}"
        echo -e "${YELLOW}⚠️  Remember: This is for testing only!${NC}"
        ;;
        
    3)
        echo ""
        echo -e "${YELLOW}⚠️  Skipping SSL setup - HTTP only mode${NC}"
        echo "To use HTTPS later, run this script again or manually add certificates to $SSL_DIR/"
        echo ""
        echo "For HTTP-only mode, the application will work but without HTTPS encryption."
        exit 0
        ;;
        
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ SSL setup complete!${NC}"
echo ""
echo "Certificate files:"
echo "  - $SSL_DIR/cert.pem (SSL certificate)"
echo "  - $SSL_DIR/key.pem (Private key)"
echo ""
echo "Next steps:"
echo "1. Start the application: docker compose up -d"
echo "2. Access via HTTPS: https://your-domain"
echo "3. HTTP will automatically redirect to HTTPS"
echo ""
echo "To verify SSL setup:"
echo "  docker compose logs simple-call"
echo "  curl -k https://localhost/health"
echo ""
