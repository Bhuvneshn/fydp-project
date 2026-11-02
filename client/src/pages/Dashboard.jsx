import { Link } from 'react-router';
import { useAuth } from '../auth.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="card">
      <h1>FYDP Project</h1>
      <p className="subtitle">Signed in as <strong>{user.email}</strong></p>
      <p>Welcome! Start by browsing the <Link to="/clubs">clubs directory</Link>.</p>
    </div>
  );
}
