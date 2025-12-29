import React, { useEffect, useState } from "react";
import mondaySdk from "monday-sdk-js";

const monday = mondaySdk();

export default function App() {
  const [boards, setBoards] = useState([]);
  const [users, setUsers] = useState([]);

  const [selectedBoards, setSelectedBoards] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("guest");
  const [status, setStatus] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    fetchBoards();
    fetchUsers();
  }, []);

  /* ------------------ FETCH BOARDS ------------------ */
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

  /* ------------------ FETCH USERS ------------------ */
  const fetchUsers = async () => {
    const res = await monday.api(`
      query {
        users {
          id
          name
          email
        }
      }
    `);
    setUsers(res.data.users);
  };

  /* ------------------ BOARD SELECTION ------------------ */
  const toggleBoard = (boardId) => {
    setSelectedBoards((prev) =>
      prev.includes(boardId)
        ? prev.filter((id) => id !== boardId)
        : [...prev, boardId]
    );
  };

  /* ------------------ USER SELECTION ------------------ */
  const toggleUser = (user) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  /* ------------------ INVITE LOGIC ------------------ */
  const inviteUsers = async () => {
    if (!emails && selectedUsers.length === 0) {
      setStatus("❌ Please add emails or select users");
      return;
    }

    if (selectedBoards.length === 0) {
      setStatus("❌ Please select at least one board");
      return;
    }

    const emailList = emails
      .split(/[\n,]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    try {
      // Fetch existing users (for email check)
      const usersRes = await monday.api(`
        query {
          users {
            id
            email
          }
        }
      `);

      const existingUsers = usersRes.data.users;

      let added = [];
      let invited = [];
      let failed = [];

      /* -------- ADD SELECTED EXISTING USERS -------- */
      for (const user of selectedUsers) {
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
        added.push(user.email);
      }

      /* -------- PROCESS EMAIL INVITES -------- */
      for (const email of emailList) {
        let userId;

        const existingUser = existingUsers.find(
          (u) => u.email?.toLowerCase() === email
        );

        if (existingUser) {
          userId = existingUser.id;
        } else {
          try {
            const inviteRes = await monday.api(`
              mutation {
                invite_users(
                  emails: ["${email}"],
                  user_role: ${role.toUpperCase()}
                ) {
                  invited_users {
                    id
                    email
                  }
                }
              }
            `);

            userId = inviteRes.data.invite_users.invited_users[0].id;
            invited.push(email);
          } catch (err) {
            console.error("Invite failed:", email, err);
            failed.push(email);
            continue;
          }
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
                userIds: [userId],
              },
            }
          );
        }

        added.push(email);
      }

      /* -------- STATUS MESSAGE -------- */
      let message = "✅ Completed\n";
      if (added.length) message += `✔ Added: ${added.join(", ")}\n`;
      if (invited.length) message += `📩 Invited: ${invited.join(", ")}\n`;
      if (failed.length) message += `❌ Failed: ${failed.join(", ")}`;

      setStatus(message);
      setEmails("");
      setSelectedBoards([]);
      setSelectedUsers([]);
      setUserSearch("");

    } catch (error) {
      console.error(error);
      setStatus("❌ Error processing invites");
    }
  };

  /* ------------------ UI ------------------ */
  return (
    <div className="container">
      <h2>Bulk Board User Invite</h2>

      <label>Email Addresses</label>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="user1@gmail.com, user2@company.com"
      />

      <label>Select Existing Users</label>
      <div className="user-dropdown">
        <input
          type="text"
          placeholder="Search users..."
          value={userSearch}
          onFocus={() => setShowUserDropdown(true)}
          onChange={(e) => setUserSearch(e.target.value)}
        />

        {showUserDropdown && (
          <div className="dropdown-list">
            {filteredUsers.map((user) => (
              <div key={user.id} className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedUsers.some((u) => u.id === user.id)}
                  onChange={() => toggleUser(user)}
                />
                <span>{user.name}</span>
                <small>{user.email}</small>
              </div>
            ))}
          </div>
        )}
      </div>

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

      {status && <pre className="status">{status}</pre>}
    </div>
  );
}
