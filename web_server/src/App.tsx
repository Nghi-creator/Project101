import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:8080");

function App() {
  const [frame, setFrame] = useState<string>("");

  useEffect(() => {
    socket.on("video-frame", (base64Data: string) => {
      setFrame(`data:image/jpeg;base64,${base64Data}`);
    });

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
      }}
    >
      <h1>🎮 React Cloud Console</h1>

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
