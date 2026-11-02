import { useAuth } from '../auth.jsx';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <main className="card">
      <h1>FYDP Project</h1>
      <p className="subtitle">Signed in as <strong>{user.email}</strong></p>
      <p>Welcome! The rest of the app goes here.</p>
      <button type="button" className="secondary" onClick={logout}>Log out</button>
    </main>
  );
}
