import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:8080");

function App() {
  const [frame, setFrame] = useState<string>("");

  useEffect(() => {
    // Listen for incoming video frames and update the image source
    socket.on("video-frame", (data: string) => {
      setFrame(`data:image/jpeg;base64,${data}`);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)
      ) {
        event.preventDefault();
      }
      socket.emit("key-press", { key: event.key });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      socket.off("video-frame");
    };
  }, []);

  return (
    <div
      style={{
        background: "#111",
        color: "white",
        height: "100vh",
        textAlign: "center",
      }}
    >
      <h1>🎮 React Cloud Console</h1>

      {/* Render the game stream or a loading box */}
      {frame ? (
        <img
          src={frame}
          alt="Game Stream"
          style={{
            width: 800,
            height: 600,
            background: "black",
            border: "2px solid #444",
          }}
        />
      ) : (
        <div
          style={{
            width: 800,
            height: 600,
            background: "black",
            border: "2px solid #444",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p>Waiting for video stream...</p>
        </div>
      )}

      <p>Click the page to focus, and use your Arrow Keys + Z/X to play!</p>
    </div>
  );
}

export default App;
