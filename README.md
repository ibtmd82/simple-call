# Simple Call - WebRTC Support Call Application

A modern, responsive WebRTC-based video calling application built with React, TypeScript, and SIP.js.

## Features

- 🎥 **Video & Audio Calls** - High-quality WebRTC video and audio communication
- 📱 **Mobile Responsive** - Optimized for mobile and desktop devices
- 🎨 **Beautiful UI** - Modern, gradient-based design with smooth animations
- ⚙️ **Easy Configuration** - Simple SIP settings configuration through web interface
- 📞 **Call Management** - Call history, contacts, and dialer functionality
- 🔒 **Secure** - DTLS-enabled WebRTC connections

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Production Deployment

For quick deployment, see [QUICK_START.md](./QUICK_START.md)

For detailed deployment instructions on Ubuntu, see [DEPLOYMENT.md](./DEPLOYMENT.md)

#### Quick Deploy with Docker

```bash
# Using the deployment script
./deploy.sh start

# Or using Docker Compose
docker compose up -d --build
```

## Project Structure

```
simple-call/
├── src/
│   ├── components/      # React components
│   ├── services/        # SIP and WebRTC services
│   ├── store/          # State management (Zustand)
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── public/             # Static assets
├── Dockerfile          # Docker production image
├── docker-compose.yml  # Docker Compose configuration
├── nginx.conf         # Nginx configuration
└── deploy.sh          # Deployment script
```

## Configuration

SIP configuration is done through the web interface in the Settings tab. Users can configure:
- SIP Username
- SIP Password
- Connection testing

Server-side configuration (domain, WebSocket server, Call ID) should be set via environment variables in the `.env` file during build time.

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **WebRTC**: SIP.js, WebRTC API
- **State Management**: Zustand
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Production**: Docker, Nginx

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari (with limitations)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

Private - All rights reserved

## Support

For deployment issues, refer to:
- [QUICK_START.md](./QUICK_START.md) - Quick deployment guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed Ubuntu deployment guide
