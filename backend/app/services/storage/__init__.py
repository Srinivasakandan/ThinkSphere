"""Storage service factory."""

from app.core.config import Settings
from app.services.storage.base import StorageService, StoredFile
from app.services.storage.local_storage import LocalFileStorageService
from app.services.storage.supabase_storage import SupabaseStorageService

__all__ = ["StorageService", "StoredFile", "get_storage_service"]

_local_singleton: LocalFileStorageService | None = None


def get_storage_service(settings: Settings) -> StorageService:
    if settings.is_supabase_configured and settings.supabase_service_role_key:
        return SupabaseStorageService(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
            bucket=settings.supabase_storage_bucket,
        )

    global _local_singleton
    if _local_singleton is None:
        public_base_url = f"{settings.backend_public_url.rstrip('/')}/media" if settings.backend_public_url else "/media"
        _local_singleton = LocalFileStorageService(settings.local_storage_dir, public_base_url=public_base_url)
    return _local_singleton
