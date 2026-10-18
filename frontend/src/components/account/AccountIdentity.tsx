import type { ReactElement } from 'react';
import type { AuthSnapshot } from '../../types';

function accountLabel(auth: AuthSnapshot): string {
  return auth.user?.name || auth.user?.preferred_username || auth.user?.email || 'Signed in';
}

export function AccountIdentity({ auth }: { auth: AuthSnapshot }): ReactElement {
  const signedIn = Boolean(auth.token);
  return (
    <div className={`account-identity${signedIn ? ' signed-in' : ''}`}>
      <span className="account-identity-dot" aria-hidden="true" />
      <div>
        <strong>{signedIn ? accountLabel(auth) : 'Not signed in'}</strong>
        <small>{signedIn ? 'Account connected' : 'Local browser mode'}</small>
      </div>
    </div>
  );
}
