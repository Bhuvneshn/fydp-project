import { useState } from 'react';

// Wraps an async form handler with pending/error state.
export function useSubmit(handler) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await handler(Object.fromEntries(new FormData(e.currentTarget)));
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return { onSubmit, error, setError, pending };
}
