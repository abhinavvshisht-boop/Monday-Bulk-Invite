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
      // 1️⃣ Fetch all users from account
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
      let skipped = [];
  
      // 2️⃣ Match emails & add to boards
      for (const email of emailList) {
        const user = users.find(u => u.email?.toLowerCase() === email);
  
        if (!user) {
          skipped.push(email);
          continue;
        }
  
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
                userIds: [user.id],
              },
            }
          );
        }
  
        added.push(email);
      }
  
      // 3️⃣ Show result summary
      let message = "✅ Completed\n";
      if (added.length) message += `✔ Added: ${added.join(", ")}\n`;
      if (skipped.length) message += `⚠ Not found: ${skipped.join(", ")}`;
  
      setStatus(message);
      setEmails("");
      setSelectedBoards([]);
  
    } catch (error) {
      console.error(error);
      setStatus("❌ Error adding users to boards");
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
