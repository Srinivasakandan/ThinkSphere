"""Storage service abstraction — images and generated reports.

No code outside this package should call Supabase Storage or touch the
local filesystem directly.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class StoredFile:
    path: str
    url: str


class StorageService(ABC):
    @abstractmethod
    async def upload_file(self, *, path: str, content: bytes, content_type: str) -> StoredFile:
        raise NotImplementedError

    @abstractmethod
    async def delete_file(self, *, path: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_file_url(self, *, path: str) -> str:
        raise NotImplementedError

    @abstractmethod
    async def read_file(self, *, path: str) -> bytes:
        raise NotImplementedError
