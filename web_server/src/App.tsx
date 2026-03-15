import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:8080");

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    console.log("[React] 1. Initializing WebRTC...");

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnection.current = pc;

    pc.onconnectionstatechange = () =>
      console.log("🫀 [WebRTC] Connection State:", pc.connectionState);
    pc.oniceconnectionstatechange = () =>
      console.log("🧊 [WebRTC] ICE (Network) State:", pc.iceConnectionState);
    pc.onsignalingstatechange = () =>
      console.log("🚦 [WebRTC] Signaling State:", pc.signalingState);

    // --- THE STREAM FIX ---
    pc.ontrack = (event) => {
      console.log(
        "[React] 5. VIDEO TRACK RECEIVED! Plugging into <video> tag...",
      );
      if (videoRef.current) {
        // If event.streams[0] is missing, we manually wrap the raw track in a MediaStream!
        videoRef.current.srcObject =
          event.streams[0] || new MediaStream([event.track]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc-ice-candidate", event.candidate);
      }
    };

    socket.on("webrtc-answer", (answer) => {
      console.log(
        "[React] Answer received from Python! Finalizing connection...",
      );
      console.log("✉️ OPENING THE ENVELOPE (SDP):", answer.sdp);
      pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("webrtc-ice-candidate-backend", (candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // --- THE RACE CONDITION FIX ---
    // We only ask for video AFTER Socket.io confirms the connection is live
    socket.on("connect", () => {
      console.log("[React] 2. Socket.io Successfully Connected to Node.js!");

      pc.addTransceiver("video", { direction: "recvonly" });

      console.log("[React] 3. Generating WebRTC Offer...");
      pc.createOffer()
        .then((offer) => {
          console.log("[React] 4. Offer generated! Firing at Node.js...");
          pc.setLocalDescription(offer);
          socket.emit("webrtc-offer", offer);
        })
        .catch((err) => {
          console.error("[React] FATAL ERROR: Could not generate offer!", err);
        });
    });

    // --- CONTROLS ---
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      socket.emit("keydown", { key: e.key });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      socket.emit("keyup", { key: e.key });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      pc.close();
      socket.off("connect");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate-backend");
    };
  }, []);

  return (
    <div
      style={{
        background: "#111",
        color: "white",
        height: "100vh",
        textAlign: "center",
        paddingTop: "20px",
      }}
    >
      <h1>🎮 WebRTC Cloud Console</h1>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: 800,
          height: 600,
          background: "black",
          border: "4px solid #444",
          borderRadius: "8px",
          margin: "0 auto",
          display: "block",
          boxShadow: "0px 0px 20px rgba(0,0,0,0.8)",
        }}
      />

      <p style={{ marginTop: "20px", fontSize: "1.2rem" }}>
        Click the game screen to focus, and use your <b>Arrow Keys + Z/X</b> to
        play!
      </p>
    </div>
  );
}

export default App;
