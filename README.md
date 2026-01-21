# 🚀 wireguard-autobest

Automatically test all your WireGuard VPN configs and pick the best route to your game server by ping and traceroute. Like ExitLag, but open-source—find the lowest-latency VPN for gaming (e.g., Counter Strike 2, Faceit) and save 10–20ms for a smoother FPS experience.

---

## ✨ Features
- **Auto-detects** all WireGuard configs in `configs/`
- **Tests direct and VPN routes** to your target server
- **Measures ping and traceroute** for each route
- **Starts/stops VPN tunnels automatically** (admin required)
- **Highlights the best route** for gaming

---

## 🛠️ Usage

1. Place your WireGuard `.conf` files in the `configs/` folder (these are git-ignored for safety).
2. Run the tool and enter your target server IP or hostname (e.g., Faceit, CS2, Valorant, etc.).
3. The script will:
    - Test direct (non-VPN) and all VPN routes
    - Ping and traceroute each route
    - Start/stop each VPN tunnel automatically (admin required)
    - Show a table of results and highlight the best route

### Example

```bash
node index.js 185.25.180.1   # Replace with your game server IP or hostname
```

Or run without arguments and enter the target interactively.

> **Note:** Run as Administrator for VPN switching to work. Only `configs/*` is tracked; your `.conf` files stay private.

---

## 📊 Example Output

Below is a sample output of the script (with VPN IPs anonymized):

```
=== WireGuard Route Tester ===

Platform: Windows
Running as Administrator: Yes

Target: 159.69.60.56

[ Testing: NON-VPN ]
    [PING] 159.69.60.56...
    [PING] 38 ms
    [TRACE] 159.69.60.56...
           1    <1 ms    <1 ms    <1 ms  192.168.1.1
           2     3 ms     3 ms     3 ms  ...
           ...
           13    40 ms    39 ms    38 ms  159.69.60.56
    [TRACE] Result: 13 hops, last RTT: 38 ms

[ Testing: VPN-1 ]
    [ENDPOINT] Checking VPN server...
    [ENDPOINT] IP: <hidden>:51820
    [ENDPOINT] Hostname: <hidden>
    [ENDPOINT] Ping: 5 ms
    [WG] Starting tunnel: VPN-1
    [WG] Waiting 5s for stability...
    [PING] 159.69.60.56...
    [PING] 29 ms
    [TRACE] 159.69.60.56...
           1     5 ms     5 ms     6 ms  10.2.0.1
           ...
           8    28 ms    29 ms    30 ms  159.69.60.56
    [TRACE] Result: 8 hops, last RTT: 30 ms
    [WG] Stopping tunnel: VPN-1

[ Testing: VPN-2 ]
    [ENDPOINT] Checking VPN server...
    [ENDPOINT] IP: <hidden>:51820
    [ENDPOINT] Hostname: (not resolved)
    [ENDPOINT] Ping: 53 ms
    [WG] Starting tunnel: VPN-2
    [WG] Waiting 5s for stability...
    [PING] 159.69.60.56...
    [PING] 73 ms
    [TRACE] 159.69.60.56...
           1    54 ms    53 ms    53 ms  10.2.0.1
           ...
           10    74 ms    73 ms    75 ms  159.69.60.56
    [TRACE] Result: 10 hops, last RTT: 75 ms
    [WG] Stopping tunnel: VPN-2

[ Testing: VPN-3 ]
    [ENDPOINT] Checking VPN server...
    [ENDPOINT] IP: <hidden>:51820
    [ENDPOINT] Hostname: <hidden>
    [ENDPOINT] Ping: 5 ms
    [WG] Starting tunnel: VPN-3
    [WG] Waiting 5s for stability...
    [PING] 159.69.60.56...
    [PING] 29 ms
    [TRACE] 159.69.60.56...
           1     5 ms     6 ms     6 ms  10.2.0.1
           ...
           8    29 ms    29 ms    30 ms  159.69.60.56
    [TRACE] Result: 8 hops, last RTT: 30 ms
    [WG] Stopping tunnel: VPN-3

==================================================================
Route                       Ping (ms)   Hops    Last RTT    Best
------------------------------------------------------------------
NON-VPN                     38.0        13      38.0
VPN-1                       29.0        8       30.0
VPN-2                       73.0        10      75.0
VPN-3                       29.0        8       30.0        ✓
==================================================================

Best route: VPN-3
```

Sensitive VPN IPs and hostnames are hidden for privacy. Your output will show your actual configs' names and results.

---

## 📝 License

MIT

