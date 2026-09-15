"""Product image upload/removal — all images for one inspection describe
ONE physical product (see spec section 7/14).
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.dependencies import get_current_inspector, get_db
from app.core.config import Settings, get_settings
from app.models.user import Inspector
from app.schemas.image import ImageResponse
from app.services import image_service, inspection_service
from app.services.storage import get_storage_service

router = APIRouter(prefix="/api/v1/inspections", tags=["images"])


@router.post("/{inspection_id}/images", response_model=list[ImageResponse], summary="Upload product images")
async def upload_images(
    inspection_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    view_types: list[str] = Form(default=[]),
    db=Depends(get_db),
    inspector: Inspector = Depends(get_current_inspector),
    settings: Settings = Depends(get_settings),
) -> list[ImageResponse]:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    storage = get_storage_service(settings)

    resolved_view_types = view_types if view_types else ["OTHER"] * len(files)
    if len(resolved_view_types) < len(files):
        resolved_view_types += ["OTHER"] * (len(files) - len(resolved_view_types))

    images = await image_service.upload_images(
        db,
        inspection=inspection,
        files=files,
        view_types=resolved_view_types,
        storage=storage,
        user_id=inspector.id,
        settings=settings,
    )
    return [inspection_service.to_image_response(img, storage) for img in images]


@router.delete("/{inspection_id}/images/{image_id}", status_code=204, summary="Delete a product image")
async def delete_image(
    inspection_id: uuid.UUID,
    image_id: uuid.UUID,
    db=Depends(get_db),
    inspector: Inspector = Depends(get_current_inspector),
    settings: Settings = Depends(get_settings),
) -> None:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    storage = get_storage_service(settings)
    await image_service.delete_image(
        db, inspection=inspection, image_id=image_id, storage=storage, user_id=inspector.id
    )
