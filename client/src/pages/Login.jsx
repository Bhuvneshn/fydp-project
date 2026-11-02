import { Link } from 'react-router';
import { isUWaterlooEmail } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useSubmit } from '../useSubmit.js';

export default function Login() {
  const { login } = useAuth();
  const { onSubmit, error, pending } = useSubmit(async ({ email, password }) => {
    if (!isUWaterlooEmail(email)) throw new Error('Only @uwaterloo.ca email addresses are allowed.');
    await login(email, password);
  });

  return (
    <main className="card">
      <h1>Log in</h1>
      <p className="subtitle">Use your @uwaterloo.ca account.</p>
      <form onSubmit={onSubmit}>
        <label>Email
          <input name="email" type="email" placeholder="you@uwaterloo.ca" required autoComplete="email" />
        </label>
        <label>Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <p className="error">{error}</p>
        <button type="submit" disabled={pending}>Log in</button>
      </form>
      <p className="footer">No account? <Link to="/register">Create one</Link></p>
    </main>
  );
}
