const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const url = require("url");

const JWT_SECRET = process.env.JWT_SECRET || "secure-jwt-secret-key-change-in-production-12345";
const PORT = process.env.WS_PORT || 3001;

const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket Server started on port ${PORT}`);

const rooms = new Map();
const clientDetails = new Map();

function broadcastToRoom(docId, message, excludeSocket = null) {
  const room = rooms.get(docId);
  if (!room) return;

  const msgString = JSON.stringify(message);
  for (const client of room) {
    if (client !== excludeSocket && client.readyState === 1) {
      client.send(msgString);
    }
  }
}

function getPresenceList(docId) {
  const room = rooms.get(docId);
  if (!room) return [];

  const list = [];
  for (const client of room) {
    const details = clientDetails.get(client);
    if (details) {
      list.push({
        userId: details.userId,
        name: details.name,
        email: details.email,
      });
    }
  }
  
  const unique = [];
  const seen = new Set();
  for (const item of list) {
    if (!seen.has(item.userId)) {
      seen.add(item.userId);
      unique.push(item);
    }
  }
  return unique;
}

wss.on("connection", (ws, req) => {
  try {
    const parameters = url.parse(req.url, true).query;
    const token = parameters.token;
    const docId = parameters.docId;

    if (!token || !docId) {
      console.log("Connection rejected: Missing token or docId");
      ws.close(4001, "Missing token or docId");
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.log("Connection rejected: Invalid token");
      ws.close(4002, "Invalid token");
      return;
    }

    const { userId, name, email } = decoded;

    if (!rooms.has(docId)) {
      rooms.set(docId, new Set());
    }
    rooms.get(docId).add(ws);

    clientDetails.set(ws, { userId, name, email, docId });

    console.log(`User ${name} (${email}) connected to doc ${docId}`);

    broadcastToRoom(docId, {
      type: "presence",
      users: getPresenceList(docId),
    });

    ws.on("message", (messageData) => {
      try {
        const message = JSON.parse(messageData.toString());

        switch (message.type) {
          case "edit":
            broadcastToRoom(docId, {
              type: "edit",
              content: message.content,
              userId,
              userName: name,
            }, ws);
            break;

          case "cursor":
            broadcastToRoom(docId, {
              type: "cursor",
              userId,
              userName: name,
              position: message.position,
            }, ws);
            break;

          default:
            console.log("Unknown message type:", message.type);
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });

    ws.on("close", () => {
      console.log(`User ${name} disconnected from doc ${docId}`);

      const room = rooms.get(docId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rooms.delete(docId);
        }
      }
      clientDetails.delete(ws);

      broadcastToRoom(docId, {
        type: "presence",
        users: getPresenceList(docId),
      });
    });

    ws.on("error", (err) => {
      console.error(`Socket error for ${name}:`, err);
    });

  } catch (err) {
    console.error("Error setting up connection:", err);
    ws.close(5000, "Internal error");
  }
});
