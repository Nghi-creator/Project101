import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:8080");

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    console.log("[React] 1. Initializing WebRTC with Audio + Video...");

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnection.current = pc;

    pc.ontrack = (event) => {
      console.log(`[React] TRACK RECEIVED! Kind: ${event.track.kind}`);
      if (videoRef.current) {
        const stream =
          (videoRef.current.srcObject as MediaStream) || new MediaStream();
        stream.addTrack(event.track);
        videoRef.current.srcObject = stream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("webrtc-ice-candidate", event.candidate);
    };

    socket.on("webrtc-answer", (answer) => {
      pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("webrtc-ice-candidate-backend", (candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("connect", () => {
      console.log("[React] 2. Connected! Asking for Video AND Audio...");
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", offer);
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

    // If socket is already connected when we click Play, manually trigger the handshake
    if (socket.connected) {
      socket.emit("python-ready"); // Ping server to trigger pipeline
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", offer);
      });
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      pc.close();
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate-backend");
    };
  }, [isPlaying]);

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

      {!isPlaying ? (
        <div style={{ padding: "100px" }}>
          <button
            onClick={() => setIsPlaying(true)}
            style={{
              fontSize: "2rem",
              padding: "20px 40px",
              cursor: "pointer",
              background: "green",
              color: "white",
              borderRadius: "8px",
              border: "none",
            }}
          >
            Power On Console
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
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
      )}
      <p style={{ marginTop: "20px", fontSize: "1.2rem" }}>
        Click the game screen to focus, and use your <b>Arrow Keys + Z/X</b> to
        play!
      </p>
    </div>
  );
}

export default App;
