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
    <div className="auth-form">
      <div className="auth-head">
        <h1>Create your account</h1>
        <p className="lede">Only @uwaterloo.ca emails can register.</p>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label className="field"><span>Email</span>
          <input name="email" type="email" placeholder="you@uwaterloo.ca" required autoComplete="email" />
        </label>
        <label className="field"><span>Password</span>
          <input name="password" type="password" minLength={8} required autoComplete="new-password" aria-describedby="password-hint" />
          <small id="password-hint" className="hint">At least 8 characters.</small>
        </label>
        <label className="field"><span>Confirm password</span>
          <input name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="auth-alt">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
