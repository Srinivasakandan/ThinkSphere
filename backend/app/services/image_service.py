"""Image upload/delete orchestration: validation, storage, persistence."""

import io
import uuid

from fastapi import HTTPException, UploadFile, status
from PIL import Image as PILImage
from PIL import UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.enums import AuditAction, ImageProcessingStatus, ImageViewType, InspectionStage
from app.models.inspection import Inspection
from app.models.product_image import ProductImage
from app.repositories import inspection_repository
from app.services.storage import StorageService

ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


class ImageValidationError(ValueError):
    pass


def _validate_image_bytes(content: bytes, mime_type: str, filename: str, max_size_mb: int) -> None:
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ImageValidationError(f"Unsupported file type '{mime_type}' for '{filename}'.")
    if len(content) == 0:
        raise ImageValidationError(f"'{filename}' is empty.")
    if len(content) > max_size_mb * 1024 * 1024:
        raise ImageValidationError(f"'{filename}' exceeds the maximum allowed size of {max_size_mb}MB.")

    # Never trust the filename extension or declared MIME type alone —
    # confirm the bytes actually decode as an image.
    try:
        with PILImage.open(io.BytesIO(content)) as img:
            img.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageValidationError(f"'{filename}' is not a valid or readable image file.") from exc


async def upload_images(
    db: Session,
    *,
    inspection: Inspection,
    files: list[UploadFile],
    view_types: list[str],
    storage: StorageService,
    user_id: uuid.UUID,
    settings: Settings,
) -> list[ProductImage]:
    if inspection.stage == InspectionStage.FINALIZED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "INSPECTION_FINALIZED",
                    "message": "Cannot add images to a finalized inspection.",
                }
            },
        )

    existing_count = len(inspection_repository.list_images(db, inspection.id))
    if existing_count + len(files) > settings.max_images_per_inspection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "TOO_MANY_IMAGES",
                    "message": (
                        f"An inspection may have at most " f"{settings.max_images_per_inspection} images."
                    ),
                }
            },
        )

    created: list[ProductImage] = []
    for file, view_type in zip(files, view_types, strict=True):
        content = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        try:
            _validate_image_bytes(content, mime_type, file.filename or "upload", settings.max_image_size_mb)
        except ImageValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "INVALID_IMAGE", "message": str(exc)}},
            ) from exc

        if view_type.upper() not in ImageViewType.__members__:
            view_type = ImageViewType.OTHER.value

        image_id = uuid.uuid4()
        extension = (
            (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
        )
        storage_path = f"inspections/{inspection.id}/{image_id}/original.{extension}"
        await storage.upload_file(path=storage_path, content=content, content_type=mime_type)

        image = ProductImage(
            id=image_id,
            inspection_id=inspection.id,
            storage_path=storage_path,
            original_filename=file.filename or "upload",
            view_type=view_type.upper(),
            mime_type=mime_type,
            file_size=len(content),
            processing_status=ImageProcessingStatus.UPLOADED.value,
        )
        db.add(image)
        created.append(image)

    if inspection.stage == InspectionStage.CREATED.value:
        inspection.stage = InspectionStage.IMAGES_UPLOADED.value

    db.flush()

    inspection_repository.add_audit_log(
        db,
        inspection_id=inspection.id,
        user_id=user_id,
        action=AuditAction.IMAGE_UPLOADED.value,
        entity_type="ProductImage",
        metadata={"count": len(created)},
    )
    db.commit()
    for image in created:
        db.refresh(image)
    return created


async def delete_image(
    db: Session,
    *,
    inspection: Inspection,
    image_id: uuid.UUID,
    storage: StorageService,
    user_id: uuid.UUID,
) -> None:
    if inspection.stage == InspectionStage.FINALIZED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "INSPECTION_FINALIZED",
                    "message": "Cannot remove images from a finalized inspection.",
                }
            },
        )

    image = next((img for img in inspection.images if img.id == image_id), None)
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "IMAGE_NOT_FOUND",
                    "message": "Image could not be found on this inspection.",
                }
            },
        )

    await storage.delete_file(path=image.storage_path)
    db.delete(image)

    inspection_repository.add_audit_log(
        db,
        inspection_id=inspection.id,
        user_id=user_id,
        action=AuditAction.IMAGE_DELETED.value,
        entity_type="ProductImage",
        entity_id=image_id,
    )
    db.commit()


def build_image_url(image: ProductImage, storage: StorageService, settings: Settings) -> str:
    return storage.get_file_url(path=image.storage_path)
