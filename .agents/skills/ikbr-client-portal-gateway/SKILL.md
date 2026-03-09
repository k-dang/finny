---
name: ikbr-client-portal-gateway
description: Start and authenticate the IBKR Client Portal API Gateway (CPGW) as a prerequisite for running ikbr-tools CLI commands. Use when the user asks to run/start the gateway, client portal API, CPGW, or needs the local gateway running before CLI calls.
---

# IBKR Client Portal API Gateway

## Quick start

1. Confirm Java is installed (minimum Java 8 update 192).
   - `java -version`
2. Download and unzip the Client Portal API Gateway (Standard or Beta release).
3. Open a terminal and `cd` into the unzipped gateway folder.
4. Start the gateway:
   - Windows: `bin\run.bat root\conf.yaml`
   - Unix/macOS: `bin/run.sh root/conf.yaml`
5. Open `https://localhost:5000` in a browser, sign in, and complete 2FA.
   - If you see a certificate warning, this is expected for localhost.

## Notes and constraints

- Run the gateway on the same machine that will issue API requests.
- Default port is `5000`. To change it, edit `root/conf.yaml` and update `listenPort`.
- If port `5000` is in use, choose another open port (e.g., `5001`).
- You must reauthenticate at least once after midnight each day.
- IBKR does not support automating the browser login step.

## If ikbr-tools CLI fails

- Ensure the gateway is running and logged in.
- Confirm `IKBR_BASE_URL` matches the gateway port (e.g., `https://localhost:5000`).
