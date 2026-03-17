# QManager

<div align="center">
  <h3>A modern, custom GUI for Quectel modem management</h3>
  <p>Visualize, configure, and optimize your cellular modem's performance with an intuitive web interface</p>
</div>

---

> **Note:** QManager is the successor to [SimpleAdmin](https://github.com/dr-dolomite/simpleadmin-mockup), rebuilt from the ground up with a modern tech stack and improved user experience for managing Quectel modems like the RM520N-GL, RM551E-GL, and similar devices.

---

## Features

### Signal & Network Monitoring
- **Live Signal Dashboard** — Real-time RSRP, RSRQ, SINR with per-antenna values (4x4 MIMO) and 30-minute historical charts
- **Network Events** — Automatic detection of band changes, cell handoffs, carrier aggregation changes, and connectivity events
- **Latency Monitoring** — Real-time ping with 24-hour history, jitter, packet loss, and aggregated views (hourly/12h/daily)
- **Traffic Statistics** — Live throughput (Mbps) and cumulative data usage

### Cellular Configuration
- **Band Locking** — Select and lock specific LTE/NR bands for optimal performance
- **Tower Locking** — Lock to a specific cell tower by PCI, with failover and scheduled changes
- **Frequency Locking** — Lock to exact EARFCN/ARFCN channels
- **APN Management** — Create, edit, delete APN profiles with MNO presets (T-Mobile, AT&T, Verizon, etc.)
- **Custom SIM Profiles** — Save complete configurations (APN + TTL/HL + optional IMEI) and apply with one click
- **Cell Scanner** — Active and neighbor cell scanning with signal comparison
- **Frequency Calculator** — EARFCN/ARFCN to frequency conversion tool

### Network Settings
- **Ethernet Link Speed** — Control and monitor link speed, duplex, and auto-negotiation
- **TTL/HL Settings** — IPv4 TTL and IPv6 Hop Limit configuration (iptables-based)
- **MTU Configuration** — Dynamic MTU application for rmnet interfaces
- **IP Passthrough** — Direct IP assignment to downstream devices
- **Custom DNS** — DNS server override

### Reliability & Monitoring
- **Connection Watchdog** — 4-tier auto-recovery: ifup, CFUN toggle, SIM failover, full reboot
- **Email Alerts** — Downtime notifications via Gmail SMTP, sent on recovery with duration details
- **Tailscale VPN** — Status monitoring and management
- **System Logs** — Centralized log viewer

### Interface
- **Dark/Light Mode** — Full theme support with OKLCH perceptual color system
- **Responsive Design** — Works on desktop monitors and tablets in the field
- **Cookie-Based Auth** — Secure session management with rate limiting

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5 |
| **Styling** | Tailwind CSS v4, OKLCH colors, Euclid Circular B |
| **Components** | shadcn/ui (42 components), Recharts, React Hook Form + Zod |
| **Backend** | POSIX shell scripts (OpenWRT/BusyBox), CGI endpoints |
| **AT Commands** | `qcmd` wrapper for Quectel modem serial communication |
| **Package Manager** | Bun |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- Compatible Quectel modem (RM520N-GL, RM551E-GL, RM500Q, etc.) with AT command support
- OpenWRT device with the modem connected

### Development Setup

```bash
# Clone the repository
git clone https://github.com/dr-dolomite/qmanager.git
cd qmanager

# Install dependencies
bun install

# Start development server (proxies API to modem at 192.168.224.1)
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
bun run build    # Static export to out/
```

Deploy the `out/` directory to your OpenWRT device's `/www/` directory. See [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

---

## Architecture

```
Browser ─── authFetch() ─── CGI Scripts ─── qcmd ─── Modem (AT commands)
                                │
                    reads /tmp/qmanager_status.json
                                │
                         qmanager_poller
                       (tiered polling: 2s/10s/30s)
```

The frontend is a statically-exported Next.js app. The backend is POSIX shell scripts running on OpenWRT — CGI endpoints for API requests and long-running daemons for data collection.

**Key Data Flow:**
- **Poller daemon** queries the modem via AT commands every 2-30s and writes a JSON cache file
- **CGI endpoints** read the cache for GET requests, execute AT commands for POST requests
- **React hooks** poll the CGI layer and provide loading/error/staleness states

See [full documentation](docs/README.md) for architecture details, API reference, and development guides.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Documentation Index](docs/README.md) | Overview and links to all docs |
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flow, polling tiers |
| [Frontend Guide](docs/FRONTEND.md) | Components, hooks, pages, routing |
| [Backend Guide](docs/BACKEND.md) | Shell scripts, daemons, CGI endpoints |
| [API Reference](docs/API-REFERENCE.md) | Complete CGI endpoint reference |
| [Design System](docs/DESIGN-SYSTEM.md) | Colors, typography, UI conventions |
| [Deployment Guide](docs/DEPLOYMENT.md) | Building and deploying to OpenWRT |

---

## Project Structure

```
QManager/
├── app/                    # Next.js App Router pages
├── components/             # React components (~150 files)
│   ├── ui/                 # shadcn/ui primitives (42 components)
│   ├── cellular/           # Cellular management UI
│   ├── dashboard/          # Home dashboard cards
│   ├── local-network/      # Network settings UI
│   └── monitoring/         # Monitoring & alerts UI
├── hooks/                  # Custom React hooks (30 files)
├── types/                  # TypeScript interfaces (14 files)
├── lib/                    # Utilities (auth-fetch, earfcn, csv)
├── constants/              # Static data (MNO presets, event labels)
├── scripts/                # Backend shell scripts
│   ├── etc/init.d/         # Init.d services (7)
│   ├── usr/bin/            # Daemons & utilities (14)
│   ├── usr/lib/qmanager/   # Shared libraries (10)
│   └── www/cgi-bin/        # CGI endpoints (58 scripts)
└── docs/                   # Documentation
```

---

## Support the Project

<div align="center">
  <h3>Support QManager's Development</h3>
  <p>Your contribution helps maintain the project and fund continued development, testing on new cellular networks, and hardware costs.</p>
  <br/>
  <a href="https://ko-fi.com/drdolomite" target="_blank">
    <img height="64" style="border:0;height:64px;" src="https://storage.ko-fi.com/cdn/kofi1.png?v=3" alt="Buy Me a Coffee at ko-fi.com" />
  </a>
  <br/><br/>
  <a href="https://paypal.me/iamrusss" target="_blank">
    <img height="40" src="https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white" alt="Donate via PayPal" />
  </a>
</div>

---

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

---

<div align="center">
  <p>Built with care by <a href="https://github.com/dr-dolomite">DrDolomite</a></p>
</div>
