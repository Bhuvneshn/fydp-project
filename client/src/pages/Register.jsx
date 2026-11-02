import { Link } from 'react-router';
import { isUWaterlooEmail } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useSubmit } from '../useSubmit.js';

export default function Register() {
  const { register } = useAuth();
  const { onSubmit, error, pending } = useSubmit(async ({ email, password, confirm }) => {
    if (!isUWaterlooEmail(email)) throw new Error('Only @uwaterloo.ca email addresses can register.');
    if (password !== confirm) throw new Error('Passwords do not match.');
    await register(email, password);
  });

  return (
    <main className="card">
      <h1>Create account</h1>
      <p className="subtitle">Only @uwaterloo.ca emails can register.</p>
      <form onSubmit={onSubmit}>
        <label>Email
          <input name="email" type="email" placeholder="you@uwaterloo.ca" required autoComplete="email" />
        </label>
        <label>Password
          <input name="password" type="password" minLength={8} required autoComplete="new-password" />
        </label>
        <label>Confirm password
          <input name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        </label>
        <p className="error">{error}</p>
        <button type="submit" disabled={pending}>Create account</button>
      </form>
      <p className="footer">Already have an account? <Link to="/login">Log in</Link></p>
    </main>
  );
}
