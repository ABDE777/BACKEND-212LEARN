/**
 * Drop this into the FRONTEND (Vite / Lovable).
 * Do NOT send the file to backend-212learn.vercel.app — Vercel rejects bodies > 4.5 MB.
 *
 * Usage:
 *   await uploadLessonResource({ apiBase, token, lessonId, file });
 */

function detectType(file) {
  const t = file.type || '';
  if (t === 'application/pdf') return 'pdf';
  if (t.includes('zip')) return 'zip';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('image/')) return 'image';
  if (
    t === 'application/msword' ||
    t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'document';
  }
  // fallback by extension
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.zip')) return 'zip';
  if (/\.(mp4|webm|mov)$/.test(name)) return 'video';
  if (/\.(jpe?g|png|gif|webp)$/.test(name)) return 'image';
  if (/\.(docx?)$/.test(name)) return 'document';
  throw new Error(`Unsupported file type: ${file.type || file.name}`);
}

/**
 * 1) Sign on backend (tiny JSON)
 * 2) Upload file browser → Cloudinary
 * 3) Save only secure_url on backend
 */
export async function uploadLessonResource({
  apiBase = 'https://backend-212learn.vercel.app/api/v1',
  token,
  lessonId,
  file,
}) {
  if (!token) throw new Error('Missing auth token');
  if (!lessonId) throw new Error('Missing lessonId');
  if (!file) throw new Error('Missing file');

  const type = detectType(file);

  // ── Step 1: signature (JSON only — never send the file here) ─────────────
  const signRes = await fetch(`${apiBase}/uploads/cloudinary-sign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type,
      filename: file.name,
      mimetype: file.type || undefined,
    }),
  });

  const signJson = await signRes.json();
  if (!signRes.ok || !signJson.success) {
    throw new Error(signJson?.error?.message || 'Failed to get Cloudinary signature');
  }

  const sign = signJson.data;

  // ── Step 2: direct upload to Cloudinary (file NEVER hits Vercel) ──────────
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sign.apiKey);
  form.append('timestamp', String(sign.timestamp));
  form.append('signature', sign.signature);
  form.append('folder', sign.folder);
  form.append('public_id', sign.public_id);

  const cloudRes = await fetch(sign.uploadUrl, {
    method: 'POST',
    body: form,
  });

  const cloud = await cloudRes.json();
  if (!cloudRes.ok || !cloud.secure_url) {
    throw new Error(cloud?.error?.message || 'Cloudinary upload failed');
  }

  // ── Step 3: save URL only (tiny JSON request to Vercel) ───────────────────
  const saveRes = await fetch(`${apiBase}/lessons/${lessonId}/resources`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type,
      url: cloud.secure_url,
    }),
  });

  const saved = await saveRes.json();
  if (!saveRes.ok || !saved.success) {
    throw new Error(saved?.error?.message || 'Failed to save resource');
  }

  return saved.data.resource;
}

/**
 * ❌ WRONG — causes 413 FUNCTION_PAYLOAD_TOO_LARGE on Vercel
 *
 * const form = new FormData();
 * form.append('file', file);
 * await fetch(`/api/v1/lessons/${id}/resources`, { method: 'POST', body: form });
 */
