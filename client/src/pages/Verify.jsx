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
    <main className="card">
      <h1>Check your email</h1>
      <p className="subtitle">We sent a 6-digit code to <strong>{user.email}</strong>.</p>
      <form onSubmit={onSubmit}>
        <label>Verification code
          <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" />
        </label>
        <p className="error">{error}</p>
        <button type="submit" disabled={pending}>Verify</button>
        <button type="button" className="secondary" onClick={resend}>Resend code</button>
      </form>
    </main>
  );
}
