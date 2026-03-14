import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:8080");

function App() {
  // Create a direct reference to the HTML5 Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // --- THE ANTI-FLICKER CANVAS RENDERER ---
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    // We create a background image object to decode the Base64 invisibly
    const img = new Image();
    img.onload = () => {
      // ONLY draw to the screen when the image is 100% successfully decoded
      if (ctx && canvas) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };

    socket.on("video-frame", (base64Data: string) => {
      // Giving the img a new src triggers the onload function above
      img.src = `data:image/jpeg;base64,${base64Data}`;
    });

    // --- KEYBOARD CONTROLS ---
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
      socket.off("video-frame");
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
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
      <h1>🎮 React Cloud Console</h1>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
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
