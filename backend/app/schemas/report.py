"""Report generation schemas."""

import uuid

from pydantic import BaseModel


class ReportGenerateResponse(BaseModel):
    report_id: uuid.UUID
    inspection_id: uuid.UUID
    file_path: str
    url: str | None = None
