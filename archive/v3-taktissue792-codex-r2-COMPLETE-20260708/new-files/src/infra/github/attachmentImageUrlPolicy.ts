export function isAllowedGithubAttachmentUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') {
    return false;
  }
  if (url.hostname === 'github.com') {
    const segments = url.pathname.split('/').filter(Boolean);
    return (
      segments.length >= 3
      && (
        (segments[0] === 'user-attachments' && segments[1] === 'assets')
        || segments[2] === 'assets'
      )
    );
  }
  return url.hostname === 'private-user-images.githubusercontent.com'
    || url.hostname === 'user-images.githubusercontent.com';
}

export function formatSafeGithubAttachmentUrlForError(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}
