import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useSubmit } from '../useSubmit.js';

export default function Verify() {
  const { user, verify } = useAuth();
  const { onSubmit, error, setError, pending } = useSubmit(({ code }) => verify(code));

  async function resend() {
    try {
      await api('/resend-code', {});
      setError('A new code has been sent.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-form">
      <div className="auth-head">
        <h1>Check your email</h1>
        <p className="lede">We sent a 6-digit code to <strong>{user.email}</strong>.</p>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label className="field"><span>Verification code</span>
          <input className="code-input" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>Verify</button>
        <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={resend}>Resend code</button>
      </form>
      <p className="auth-alt">Didn't get it? Check your spam folder, or resend the code.</p>
    </div>
  );
}
