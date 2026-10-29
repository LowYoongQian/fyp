def ensure_private_bucket(client, url, bucket, max_size, allowed_types):
    """Handle Storage's 400-wrapped missing bucket without exposing documents."""
    response = client.get(f"{url}/storage/v1/bucket/{bucket}")
    missing = response.status_code == 404
    if response.status_code == 400:
        error = response.json()
        missing = error.get("code") == "NoSuchBucket" or error.get("message") == "Bucket not found"
    if missing:
        created = client.post(f"{url}/storage/v1/bucket", json={
            "id": bucket, "name": bucket, "public": False,
            "file_size_limit": max_size, "allowed_mime_types": sorted(allowed_types),
        })
        if created.status_code not in (200, 201, 409):
            created.raise_for_status()
        response = client.get(f"{url}/storage/v1/bucket/{bucket}")
    response.raise_for_status()
    if response.json().get("public") is not False:
        raise RuntimeError("Document bucket must be private")
