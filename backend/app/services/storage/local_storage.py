"""Local filesystem storage — used automatically when Supabase Storage is
not configured, so uploads work end to end in demo/development mode.

Files are served back via the `/media/{path}` static mount registered
in app.main.
"""

from pathlib import Path

from app.services.storage.base import StorageService, StoredFile


class LocalFileStorageService(StorageService):
    def __init__(self, base_dir: str, public_base_url: str = "/media") -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.public_base_url = public_base_url.rstrip("/")

    def _resolve(self, path: str) -> Path:
        full_path = (self.base_dir / path).resolve()
        if self.base_dir.resolve() not in full_path.parents and full_path != self.base_dir.resolve():
            raise ValueError("Resolved storage path escapes the storage root.")
        return full_path

    async def upload_file(self, *, path: str, content: bytes, content_type: str) -> StoredFile:
        full_path = self._resolve(path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)
        return StoredFile(path=path, url=self.get_file_url(path=path))

    async def delete_file(self, *, path: str) -> None:
        full_path = self._resolve(path)
        full_path.unlink(missing_ok=True)

    def get_file_url(self, *, path: str) -> str:
        return f"{self.public_base_url}/{path}"

    async def read_file(self, *, path: str) -> bytes:
        return self._resolve(path).read_bytes()
