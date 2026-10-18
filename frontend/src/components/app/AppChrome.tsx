import type { ChangeEvent, ReactElement } from 'react';
import type { AuthSnapshot } from '../../types';

export function AuthControls({
  auth,
  onLogin,
  onLogout,
}: {
  auth: AuthSnapshot;
  onLogin: () => void;
  onLogout: () => void;
}): ReactElement {
  const userLabel = auth.token
    ? auth.user?.name || auth.user?.preferred_username || auth.user?.email || 'Signed in'
    : 'Not signed in';
  return (
    <div className="auth-controls">
      <span id="user-label" className="muted">
        {userLabel}
      </span>
      <button
        id="login-button"
        className={`button primary${auth.token ? ' hidden' : ''}`}
        disabled={Boolean(auth.setupError)}
        onClick={onLogin}
      >
        Sign in
      </button>
      <button
        id="logout-button"
        className={`button secondary${auth.token ? '' : ' hidden'}`}
        onClick={onLogout}
      >
        Sign out
      </button>
    </div>
  );
}

export function FilePicker({
  id,
  label,
  onChange,
}: {
  id: string;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}): ReactElement {
  return (
    <label className="file-picker button secondary">
      {label}
      <input id={id} type="file" accept=".csv,text/csv" onChange={onChange} />
    </label>
  );
}
