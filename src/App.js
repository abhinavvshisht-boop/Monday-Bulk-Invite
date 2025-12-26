import React, { useEffect, useState } from "react";
import mondaySdk from "monday-sdk-js";

const monday = mondaySdk();

export default function App() {
  const [boards, setBoards] = useState([]);
  const [selectedBoards, setSelectedBoards] = useState([]);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("guest");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    const query = `
      query {
        boards(limit: 100) {
          id
          name
        }
      }
    `;
    const res = await monday.api(query);
    setBoards(res.data.boards);
  };

  const toggleBoard = (boardId) => {
    setSelectedBoards((prev) =>
      prev.includes(boardId)
        ? prev.filter((id) => id !== boardId)
        : [...prev, boardId]
    );
  };

const inviteUsers = async () => {
  if (!emails || selectedBoards.length === 0) {
    setStatus("❌ Please add emails and select boards");
    return;
  }

  const emailList = emails
    .split(/[\n,]/)
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  try {
    // 1️⃣ Fetch existing users
    const usersRes = await monday.api(`
      query {
        users {
          id
          email
        }
      }
    `);

    const users = usersRes.data.users;

    let added = [];
    let invited = [];
    let failed = [];

    for (const email of emailList) {
      let userId;

      const existingUser = users.find(
        u => u.email?.toLowerCase() === email
      );

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // 2️⃣ Invite external user (CORRECT API)
        try {
          const inviteRes = await monday.api(`
            mutation {
              invite_users(
                emails: ["${email}"],
                user_kind: ${role}
              ) {
                invited_users {
                  id
                  email
                }
              }
            }
          `);

          userId =
            inviteRes.data.invite_users.invited_users[0].id;

          invited.push(email);
        } catch (err) {
          console.error("Invite failed:", email, err);
          failed.push(email);
          continue;
        }
      }

      // 3️⃣ Add user to boards
      for (const boardId of selectedBoards) {
        await monday.api(
          `
          mutation ($boardId: ID!, $userIds: [ID!]!) {
            add_users_to_board(board_id: $boardId, user_ids: $userIds) {
              id
            }
          }
          `,
          {
            variables: {
              boardId,
              userIds: [userId],
            },
          }
        );
      }

      added.push(email);
    }

    // 4️⃣ Status message
    let message = "✅ Completed\n";
    if (added.length) message += `✔ Added: ${added.join(", ")}\n`;
    if (invited.length) message += `📩 Invited: ${invited.join(", ")}\n`;
    if (failed.length) message += `❌ Failed: ${failed.join(", ")}`;

    setStatus(message);
    setEmails("");
    setSelectedBoards([]);

  } catch (error) {
    console.error(error);
    setStatus("❌ Error processing invites");
  }
};


  
  

  return (
    <div className="container">
      <h2>Bulk Board User Invite</h2>

      <label>Email Addresses</label>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="user1@gmail.com, user2@company.com"
      />

      <label>Select Boards</label>
      <div className="boards">
        {boards.map((board) => (
          <div key={board.id} className="board-row">
            <input
              type="checkbox"
              checked={selectedBoards.includes(board.id)}
              onChange={() => toggleBoard(board.id)}
            />
            <span>{board.name}</span>
            <small>ID: {board.id}</small>
          </div>
        ))}
      </div>

      <label>User Role</label>
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="guest">Guest</option>
        <option value="member">Member</option>
      </select>

      <button onClick={inviteUsers}>Invite Users</button>

      {status && <p className="status">{status}</p>}
    </div>
  );
}
