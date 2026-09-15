"""ORM models. Import this module (or any submodule) before using
Base.metadata for migrations so every mapped class is registered.
"""

from app.models.audit_log import AuditLog
from app.models.extracted_field import ExtractedField
from app.models.inspection import Inspection
from app.models.ocr_result import OCRResult
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.review import InspectorReview
from app.models.rule import Rule
from app.models.rule_result import RuleResult
from app.models.user import Inspector

__all__ = [
    "AuditLog",
    "ExtractedField",
    "Inspection",
    "Inspector",
    "InspectorReview",
    "OCRResult",
    "Product",
    "ProductImage",
    "Rule",
    "RuleResult",
]
