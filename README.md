# Prism Overlay

A web interface for tracking Minecraft Hypixel Bedwars statistics in real-time.

## Development

### Quick Start

```bash
npm install
npm run dev
```

This will start the development server with proxy to the staging API.

### Development Scripts

- `npm run dev` - Start development server with staging API proxy (default)
- `npm run dev:local` - Start development server for local API development (requires local flashlight server)
- `npm run dev:staging` - Start development server with staging API proxy
- `npm run dev:production` - Start development server with production API proxy

### API Configuration

By default, the development server uses the staging API proxy for immediate functionality. If you're developing the flashlight API locally, use `npm run dev:local` and ensure your local flashlight server is running.

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

## Features

- Real-time player statistics tracking
- Historical data analysis and visualization
- Session statistics
- Multi-platform downloads
- Dark/light theme support