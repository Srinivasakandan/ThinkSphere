"""Centralized overall-status roll-up. The ONLY place this logic lives —
API routes and services must call this rather than re-implementing it.
"""

from app.models.enums import InspectionStatus


def calculate_overall_status(rule_statuses: list[str]) -> str:
    if any(status == InspectionStatus.POTENTIAL_NON_COMPLIANCE.value for status in rule_statuses):
        return InspectionStatus.POTENTIAL_NON_COMPLIANCE.value
    if any(status == InspectionStatus.NEEDS_REVIEW.value for status in rule_statuses):
        return InspectionStatus.NEEDS_REVIEW.value
    return InspectionStatus.PASS.value
