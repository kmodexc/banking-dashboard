import type { ReactElement } from 'react';

function ExternalSearchLink({
  href,
  label,
  description,
  className = '',
}: {
  href: string;
  label: string;
  description: string;
  className?: string;
}): ReactElement {
  return (
    <a className={`research-link ${className}`} href={href} target="_blank" rel="noreferrer">
      <span className="research-link-label">
        {label}
        <span aria-hidden="true"> ↗</span>
      </span>
      <span className="research-link-description">{description}</span>
    </a>
  );
}

export function SearchPreview({
  recipient,
  purpose = '',
}: {
  recipient: string;
  purpose?: string;
}): ReactElement {
  const query = recipient.trim() || 'transaction recipient';
  const encodedQuery = encodeURIComponent(query);

  return (
    <section className="search-preview" aria-label="Recipient research links">
      <div className="search-preview-heading">
        <div>
          <span className="eyebrow accent-eyebrow">Quick research</span>
          <h3>{query}</h3>
        </div>
        <span className="muted small">{purpose || 'Find business type and location'}</span>
      </div>
      <div className="research-links">
        <ExternalSearchLink
          className="research-link-google"
          href={`https://www.google.com/search?q=${encodedQuery}`}
          label="Google"
          description="Search the web for this recipient"
        />
        <ExternalSearchLink
          href={`https://duckduckgo.com/?q=${encodedQuery}`}
          label="DuckDuckGo"
          description="Private web search"
        />
        <ExternalSearchLink
          className="research-link-maps"
          href={`https://www.google.com/maps/search/?api=1&query=${encodedQuery}`}
          label="Google Maps"
          description="Check location and business category"
        />
      </div>
      <p className="search-frame-note">
        Opens in a new tab so the provider can show complete results without an embedded frame.
      </p>
    </section>
  );
}
