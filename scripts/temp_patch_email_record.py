from pathlib import Path

paw = Path('src/PawRecord.jsx')
text = paw.read_text()
old = 'body:JSON.stringify({recipientEmail,petName:dog.name,htmlContent,note,pdfUrl})'
new = 'body:JSON.stringify({recipientEmail,petId:dog.id,note,pdfUrl})'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('Could not find email-record request body')
paw.write_text(text)

smoke = Path('scripts/live_smoke.mjs')
s = smoke.read_text()
anchor = """    await step('Private file gateway rejects the second customer for the first customer file', async () => {
      const secondarySession = await readBrowserSession(page);
      await waitForFileSessionCookie(context, secondarySession.userId);
      const response = await context.request.get(`${BASE}/api/storage-file?path=${encodeURIComponent(primaryDocument.path)}`);
      if (response.status() !== 403) throw new Error(`Expected 403 for cross-customer private file, got ${response.status()}`);
    });"""
addition = anchor + """

    await step('Health-record email endpoint rejects another customer pet', async () => {
      const response = await context.request.post(`${BASE}/api/email-record`, {
        data: {
          recipientEmail: 'ownership-probe@example.com',
          petId: primaryDogId,
          note: 'ownership isolation probe',
        },
      });
      if (response.status() !== 404) throw new Error(`Expected 404 for cross-customer emailed pet, got ${response.status()}`);
    });"""
if 'Health-record email endpoint rejects another customer pet' not in s:
    if anchor not in s:
        raise SystemExit('Could not find private-file isolation anchor')
    s = s.replace(anchor, addition, 1)
smoke.write_text(s)
