"""Rule evaluators — one class per RuleConditionType.

Every evaluator follows the same non-negotiable principle: an absent or
uncertain value is never automatically a confirmed violation. The
worst an evaluator may report on its own is POTENTIAL_NON_COMPLIANCE,
and only when the system had reliable evidence to reach that
conclusion; anything uncertain is NEEDS_REVIEW.
"""

from abc import ABC, abstractmethod

from app.models.enums import InspectionStatus, ValidationStatus
from app.models.rule import Rule
from app.services.rules.context import FieldSnapshot, RuleEvaluationInput, RuleEvaluationOutcome

LOW_CONFIDENCE_THRESHOLD = 0.5


class BaseRuleEvaluator(ABC):
    @abstractmethod
    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        raise NotImplementedError


def _missing_field_outcome(context: RuleEvaluationInput) -> RuleEvaluationOutcome:
    if not context.extraction_reliable:
        return RuleEvaluationOutcome(
            status=InspectionStatus.NEEDS_REVIEW.value,
            reason="Information could not be reliably extracted from the available product images.",
            detected_value=None,
            confidence=None,
            evidence_image_id=None,
        )
    return RuleEvaluationOutcome(
        status=InspectionStatus.POTENTIAL_NON_COMPLIANCE.value,
        reason="Required declaration was not detected in the available product images.",
        detected_value=None,
        confidence=None,
        evidence_image_id=None,
    )


def _uncertain_field_outcome(field: FieldSnapshot, reason: str | None = None) -> RuleEvaluationOutcome:
    return RuleEvaluationOutcome(
        status=InspectionStatus.NEEDS_REVIEW.value,
        reason=reason or "The detected value requires inspector verification before it can be relied upon.",
        detected_value=field.value,
        confidence=field.confidence,
        evidence_image_id=field.source_image_id,
    )


def _field_is_confidently_valid(field: FieldSnapshot) -> bool:
    return (
        field.value is not None
        and field.validation_status == ValidationStatus.VALID
        and (field.confidence >= LOW_CONFIDENCE_THRESHOLD or field.manually_verified)
    )


class RequiredFieldEvaluator(BaseRuleEvaluator):
    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        field = context.fields_by_name.get(rule.field_name)
        if field is None or not field.value:
            return _missing_field_outcome(context)

        if field.manually_verified:
            return RuleEvaluationOutcome(
                status=InspectionStatus.PASS.value,
                reason="Required declaration was verified by the inspector.",
                detected_value=field.value,
                confidence=field.confidence,
                evidence_image_id=field.source_image_id,
            )

        if field.validation_status == ValidationStatus.INVALID:
            return _uncertain_field_outcome(
                field,
                "A value was detected but does not match the expected format. "
                "Inspector verification required.",
            )

        if field.validation_status != ValidationStatus.VALID:
            return _uncertain_field_outcome(field)

        if field.confidence < LOW_CONFIDENCE_THRESHOLD:
            return _uncertain_field_outcome(field)

        return RuleEvaluationOutcome(
            status=InspectionStatus.PASS.value,
            reason="Required declaration was clearly detected.",
            detected_value=field.value,
            confidence=field.confidence,
            evidence_image_id=field.source_image_id,
        )


class OptionalFieldEvaluator(BaseRuleEvaluator):
    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        field = context.fields_by_name.get(rule.field_name)
        if field is None or not field.value:
            return RuleEvaluationOutcome(
                status=InspectionStatus.PASS.value,
                reason="Not applicable for this inspection.",
                detected_value=None,
                confidence=None,
                evidence_image_id=None,
            )
        if not _field_is_confidently_valid(field):
            return _uncertain_field_outcome(field)
        return RuleEvaluationOutcome(
            status=InspectionStatus.PASS.value,
            reason="Optional declaration was detected.",
            detected_value=field.value,
            confidence=field.confidence,
            evidence_image_id=field.source_image_id,
        )


class FormatEvaluator(BaseRuleEvaluator):
    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        field = context.fields_by_name.get(rule.field_name)
        if field is None or not field.value:
            return _missing_field_outcome(context)
        if field.validation_status != ValidationStatus.VALID:
            return _uncertain_field_outcome(
                field,
                "Detected value does not clearly match the required format. Inspector verification required.",
            )
        return RuleEvaluationOutcome(
            status=InspectionStatus.PASS.value,
            reason="Declaration matches the required format.",
            detected_value=field.value,
            confidence=field.confidence,
            evidence_image_id=field.source_image_id,
        )


class ValueEvaluator(BaseRuleEvaluator):
    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        field = context.fields_by_name.get(rule.field_name)
        if field is None or not field.value:
            return _missing_field_outcome(context)
        if not _field_is_confidently_valid(field):
            return _uncertain_field_outcome(field)

        expected = (rule.expected_value or "").strip().lower()
        detected = (field.normalized_value or field.value or "").strip().lower()
        if expected and detected != expected:
            return RuleEvaluationOutcome(
                status=InspectionStatus.POTENTIAL_NON_COMPLIANCE.value,
                reason=(
                    f"Detected value '{field.value}' does not match the required "
                    f"declaration '{rule.expected_value}'."
                ),
                detected_value=field.value,
                confidence=field.confidence,
                evidence_image_id=field.source_image_id,
            )
        return RuleEvaluationOutcome(
            status=InspectionStatus.PASS.value,
            reason="Declared value matches the requirement.",
            detected_value=field.value,
            confidence=field.confidence,
            evidence_image_id=field.source_image_id,
        )


class UnitEvaluator(BaseRuleEvaluator):
    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        field = context.fields_by_name.get(rule.field_name)
        if field is None or not field.value:
            return _missing_field_outcome(context)
        if not _field_is_confidently_valid(field):
            return _uncertain_field_outcome(field)

        unit = (field.normalized_value or "").split()[-1] if field.normalized_value else None
        if rule.expected_unit and unit and unit.lower() != rule.expected_unit.lower():
            return RuleEvaluationOutcome(
                status=InspectionStatus.NEEDS_REVIEW.value,
                reason=(
                    f"Declared unit '{unit}' differs from the expected unit "
                    f"'{rule.expected_unit}'. Inspector verification required."
                ),
                detected_value=field.value,
                confidence=field.confidence,
                evidence_image_id=field.source_image_id,
            )
        return RuleEvaluationOutcome(
            status=InspectionStatus.PASS.value,
            reason="Declared unit matches the requirement.",
            detected_value=field.value,
            confidence=field.confidence,
            evidence_image_id=field.source_image_id,
        )


class DateEvaluator(BaseRuleEvaluator):
    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        field = context.fields_by_name.get(rule.field_name)
        if field is None or not field.value:
            return _missing_field_outcome(context)
        if field.manually_verified:
            return RuleEvaluationOutcome(
                status=InspectionStatus.PASS.value,
                reason="Date declaration was verified by the inspector.",
                detected_value=field.value,
                confidence=field.confidence,
                evidence_image_id=field.source_image_id,
            )
        if not _field_is_confidently_valid(field):
            return _uncertain_field_outcome(
                field,
                "A date was detected but extraction confidence is low. Inspector verification required.",
            )
        return RuleEvaluationOutcome(
            status=InspectionStatus.PASS.value,
            reason="Date declaration was clearly detected.",
            detected_value=field.value,
            confidence=field.confidence,
            evidence_image_id=field.source_image_id,
        )


class RangeEvaluator(BaseRuleEvaluator):
    """`rule.expected_value` encodes an inclusive numeric range as "min:max"."""

    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        field = context.fields_by_name.get(rule.field_name)
        if field is None or not field.value:
            return _missing_field_outcome(context)
        if not _field_is_confidently_valid(field):
            return _uncertain_field_outcome(field)

        amount_str = (field.normalized_value or field.value).split()[0]
        try:
            amount = float(amount_str.replace("₹", ""))
        except ValueError:
            return _uncertain_field_outcome(field, "Detected value could not be interpreted as a number.")

        try:
            low_str, high_str = (rule.expected_value or "").split(":")
            low, high = float(low_str), float(high_str)
        except (ValueError, AttributeError):
            return _uncertain_field_outcome(field, "Rule range configuration is invalid.")

        if not (low <= amount <= high):
            return RuleEvaluationOutcome(
                status=InspectionStatus.POTENTIAL_NON_COMPLIANCE.value,
                reason=(
                    f"Declared value {field.value} falls outside the permitted "
                    f"range ({rule.expected_value})."
                ),
                detected_value=field.value,
                confidence=field.confidence,
                evidence_image_id=field.source_image_id,
            )
        return RuleEvaluationOutcome(
            status=InspectionStatus.PASS.value,
            reason="Declared value falls within the permitted range.",
            detected_value=field.value,
            confidence=field.confidence,
            evidence_image_id=field.source_image_id,
        )


class ConditionalEvaluator(BaseRuleEvaluator):
    """`rule.expected_value` encodes "<FIELD_NAME>:present" — the rule only
    applies when that other field was detected (e.g. country of origin is
    only required when an importer is declared).
    """

    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        condition = rule.expected_value or ""
        if ":" in condition:
            dependent_field, expectation = condition.split(":", 1)
            dependent = context.fields_by_name.get(dependent_field.strip())
            condition_met = bool(dependent and dependent.value) if expectation.strip() == "present" else True
            if not condition_met:
                return RuleEvaluationOutcome(
                    status=InspectionStatus.PASS.value,
                    reason="Not applicable — the condition triggering this requirement was not detected.",
                    detected_value=None,
                    confidence=None,
                    evidence_image_id=None,
                )

        return RequiredFieldEvaluator().evaluate(rule, context)


class ManualReviewEvaluator(BaseRuleEvaluator):
    def evaluate(self, rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
        field = context.fields_by_name.get(rule.field_name)
        return RuleEvaluationOutcome(
            status=InspectionStatus.NEEDS_REVIEW.value,
            reason=(
                "This requirement cannot be automatically evaluated and requires "
                "direct inspector verification."
            ),
            detected_value=field.value if field else None,
            confidence=field.confidence if field else None,
            evidence_image_id=field.source_image_id if field else None,
        )
