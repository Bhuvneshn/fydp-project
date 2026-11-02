const ALLOWED_DOMAIN = 'uwaterloo.ca';

async function api(path, body) {
  const res = await fetch(`/api/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

function isUWaterlooEmail(email) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// Wires a <form> to an async handler, showing errors in its .error element.
function handleForm(form, onSubmit) {
  const errorEl = form.querySelector('.error');
  const button = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    button.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}
