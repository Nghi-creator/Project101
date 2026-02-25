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
  const xvfb = spawn("Xvfb", [":99", "-screen", "0", "640x480x24"]);

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

    const gstArgs = [
      "ximagesrc",
      "display-name=:99",
      "use-damage=false",
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

// --- TCP CAPTURE CARD ---
const tcpServer = net.createServer((socket) => {
  console.log("Camera connected to TCP Capture Card!");

  let imageBuffer = Buffer.alloc(0);
  const JPEG_START = Buffer.from([0xff, 0xd8]);
  const JPEG_END = Buffer.from([0xff, 0xd9]);

  socket.on("data", (chunk) => {
    imageBuffer = Buffer.concat([imageBuffer, chunk]);

    let startIdx = imageBuffer.indexOf(JPEG_START);

    // 1. Loop as long as we find a Start byte
    while (startIdx !== -1) {
      // 2. Throw away any garbage BEFORE the start byte
      if (startIdx > 0) {
        imageBuffer = imageBuffer.subarray(startIdx);
        startIdx = 0;
      }

      // 3. Look for the End byte
      let endIdx = imageBuffer.indexOf(JPEG_END, 1000);

      if (endIdx !== -1) {
        // 4. Slice the perfect frame and send it
        const frame = imageBuffer.subarray(0, endIdx + 2);
        io.emit("video-frame", frame.toString("base64"));

        // 5. Trim the sent frame out of the buffer
        imageBuffer = imageBuffer.subarray(endIdx + 2);

        // 6. Look for the next Start byte in the remaining data
        startIdx = imageBuffer.indexOf(JPEG_START);
      } else {
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

  // Listen for the physical PRESS
  socket.on("keydown", (data) => {
    let linuxKey = translateKey(data.key);
    if (linuxKey) {
      exec(`DISPLAY=:99 xdotool keydown ${linuxKey}`, (err) => {
        if (err) console.error("[xdotool keydown Error]:", err);
      });
    }
  });

  // Listen for the physical RELEASE
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
