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
    <div className="auth-form">
      <div className="auth-head">
        <h1>Log in</h1>
        <p className="lede">Use your @uwaterloo.ca account.</p>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label className="field"><span>Email</span>
          <input name="email" type="email" placeholder="you@uwaterloo.ca" required autoComplete="email" />
        </label>
        <label className="field"><span>Password</span>
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="auth-alt">No account? <Link to="/register">Create one</Link></p>
    </div>
  );
}
