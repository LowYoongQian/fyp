from integrations.medical_leave import has_valid_signature


def test_medical_upload_checks_file_content_not_only_browser_mime_type():
    assert has_valid_signature(b"%PDF-1.7 sample", "application/pdf")
    assert has_valid_signature(b"\x89PNG\r\n\x1a\nrest", "image/png")
    assert has_valid_signature(b"\xff\xd8\xffrest", "image/jpeg")
    assert not has_valid_signature(b"plain text", "application/pdf")
