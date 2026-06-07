# Bundled Binaries (`dependencies/`)

Prebuilt executables shipped verbatim onto the modem by `build.sh` →
`install.sh` (installed to `/usr/bin/`, mode 755). They are cross-compiled
out-of-band, not by this repo's build. This file records how to reproduce them.

> The binaries here are committed directly to git (not gitignored, no LFS).
> When you rebuild `sms_tool`, commit the new binary together with an updated
> `sms_tool.patch` and this README so the three stay in sync.

Target device: **Quectel RM551E-GL** — OpenWRT, `armv7l`, ARM **EABI5**,
AT pipe on the char device **`/dev/smd11`** (not a UART/TTY).

| Binary | Source | Notes |
|--------|--------|-------|
| `sms_tool` | [`obsy/sms_tool`](https://github.com/obsy/sms_tool) (Apache-2.0) | Patched — see below |
| `atcli_smd11` | internal | AT-command client bound to `/dev/smd11` |

---

## `sms_tool`

Patched fork of `obsy/sms_tool`. The patch (`dependencies/sms_tool.patch`,
applied to `sms_main.c`) makes four changes:

1. **Default device `/dev/ttyUSB0` → `/dev/smd11`.** Upstream's default does
   not exist on this modem (bare `sms_tool recv` used to crash).
2. **Skip `termios` on non-TTY devices** — `if (!isatty(port)) return;` in
   `setserial()`. `/dev/smd11` is an SMD char device, not a serial line, so
   `tcgetattr`/`tcsetattr` return `ENOTTY` ("Inappropriate ioctl for device").
   Guarding on `isatty()` removes that noise at the source.
3. **Guard the exit-time `termios` restore** (`resetserial()`) the same way, so
   no `failed tcsetattr: Inappropriate ioctl` is printed on exit.
4. **Fail loud, not fatal** on a missing port. Upstream printed "open port
   failed" then fell through to `fdopen(-1,…)` → `setvbuf(NULL,…)` → **SIGSEGV**.
   Each open/reopen/fdopen failure now `exit(1)`s cleanly. The verbose
   `open()`/`reopen()` traces are gated behind the existing `-D` debug flag.

Behavior is otherwise unchanged: `-d` overrides the default; `send`/`recv`/
`delete`/`status`/`ussd`/`at`, `-j` JSON, and `-D` debug all work as before.

> The CGI wrappers (`scripts/.../cellular/sms.sh`, `sms_alerts.sh`) still strip
> `tcgetattr`/`tcsetattr` noise and pass `-d /dev/smd11` explicitly. With this
> binary those filters are now no-ops, kept as defense-in-depth; retire them in
> a later cleanup.

### Rebuild (static armhf)

The shipped binary is **statically linked** so it carries its own libc and runs
regardless of the device's libc version. `sms_tool` does no DNS/NSS (the one
area where static glibc misbehaves), so the simplest toolchain works:

```sh
# Toolchain: Ubuntu's armhf glibc cross-compiler (apt, reliable).
sudo apt install -y gcc-arm-linux-gnueabihf

git clone https://github.com/obsy/sms_tool.git
cd sms_tool
patch -p1 < /path/to/dependencies/sms_tool.patch     # patches sms_main.c

make CC=arm-linux-gnueabihf-gcc \
     CROSS_COMPILE=arm-linux-gnueabihf- \
     CFLAGS="-O2 -static"
arm-linux-gnueabihf-strip --strip-all sms_tool       # ~440 KB stripped

# MUST be static — verify (no INTERP segment):
arm-linux-gnueabihf-readelf -l sms_tool | grep -i INTERP   # -> (nothing)
file sms_tool   # ELF 32-bit LSB executable, ARM, EABI5, statically linked
```

Smaller alternative: a **musl** armhf toolchain
(`https://musl.cc/arm-linux-musleabihf-cross.tgz`) yields a ~55 KB binary.
Either works on the device since the binary is static; glibc-static is used here
because it matches the previously shipped binary and needs no extra download.

`-static` can silently fall back to dynamic if a static lib is missing — always
run the `readelf -l … | grep INTERP` check and confirm it prints nothing.

### On-device smoke test

```sh
sms_tool status                      # defaults to smd11, silent, exit 0
sms_tool recv -d /dev/smd11          # no tcgetattr/tcsetattr noise
sms_tool recv -d /dev/ttyUSB0        # "open port failed", exit 1, NO segfault
sms_tool -D recv -d /dev/ttyUSB0     # open() trace reappears under -D
```
