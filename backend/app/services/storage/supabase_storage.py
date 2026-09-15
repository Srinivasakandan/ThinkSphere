"""Supabase Storage adapter.

Uses the Supabase Storage REST API directly via httpx rather than the
supabase-py SDK, to keep the dependency footprint small. The
service-role key is used server-side only and is never returned to the
frontend (see StoredFile — only a URL is exposed).
"""

import httpx

from app.services.storage.base import StorageService, StoredFile


class SupabaseStorageService(StorageService):
    def __init__(self, *, supabase_url: str, service_role_key: str, bucket: str) -> None:
        self.base_url = supabase_url.rstrip("/")
        self.bucket = bucket
        self._headers = {
            "Authorization": f"Bearer {service_role_key}",
            "apikey": service_role_key,
        }

    async def upload_file(self, *, path: str, content: bytes, content_type: str) -> StoredFile:
        url = f"{self.base_url}/storage/v1/object/{self.bucket}/{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url,
                content=content,
                headers={**self._headers, "Content-Type": content_type, "x-upsert": "true"},
            )
            response.raise_for_status()
        return StoredFile(path=path, url=self.get_file_url(path=path))

    async def delete_file(self, *, path: str) -> None:
        url = f"{self.base_url}/storage/v1/object/{self.bucket}/{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.delete(url, headers=self._headers)
            if response.status_code not in (200, 204, 404):
                response.raise_for_status()

    def get_file_url(self, *, path: str) -> str:
        return f"{self.base_url}/storage/v1/object/public/{self.bucket}/{path}"

    async def read_file(self, *, path: str) -> bytes:
        url = f"{self.base_url}/storage/v1/object/{self.bucket}/{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=self._headers)
            response.raise_for_status()
            return response.content
