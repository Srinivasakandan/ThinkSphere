"""Rule engine test matrix — spec section 49.

Pure unit tests: no database, no HTTP. Rule instances are constructed
in-memory (never persisted) purely as inputs to the evaluators.
"""

import uuid

from app.models.enums import RuleConditionType, ValidationStatus
from app.models.rule import Rule
from app.services.rules.context import FieldSnapshot, RuleEvaluationInput
from app.services.rules.rule_engine import evaluate_all, evaluate_rule
from app.services.rules.status import calculate_overall_status


def make_rule(field_name: str, condition_type: str = RuleConditionType.REQUIRED.value, **kwargs) -> Rule:
    return Rule(
        id=uuid.uuid4(),
        rule_code=kwargs.pop("rule_code", "R000"),
        title=kwargs.pop("title", field_name),
        description="test rule",
        category="test",
        field_name=field_name,
        condition_type=condition_type,
        applicable_category="Packaged Commodity",
        legal_source="TEST",
        version="1.0",
        active=True,
        is_demo=True,
        **kwargs,
    )


def make_field(field_name: str, value: str | None, confidence: float = 0.9, **kwargs) -> FieldSnapshot:
    return FieldSnapshot(
        field_name=field_name,
        value=value,
        normalized_value=kwargs.pop("normalized_value", value),
        confidence=confidence,
        validation_status=kwargs.pop("validation_status", ValidationStatus.VALID),
        source_image_id=kwargs.pop("source_image_id", uuid.uuid4()) if value else None,
        manually_verified=kwargs.pop("manually_verified", False),
    )


def context_with(*fields: FieldSnapshot, extraction_reliable: bool = True) -> RuleEvaluationInput:
    return RuleEvaluationInput(
        fields_by_name={f.field_name: f for f in fields}, extraction_reliable=extraction_reliable
    )


class TestRequiredFieldEvaluator:
    def test_mrp_present_passes(self):
        rule = make_rule("MRP")
        context = context_with(make_field("MRP", "₹50"))
        outcome = evaluate_rule(rule, context)
        assert outcome.status == "PASS"

    def test_mrp_missing_is_potential_non_compliance(self):
        rule = make_rule("MRP")
        context = context_with(extraction_reliable=True)
        outcome = evaluate_rule(rule, context)
        assert outcome.status == "POTENTIAL_NON_COMPLIANCE"

    def test_quantity_present_passes(self):
        rule = make_rule("NET_QUANTITY")
        context = context_with(make_field("NET_QUANTITY", "250 g"))
        assert evaluate_rule(rule, context).status == "PASS"

    def test_quantity_missing_is_potential_non_compliance(self):
        rule = make_rule("NET_QUANTITY")
        context = context_with(extraction_reliable=True)
        assert evaluate_rule(rule, context).status == "POTENTIAL_NON_COMPLIANCE"

    def test_missing_field_with_unreliable_extraction_is_needs_review(self):
        """Spec section 52: poor image quality must never auto-become a
        confirmed/potential violation."""
        rule = make_rule("MRP")
        context = context_with(extraction_reliable=False)
        outcome = evaluate_rule(rule, context)
        assert outcome.status == "NEEDS_REVIEW"

    def test_low_confidence_field_is_needs_review(self):
        rule = make_rule("MRP")
        context = context_with(make_field("MRP", "₹50", confidence=0.2))
        assert evaluate_rule(rule, context).status == "NEEDS_REVIEW"

    def test_conflicting_value_marked_needs_review_is_needs_review(self):
        rule = make_rule("MRP")
        field = make_field("MRP", "₹50", validation_status=ValidationStatus.NEEDS_REVIEW)
        context = context_with(field)
        assert evaluate_rule(rule, context).status == "NEEDS_REVIEW"

    def test_manually_verified_field_passes_regardless_of_confidence(self):
        rule = make_rule("MRP")
        field = make_field("MRP", "₹50", confidence=0.1, manually_verified=True)
        context = context_with(field)
        assert evaluate_rule(rule, context).status == "PASS"


class TestDateEvaluator:
    def test_unclear_date_is_needs_review(self):
        rule = make_rule("MANUFACTURING_DATE", RuleConditionType.DATE.value)
        field = make_field("MANUFACTURING_DATE", "06/2O26", confidence=0.35)
        context = context_with(field)
        assert evaluate_rule(rule, context).status == "NEEDS_REVIEW"

    def test_clear_date_passes(self):
        rule = make_rule("MANUFACTURING_DATE", RuleConditionType.DATE.value)
        field = make_field("MANUFACTURING_DATE", "2026-06", confidence=0.9)
        context = context_with(field)
        assert evaluate_rule(rule, context).status == "PASS"


class TestOptionalEvaluator:
    def test_missing_optional_field_passes(self):
        rule = make_rule("BATCH_NUMBER", RuleConditionType.OPTIONAL.value)
        context = context_with(extraction_reliable=True)
        assert evaluate_rule(rule, context).status == "PASS"


class TestManualReviewEvaluator:
    def test_always_needs_review(self):
        rule = make_rule("LEGIBILITY", RuleConditionType.MANUAL_REVIEW.value)
        context = context_with()
        assert evaluate_rule(rule, context).status == "NEEDS_REVIEW"


class TestConditionalEvaluator:
    def test_not_applicable_when_condition_unmet(self):
        rule = make_rule(
            "COUNTRY_OF_ORIGIN",
            RuleConditionType.CONDITIONAL.value,
            expected_value="IMPORTER:present",
        )
        context = context_with(extraction_reliable=True)  # no IMPORTER field at all
        outcome = evaluate_rule(rule, context)
        assert outcome.status == "PASS"
        assert "not applicable" in outcome.reason.lower()

    def test_required_when_condition_met(self):
        rule = make_rule(
            "COUNTRY_OF_ORIGIN",
            RuleConditionType.CONDITIONAL.value,
            expected_value="IMPORTER:present",
        )
        context = context_with(make_field("IMPORTER", "ABC Trading Co"))
        outcome = evaluate_rule(rule, context)
        assert outcome.status == "POTENTIAL_NON_COMPLIANCE"


class TestValueEvaluator:
    def test_matching_value_passes(self):
        rule = make_rule("COUNTRY_OF_ORIGIN", RuleConditionType.VALUE.value, expected_value="India")
        context = context_with(make_field("COUNTRY_OF_ORIGIN", "India"))
        assert evaluate_rule(rule, context).status == "PASS"

    def test_mismatched_value_is_potential_non_compliance(self):
        rule = make_rule("COUNTRY_OF_ORIGIN", RuleConditionType.VALUE.value, expected_value="India")
        context = context_with(make_field("COUNTRY_OF_ORIGIN", "China"))
        assert evaluate_rule(rule, context).status == "POTENTIAL_NON_COMPLIANCE"


class TestOverallStatus:
    def test_all_pass_overall_pass(self):
        assert calculate_overall_status(["PASS", "PASS", "PASS"]) == "PASS"

    def test_one_potential_non_compliance_wins(self):
        statuses = ["PASS", "POTENTIAL_NON_COMPLIANCE", "NEEDS_REVIEW"]
        assert calculate_overall_status(statuses) == "POTENTIAL_NON_COMPLIANCE"

    def test_needs_review_without_non_compliance(self):
        statuses = ["PASS", "PASS", "NEEDS_REVIEW"]
        assert calculate_overall_status(statuses) == "NEEDS_REVIEW"

    def test_empty_results_defaults_to_pass(self):
        assert calculate_overall_status([]) == "PASS"


def test_evaluate_all_matches_rule_order():
    rules = [make_rule("MRP", rule_code="R001"), make_rule("NET_QUANTITY", rule_code="R002")]
    context = context_with(make_field("MRP", "₹50"), make_field("NET_QUANTITY", "250 g"))
    results = evaluate_all(rules, context)
    assert [r.rule_code for r, _ in results] == ["R001", "R002"]
    assert all(outcome.status == "PASS" for _, outcome in results)


def test_unknown_condition_type_is_needs_review():
    rule = make_rule("MRP", "SOMETHING_UNDEFINED")
    context = context_with(make_field("MRP", "₹50"))
    outcome = evaluate_rule(rule, context)
    assert outcome.status == "NEEDS_REVIEW"
