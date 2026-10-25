import { getCachedAccessToken, setCachedAccessToken, signInWithGoogle } from './firebase';

export interface DrivePdfFile {
  id: string;
  name: string;
  size?: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export function getActiveDriveToken(): string | null {
  return getCachedAccessToken();
}

export async function authorizeDrive(): Promise<string> {
  const result = await signInWithGoogle();
  if (!result?.accessToken) {
    throw new Error('Google Drive authorization was not granted. Please sign in to authorize Drive access.');
  }
  setCachedAccessToken(result.accessToken);
  return result.accessToken;
}

export async function searchDrivePdfs(searchQuery: string = ''): Promise<DrivePdfFile[]> {
  const token = getActiveDriveToken();
  if (!token) {
    throw new Error('NO_TOKEN');
  }

  let q = "(mimeType = 'application/pdf' or mimeType contains 'image/') and trashed = false";
  if (searchQuery.trim()) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    q += ` and name contains '${escaped}'`;
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id, name, mimeType, size, webViewLink, modifiedTime)');
  url.searchParams.set('pageSize', '30');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      setCachedAccessToken(null);
      throw new Error('NO_TOKEN');
    }
    const errText = await res.text();
    throw new Error(`Google Drive API request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.files || []) as DrivePdfFile[];
}

export async function downloadDrivePdfBlob(fileId: string, mimeType?: string): Promise<Blob> {
  const token = getActiveDriveToken();
  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      setCachedAccessToken(null);
      throw new Error('Drive access token expired. Please re-connect Google Drive.');
    }
    throw new Error(`Failed to download file from Drive (${res.status})`);
  }

  const contentType = res.headers.get('content-type') || mimeType || 'application/pdf';
  const arrayBuffer = await res.arrayBuffer();
  return new Blob([arrayBuffer], { type: contentType });
}
