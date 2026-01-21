
# wireguard-autobest

Automatically test all your WireGuard VPN configs and pick the best route to your game server by ping and traceroute. Like ExitLag, but open-source—find the lowest-latency VPN for gaming (e.g., Counter Strike 2, Faceit) and save 10–20ms for a smoother FPS experience.

## Usage

1. Place your WireGuard `.conf` files in the `configs/` folder.
2. Run the tool and enter your target server IP or hostname (e.g., Faceit, CS2, Minecraft and a lot more game servers with easily accessed IP Addresses).
3. The script will:
	- Test direct (non-VPN) and all VPN routes.
	- Ping and traceroute each route.
	- Start/stop each VPN tunnel automatically (admin required).
	- Show a table of results and highlight the best route.

### Example

```bash
node index.js 185.25.180.1   # Replace with your game server IP or hostname
```

Or run without arguments and enter the target manually.

**Note:** Run as Administrator for VPN switching to work.

