// Live reload client for automatic refresh on file changes

(function () {
  // Only connect in development
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  let ws;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const reconnectDelay = 1000;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("🔄 Live reload connected");
        reconnectAttempts = 0;

        // Add visual indicator
        showReloadIndicator("connected");
      };

      ws.onmessage = event => {
        const data = JSON.parse(event.data);

        if (data.type === "reload") {
          console.log("🔄 File changed, reloading...");
          showReloadIndicator("reloading");

          // Small delay to allow file write to complete
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      };

      ws.onclose = () => {
        console.log("🔄 Live reload disconnected");
        showReloadIndicator("disconnected");

        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(connect, reconnectDelay * reconnectAttempts);
        }
      };

      ws.onerror = error => {
        console.error("🔄 Live reload error:", error);
      };
    } catch (error) {
      console.error("🔄 Failed to connect to live reload:", error);
    }
  }

  function showReloadIndicator(status) {
    let indicator = document.getElementById("ws-status");

    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "ws-status";
      document.body.appendChild(indicator);
    }

    indicator.className = "";

    switch (status) {
      case "connected":
        indicator.textContent = "● live";
        indicator.className = "connected";
        break;

      case "disconnected":
        indicator.textContent = "● disconnected";
        indicator.className = "disconnected";
        break;

      case "reloading":
        indicator.textContent = "● reloading...";
        indicator.className = "connected";
        break;
    }
  }

  // Start connection when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", connect);
  } else {
    connect();
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    if (ws) {
      ws.close();
    }
  });
})();
