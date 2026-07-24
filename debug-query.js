import { getDatabase } from "./src/lib/message-db.server.js";

// Test what query gets generated
const db = getDatabase();
const isProfessional = true;

// Build the query dynamically to avoid template literal issues in SQL
let query = `
  SELECT
    conversation.id,
    conversation.clientId,
    conversation.professionalId,
    conversation.jobTitle,
    conversation.lastMessageAt,
    otherUser.id AS otherUserId,
    otherUser.role AS otherUserRole,
    otherUser.firstName AS otherFirstName,
    otherUser.lastName AS otherLastName,
    otherUser.email AS otherEmail,
    otherUser.avatarUrl AS otherUserAvatarUrl,
    COALESCE(lastMessage.body, '') AS preview,
    (
      SELECT COUNT(*)
      FROM "Message" unreadMessage
      WHERE unreadMessage.conversationId = conversation.id
        AND unreadMessage.senderId != ?
        AND unreadMessage.readAt IS NULL
    ) AS unread
  FROM "MessageConversation" conversation
  INNER JOIN "User" otherUser
    ON otherUser.id = `;

if (isProfessional) {
  query += `conversation.clientId`;
} else {
  query += `conversation.professionalId`;
}

query += `
  LEFT JOIN "Message" lastMessage
    ON lastMessage.id = (
      SELECT message.id
      FROM "Message" message
      WHERE message.conversationId = conversation.id
      ORDER BY datetime(message.createdAt) DESC
      LIMIT 1
    )
  WHERE `;

if (isProfessional) {
  query += `conversation.professionalId = ?`;
} else {
  query += `conversation.clientId = ?`;
}

query += `
  ORDER BY datetime(conversation.lastMessageAt) DESC
`;

console.log("Generated query:");
console.log(query);
console.log("---");

// Try to prepare it to see if there's a syntax error
try {
  const stmt = db.prepare(query);
  console.log("Query prepared successfully!");
  stmt.close();
} catch (error) {
  console.error("Error preparing query:", error.message);
  console.error("Error stack:", error.stack);
}

db.close();
