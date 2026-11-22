"""The one branded HTML layout for every email the app sends (EMAIL-LOOK-01).

Email clients ignore most CSS, so this is table layout with inline styles, no images (often blocked) and no scripts. Every piece of
text is escaped here, so a lecturer's warning or a typed address can never become markup. The plain-text part is sent alongside.
"""
import html

FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace"


def _paragraphs(text: str) -> str:
    parts = [part.strip() for part in (text or "").replace("\r\n", "\n").split("\n\n") if part.strip()]
    return "".join(f'<p style="margin:0 0 16px;font:400 15px/1.65 {FONT};color:#475569;">{html.escape(part).replace(chr(10), "<br>")}</p>'
                   for part in parts)


def render(subject: str, text: str, *, eyebrow: str = "Smart Attendance System", code: str | None = None,
           button: tuple[str, str] | None = None, note: str | None = None, preheader: str | None = None) -> str:
    """subject is the heading; text is the body (paragraphs split by blank lines); code is shown large; button is (label, https URL)."""
    blocks = [_paragraphs(text)]
    if code:
        blocks.append(f'''<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 24px;"><tr>
<td style="background:#eff6ff;border:1px dashed #93c5fd;border-radius:16px;padding:18px 30px;text-align:center;">
<div style="font:600 11px/1 {FONT};letter-spacing:.12em;text-transform:uppercase;color:#3b82f6;padding-bottom:10px;">Your code</div>
<div class="code" style="font:700 34px/1.1 {MONO};letter-spacing:10px;color:#1e3a8a;padding-left:10px;">{html.escape(code)}</div>
</td></tr></table>''')
    if button:
        label, url = button
        if not url.startswith(("https://", "http://")):
            raise ValueError("Email buttons link to web pages only.")
        href = html.escape(url, quote=True)
        blocks.append(f'''<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr>
<td bgcolor="#2563eb" style="border-radius:12px;background:#2563eb;">
<a href="{href}" target="_blank" style="display:inline-block;padding:14px 28px;font:600 15px/1 {FONT};color:#ffffff;text-decoration:none;border-radius:12px;">{html.escape(label)}</a>
</td></tr></table>
<p style="margin:0 0 20px;font:400 12px/1.6 {FONT};color:#94a3b8;">Button not working? Paste this link into your browser:<br>
<a href="{href}" style="color:#2563eb;word-break:break-all;">{html.escape(url)}</a></p>''')
    if note:
        blocks.append(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;font:400 13px/1.6 {FONT};color:#64748b;">{html.escape(note)}</td>
</tr></table>''')
    hidden = html.escape(preheader or "")
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>{html.escape(subject)}</title>
<style>@media (max-width:620px){{.card{{padding:28px 22px !important}}.code{{font-size:28px !important;letter-spacing:7px !important}}}}</style></head>
<body style="margin:0;padding:0;background:#eef2f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{hidden}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef2f7" style="background:#eef2f7;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 6px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" bgcolor="#2563eb" style="width:36px;height:36px;border-radius:10px;background:#2563eb;text-align:center;font:800 14px/36px {FONT};color:#ffffff;">SA</td>
<td style="padding-left:10px;font:700 15px/1.2 {FONT};color:#0f172a;">Smart Attendance<br><span style="font-weight:500;font-size:12px;color:#64748b;">System</span></td>
</tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
<div style="height:6px;line-height:6px;font-size:0;background:#2563eb;background-image:linear-gradient(90deg,#1d4ed8,#2563eb,#38bdf8);">&nbsp;</div>
<div class="card" style="padding:36px 40px;">
<p style="margin:0 0 8px;font:700 12px/1 {FONT};letter-spacing:.08em;text-transform:uppercase;color:#2563eb;">{html.escape(eyebrow)}</p>
<h1 style="margin:0 0 18px;font:700 24px/1.3 {FONT};color:#0f172a;">{html.escape(subject)}</h1>
{"".join(blocks)}
</div></td></tr>
<tr><td style="padding:22px 12px 0;text-align:center;font:400 12px/1.6 {FONT};color:#94a3b8;">
This is an automated message from Smart Attendance System. Replies to this address are not read.</td></tr>
</table></td></tr></table></body></html>'''
