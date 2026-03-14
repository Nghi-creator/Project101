const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { spawn, exec } = require("child_process");
const net = require("net");
const fs = require("fs");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

process.on("uncaughtException", (err) => console.error("\n[FATAL ERROR]", err));
process.on("unhandledRejection", (reason) =>
  console.error("\n[UNHANDLED PROMISE]", reason),
);

function startGameEngine() {
  console.log("Starting Virtual Screen...");

  // Clean up any stale X11 lock file (Docker restart issue)
  if (fs.existsSync("/tmp/.X99-lock")) {
    fs.rmSync("/tmp/.X99-lock", { force: true });
  }
  if (fs.existsSync("/tmp/.X11-unix/X99")) {
    fs.rmSync("/tmp/.X11-unix/X99", { force: true, recursive: true });
  }

  const xvfb = spawn("Xvfb", [":99", "-screen", "0", "640x480x24"]);
  xvfb.stderr.on("data", (data) => console.error(`[Xvfb Error]: ${data}`));

  const config = `
  vrr_runloop_enable = "true"
  audio_driver = "null"
  `;
  fs.writeFileSync("/app/retroarch.cfg", config);

  setTimeout(() => {
    console.log("Starting Emulator and Camera...");

    const retroarch = spawn(
      "retroarch",
      [
        "-f",
        "-L",
        "/cores/nestopia_libretro.so",
        "--appendconfig",
        "/app/retroarch.cfg",
        "/roms/little_sisyphus_v1.nes",
      ],
      { env: { ...process.env, DISPLAY: ":99" } },
    );
    retroarch.stderr.on("data", (data) => console.log(`[RetroArch] ${data}`));

    // Removed the failed 'use-damage=false' flag
    const gstArgs = [
      "ximagesrc",
      "display-name=:99",
      "!",
      "video/x-raw,framerate=30/1",
      "!",
      "videoscale",
      "!",
      "video/x-raw,width=640,height=480",
      "!",
      "videoconvert",
      "!",
      "jpegenc",
      "quality=60",
      "!",
      "tcpclientsink",
      "host=127.0.0.1",
      "port=5000",
    ];
    const gst = spawn("gst-launch-1.0", gstArgs, {
      env: { ...process.env, DISPLAY: ":99" },
    });
    gst.stderr.on("data", (data) => console.log(`[GStreamer] ${data}`));
  }, 1000);
}

// --- THE BULLETPROOF TCP CAPTURE CARD ---
const tcpServer = net.createServer((socket) => {
  console.log("Camera connected to TCP Capture Card!");

  let imageBuffer = Buffer.alloc(0);
  const JPEG_START = Buffer.from([0xff, 0xd8]);
  const JPEG_END = Buffer.from([0xff, 0xd9]);

  socket.on("data", (chunk) => {
    imageBuffer = Buffer.concat([imageBuffer, chunk]);

    while (true) {
      let start = imageBuffer.indexOf(JPEG_START);
      let end = imageBuffer.indexOf(JPEG_END);

      // If we don't have a Start marker yet, wait for more data.
      if (start === -1) break;

      // 1. THE ORPHAN CLEANUP: If an End marker appears BEFORE a Start marker,
      // it is leftover garbage from a broken chunk. Trim it away and restart the loop.
      if (end !== -1 && end < start) {
        imageBuffer = imageBuffer.subarray(start);
        continue;
      }

      // 1.5 THE LEFTOVER FRAME CLEANUP: If there are MULTIPLE Start markers before the End marker,
      // the earlier Start markers belong to broken/dropped frames! Trim them away to prevent glitches.
      if (end !== -1) {
        let lastStart = imageBuffer.lastIndexOf(JPEG_START, end);
        if (lastStart > start) {
          imageBuffer = imageBuffer.subarray(lastStart);
          continue;
        }
      }

      // 2. THE PADDING CLEANUP: Trim any random network garbage before the Start marker
      if (start > 0) {
        imageBuffer = imageBuffer.subarray(start);
        start = 0;
        end = imageBuffer.indexOf(JPEG_END); // Recalculate End position!
      }

      // 3. THE EXTRACTION: If we have a perfect pair, slice it and send it!
      if (start !== -1 && end !== -1) {
        const frame = imageBuffer.subarray(start, end + 2);
        io.emit("video-frame", frame.toString("base64"));

        imageBuffer = imageBuffer.subarray(end + 2);
      } else {
        // We have a Start, but no End yet. Wait for the next TCP chunk.
        break;
      }
    }
  });
});

tcpServer.listen(5000, "127.0.0.1", () =>
  console.log("TCP Video Server listening on port 5000"),
);

// --- UPGRADED CONTROLLER LOGIC ---
io.on("connection", (socket) => {
  console.log("A player connected to the console!");

  socket.on("keydown", (data) => {
    let linuxKey = translateKey(data.key);
    if (linuxKey) {
      exec(`DISPLAY=:99 xdotool keydown ${linuxKey}`, (err) => {
        if (err) console.error("[xdotool keydown Error]:", err);
      });
    }
  });

  socket.on("keyup", (data) => {
    let linuxKey = translateKey(data.key);
    if (linuxKey) {
      exec(`DISPLAY=:99 xdotool keyup ${linuxKey}`, (err) => {
        if (err) console.error("[xdotool keyup Error]:", err);
      });
    }
  });
});

function translateKey(browserKey) {
  const keyMap = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    z: "z",
    x: "x",
    Enter: "Return",
    Shift: "Shift_R",
  };
  return keyMap[browserKey] || "";
}

server.listen(8080, "0.0.0.0", () => {
  console.log("Cloud Console API running on port 8080");
  startGameEngine();
});
