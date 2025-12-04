#!/bin/bash

# Simple Call Application Deployment Script
# This script helps deploy the application to an Ubuntu server

set -e

echo "🚀 Simple Call Deployment Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "See DEPLOYMENT.md for installation instructions."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "See DEPLOYMENT.md for installation instructions."
    exit 1
fi

echo -e "${GREEN}✅ Docker is installed${NC}"

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile not found. Please run this script from the project root directory.${NC}"
    exit 1
fi

# Function to build and start
build_and_start() {
    echo ""
    echo -e "${YELLOW}📦 Building Docker image...${NC}"
    docker compose build
    
    echo ""
    echo -e "${YELLOW}🚀 Starting containers...${NC}"
    docker compose up -d
    
    echo ""
    echo -e "${GREEN}✅ Application deployed successfully!${NC}"
    echo ""
    echo "Application is running on: http://localhost"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: docker compose logs -f"
    echo "  - Stop: docker compose down"
    echo "  - Restart: docker compose restart"
    echo "  - Status: docker compose ps"
}

# Function to stop
stop() {
    echo -e "${YELLOW}🛑 Stopping containers...${NC}"
    docker compose down
    echo -e "${GREEN}✅ Containers stopped${NC}"
}

# Function to restart
restart() {
    echo -e "${YELLOW}🔄 Restarting containers...${NC}"
    docker compose restart
    echo -e "${GREEN}✅ Containers restarted${NC}"
}

# Function to view logs
logs() {
    docker compose logs -f
}

# Function to show status
status() {
    echo -e "${YELLOW}📊 Container Status:${NC}"
    docker compose ps
    echo ""
    echo -e "${YELLOW}📊 Container Health:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Main menu
case "${1:-start}" in
    start)
        build_and_start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    rebuild)
        echo -e "${YELLOW}🔄 Rebuilding and restarting...${NC}"
        docker compose down
        build_and_start
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status|rebuild}"
        echo ""
        echo "Commands:"
        echo "  start   - Build and start the application (default)"
        echo "  stop    - Stop the application"
        echo "  restart - Restart the application"
        echo "  logs    - View application logs"
        echo "  status  - Show container status"
        echo "  rebuild - Rebuild and restart the application"
        exit 1
        ;;
esac

