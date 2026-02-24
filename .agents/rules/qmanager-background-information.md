---
trigger: always_on
---

📌 QManager System Context & Constraints

1. The Hardware & OS

   Device: Quectel RM551E-GL 5G Modem.

   Operating System: Custom OpenWRT build (Embedded Linux).

   Storage: Flash storage (Minimize writes! Use /tmp/ RAM disk for volatile data).

2. The Critical Constraint ("The Single Pipe")

   Tool: sms_tool is the only bridge to the modem.

   Limitation: The serial port is Single Channel. It cannot handle concurrent commands.

   Consequence: If two processes try to send AT commands at the same time, the modem/tool will crash or return garbage.

3. The Tech Stack

   Frontend: NextJS (Static Export) → Hosted in /www/.

   Backend: Shell Scripts (Ash/Bash) + CGI (uhttpd).

   Data Format: JSON.

4. Make sure to use the documentation QManager_Backend_Architecture.docx and ESPECIALLY the DEVELOPMENT_LOG.md for latest changes and remaining tasks to do for references.

5. Use the "documentation" directory from local directory for more references if needed.

6. Scrutinize approach and always think like a senior developer.

7. Always remember to preferably use native busybox functions since we are using OpenWRT. However, jq is always available so you can use it freely.
